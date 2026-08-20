import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import type {
  Actor,
  ActorLabels,
  DailyStatus,
  Digest,
  Lead,
  PublicLead,
} from "./domain";
import { authenticate, type IdentityClient } from "./auth";
import { AppError, asAppError } from "./errors";
import type { Repository } from "./repository";
import {
  DigestService,
  FollowUpService,
  LeadService,
  assertIdempotencyKey,
  publicFollowUp,
  publicDeliveryStatus,
  publicLead,
} from "./services";
import { businessDate } from "./time";
import {
  archiveLeadSchema,
  createDigestSchema,
  followUpSchema,
  leadInputSchema,
  parseBody,
  parseDocumentId,
  updateLeadSchema,
} from "./validation";

const EXACT_ORIGINS = new Set([
  "https://reputifly.org",
  "https://www.reputifly.org",
  "https://reputifly-leads-2.web.app",
  "https://reputifly-leads-2.firebaseapp.com",
  "https://daily-digest-2.web.app",
  "https://daily-digest-2.firebaseapp.com",
  "https://watchlist-v2.web.app",
  "https://watchlist-v2.firebaseapp.com",
  "https://daily-digest-v2.web.app",
  "https://daily-digest-v2.firebaseapp.com",
]);

type AuthenticatedRequest = Request & { actor: Actor; requestId: string };

export interface ApiDependencies {
  repository: Repository;
  identityClient: IdentityClient;
  now?: () => Date;
  randomId?: () => string;
  logError?: (message: string, context: Record<string, unknown>) => void;
}

export function createApi(dependencies: ApiDependencies) {
  const app = express();
  const clock = dependencies.now ?? (() => new Date());
  const leadService = new LeadService(dependencies.repository, clock, dependencies.randomId);
  const digestService = new DigestService(dependencies.repository, clock);
  const followUpService = new FollowUpService(dependencies.repository, clock);
  const resolveActorLabels = async (uids: string[]): Promise<ActorLabels> => {
    try {
      return await dependencies.repository.resolveActorLabels(uids);
    } catch (error) {
      dependencies.logError?.("Actor label resolution failed", {
        referencedActorCount: new Set(uids.filter(Boolean)).size,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      return {};
    }
  };

  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(corsAllowlist);

  app.get("/healthz", (_request, response) => {
    response.status(200).json({ ok: true, service: "reputifly-leads-api" });
  });

  app.use("/v1", asyncRoute(async (request, _response, next) => {
    const actor = await authenticate(
      request.header("authorization"),
      dependencies.identityClient,
      dependencies.repository,
    );
    (request as AuthenticatedRequest).actor = actor;
    next();
  }), requireJsonForWrites, express.json({
    limit: "64kb",
    type: ["application/json", "application/*+json"],
  }));

  app.get("/v1/session", asyncRoute(async (request, response) => {
    const actor = actorFrom(request);
    const leads = await dependencies.repository.listActiveLeads();
    const actors = await actorLabelsForLeads(resolveActorLabels, leads);
    const completedAt = clock();
    response.status(200).json(withReadMeta(request, completedAt, {
      identity: {
        uid: actor.uid,
        email: actor.email,
        emailVerified: actor.emailVerified,
        ...(actor.displayName ? { displayName: actor.displayName } : {}),
      },
      member: {
        role: actor.role,
        ...(actor.memberDisplayName ? { displayName: actor.memberDisplayName } : {}),
      },
      leads: leads.map(publicLead),
      actors,
    }));
  }));

  app.get("/v1/leads", asyncRoute(async (request, response) => {
    const leads = await dependencies.repository.listActiveLeads();
    const actors = await actorLabelsForLeads(resolveActorLabels, leads);
    response.status(200).json(withReadMeta(request, clock(), {
      leads: leads.map(publicLead),
      actors,
    }));
  }));

  app.post("/v1/leads", requireWriter, asyncRoute(async (request, response) => {
    const lead = parseBody(leadInputSchema, request.body);
    const idempotencyKey = assertIdempotencyKey(request.header("idempotency-key"));
    const result = await leadService.create(actorFrom(request), lead, idempotencyKey);
    const actors = await actorLabelsForPublicLeads(resolveActorLabels, [result.lead]);
    response.status(result.replayed ? 200 : 201).json(withMeta(request, clock(), {
      ...result,
      actors,
    }));
  }));

  app.put("/v1/leads/:id", requireWriter, asyncRoute(async (request, response) => {
    const id = parseDocumentId(routeParam(request.params.id), "lead id");
    const parsed = parseBody(updateLeadSchema, request.body);
    const { expectedRevision, ...lead } = parsed;
    const result = await leadService.put(actorFrom(request), id, lead, expectedRevision);
    const actors = await actorLabelsForPublicLeads(resolveActorLabels, [result.lead]);
    response.status(result.created ? 201 : 200).json(withMeta(request, clock(), {
      ...result,
      actors,
    }));
  }));

  app.post("/v1/leads/:id/archive", requireWriter, asyncRoute(async (request, response) => {
    const id = parseDocumentId(routeParam(request.params.id), "lead id");
    const { expectedRevision } = parseBody(archiveLeadSchema, request.body);
    const lead = await leadService.archive(actorFrom(request), id, expectedRevision);
    const actors = await actorLabelsForPublicLeads(resolveActorLabels, [lead]);
    response.status(200).json(withMeta(request, clock(), { lead, actors }));
  }));

  app.post("/v1/leads/:id/follow-ups", requireWriter, asyncRoute(async (request, response) => {
    const actor = actorFrom(request);
    const leadId = parseDocumentId(routeParam(request.params.id), "lead id");
    const idempotencyKey = assertIdempotencyKey(request.header("idempotency-key"), true) as string;
    const parsed = parseBody(followUpSchema, request.body);
    const result = await followUpService.log({
      actor,
      leadId,
      idempotencyKey,
      expectedRevision: parsed.expectedRevision,
      outcome: parsed.outcome,
      ...(parsed.nextFollowUp ? { nextFollowUp: parsed.nextFollowUp } : {}),
    });
    const lead = publicLead(result.lead);
    const followUp = publicFollowUp(result.followUp);
    const actors = await actorLabelsForPublicLeads(resolveActorLabels, [lead], [followUp.actorUid]);
    response.status(result.replayed ? 200 : 201).json(withMeta(request, clock(), {
      lead,
      followUp,
      replayed: result.replayed,
      actors,
    }));
  }));

  app.post("/v1/digests", requireWriter, asyncRoute(async (request, response) => {
    const actor = actorFrom(request);
    const { idempotencyKey, payload } = parseBody(createDigestSchema, request.body);
    const acceptance = await digestService.create(actor, idempotencyKey, payload);
    const actors = await resolveActorLabels([acceptance.acceptedBy]);
    response.status(acceptance.replayed ? 200 : 202).json(withMeta(request, clock(), {
      ...acceptance,
      actors,
    }));
  }));

  app.get("/v1/digests/:id", asyncRoute(async (request, response) => {
    const id = parseDocumentId(routeParam(request.params.id), "digest id");
    const digest = await dependencies.repository.getDigest(id);
    if (!digest) throw new AppError(404, "not_found", "Digest not found.");
    const publicDigest = digestPublicView(digest);
    const actors = await resolveActorLabels([publicDigest.acceptedBy]);
    response.status(200).json(withReadMeta(request, clock(), { digest: publicDigest, actors }));
  }));

  app.get("/v1/daily-status", asyncRoute(async (request, response) => {
    const actor = actorFrom(request);
    const { status, actors, completedAt } = await currentDailyStatus(
      dependencies.repository,
      actor.uid,
      clock,
      resolveActorLabels,
    );
    response.status(200).json(withReadMeta(request, completedAt, {
      status: statusWithSubjectLabel(status, actors),
      actors,
    }));
  }));

  app.get("/v1/team/daily-status", requireOwner, asyncRoute(async (request, response) => {
    const members = await dependencies.repository.getExpectedDigestMembers();
    if (members.length !== 1) {
      throw new AppError(
        409,
        "conflict",
        "Exactly one active member must be configured for daily digest accountability.",
        { configuredMemberCount: members.length },
      );
    }
    const subject = members[0];
    if (!subject) throw new AppError(409, "conflict", "Daily digest member configuration is invalid.");
    const { status, actors, completedAt } = await currentDailyStatus(
      dependencies.repository,
      subject.uid,
      clock,
      resolveActorLabels,
    );
    response.status(200).json(withReadMeta(request, completedAt, {
      status: statusWithSubjectLabel(status, actors),
      actors,
    }));
  }));

  app.use((_request, _response, next) => {
    next(new AppError(404, "not_found", "Route not found."));
  });

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    let appError: AppError;
    if (error instanceof SyntaxError && "body" in error) {
      appError = new AppError(400, "bad_request", "Request body is not valid JSON.");
    } else {
      appError = asAppError(error);
    }

    if (appError.status >= 500) {
      dependencies.logError?.("API request failed", {
        requestId: (request as Partial<AuthenticatedRequest>).requestId,
        method: request.method,
        path: request.path,
        code: appError.code,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
    response.status(appError.status).json({
      error: {
        code: appError.code,
        message: appError.message,
        requestId: (request as Partial<AuthenticatedRequest>).requestId,
        ...(appError.details !== undefined ? { details: appError.details } : {}),
      },
    });
  });

  return app;
}

function requestContext(request: Request, response: Response, next: NextFunction): void {
  const inbound = request.header("x-request-id");
  const requestId = inbound && /^[A-Za-z0-9._:-]{1,100}$/.test(inbound) ? inbound : randomUUID();
  (request as AuthenticatedRequest).requestId = requestId;
  response.setHeader("x-request-id", requestId);
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
  next();
}

function corsAllowlist(request: Request, response: Response, next: NextFunction): void {
  const origin = request.header("origin");
  if (origin && !isAllowedOrigin(origin)) {
    next(new AppError(403, "origin_not_allowed", "Request origin is not allowed."));
    return;
  }

  if (origin) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
    response.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
    response.setHeader("access-control-allow-headers", "Authorization,Content-Type,Idempotency-Key,X-Request-Id");
    response.setHeader("access-control-expose-headers", "X-Request-Id");
    response.setHeader("access-control-max-age", "3600");
  }
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  next();
}

function isAllowedOrigin(origin: string): boolean {
  if (EXACT_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

function requireJsonForWrites(request: Request, _response: Response, next: NextFunction): void {
  if (["POST", "PUT", "PATCH"].includes(request.method) && !request.is("application/json")) {
    next(new AppError(415, "unsupported_media_type", "Content-Type must be application/json."));
    return;
  }
  next();
}

function requireWriter(request: Request, _response: Response, next: NextFunction): void {
  if (actorFrom(request).role === "viewer") {
    next(new AppError(403, "forbidden", "This member has read-only access."));
    return;
  }
  next();
}

function requireOwner(request: Request, _response: Response, next: NextFunction): void {
  if (actorFrom(request).role !== "owner") {
    next(new AppError(403, "forbidden", "Owner access is required."));
    return;
  }
  next();
}

function actorFrom(request: Request): Actor {
  const actor = (request as Partial<AuthenticatedRequest>).actor;
  if (!actor) throw new AppError(401, "unauthorized", "Authentication is required.");
  return actor;
}

function routeParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function withMeta<T extends Record<string, unknown>>(request: Request, at: Date, body: T) {
  return {
    ...body,
    meta: {
      serverTime: at.toISOString(),
      requestId: (request as AuthenticatedRequest).requestId,
      businessDate: businessDate(at),
    },
  };
}

function withReadMeta<T extends Record<string, unknown>>(request: Request, at: Date, body: T) {
  return { ...withMeta(request, at, body), dataAsOf: at.toISOString() };
}

type ActorResolver = (uids: string[]) => Promise<ActorLabels>;

async function actorLabelsForLeads(resolve: ActorResolver, leads: Lead[]) {
  return resolve(referencedLeadActors(leads.map(publicLead)));
}

async function actorLabelsForPublicLeads(
  resolve: ActorResolver,
  leads: PublicLead[],
  additional: string[] = [],
) {
  return resolve([...referencedLeadActors(leads), ...additional]);
}

function referencedLeadActors(leads: PublicLead[]): string[] {
  return leads.flatMap((lead) => [lead.createdBy, lead.updatedBy, lead.archivedBy ?? ""]);
}

function statusWithSubjectLabel(status: DailyStatus, actors: ActorLabels) {
  return {
    ...status,
    subject: {
      uid: status.subject.uid,
      label: actors[status.subject.uid]?.label ?? "Team member",
    },
  };
}

export function digestPublicView(digest: Digest) {
  const deliveryStatus = publicDeliveryStatus(digest);
  const hasDeliveryProof = deliveryStatus === "delivered";
  return {
    id: digest.id,
    businessDate: digest.businessDate ?? businessDate(new Date(digest.createdAt)),
    payload: {
      date: digest.payload.date,
      newLeads: digest.payload.newLeads,
      samplesSent: digest.payload.samplesSent,
      followUps: digest.payload.followUps.map((item) => ({
        phone: item.phone,
        round: item.round,
        sample: item.sample,
      })),
      dumped: digest.payload.dumped.map((item) => ({ reason: item.reason })),
      notes: digest.payload.notes,
    },
    acceptedAt: digest.createdAt,
    acceptedBy: digest.createdBy,
    deliveryStatus,
    ...(hasDeliveryProof ? { deliveredAt: digest.deliveredAt } : {}),
    ...(hasDeliveryProof ? { telegramMessageId: digest.telegramMessageId } : {}),
  };
}

async function currentDailyStatus(
  repository: Repository,
  uid: string,
  clock: () => Date,
  resolveActors: ActorResolver,
) {
  let status: DailyStatus | undefined;
  let actors: ActorLabels = {};
  let completedAt = clock();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const localDate = businessDate(completedAt);
    [status, actors] = await Promise.all([
      repository.getDailyStatus(uid, localDate),
      resolveActors([uid]),
    ]);
    completedAt = clock();
    if (businessDate(completedAt) === localDate) return { status, actors, completedAt };
  }
  // Crossing three Singapore midnights inside one request is not physically
  // plausible; retain a defensive error instead of returning mismatched dates.
  throw new AppError(503, "internal_error", "Could not establish the current business date.");
}

function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}
