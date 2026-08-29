import { AppError } from "./errors";
import type { Actor, LegacyIdentity, Member } from "./domain";

export interface IdentityClient {
  lookup(idToken: string): Promise<LegacyIdentity>;
}

export interface MembershipReader {
  getMember(uid: string): Promise<Member | null>;
}

type FetchLike = typeof fetch;

interface IdentityToolkitResponse {
  users?: Array<{
    localId?: string;
    email?: string;
    emailVerified?: boolean;
    displayName?: string;
    disabled?: boolean;
  }>;
  error?: { message?: string };
}

export class IdentityToolkitClient implements IdentityClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = 6_000,
  ) {
    if (!apiKey.trim()) throw new Error("LEGACY_FIREBASE_API_KEY is not configured");
  }

  async lookup(idToken: string): Promise<LegacyIdentity> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken }),
          signal: controller.signal,
        },
      );
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError" ? "timed out" : "failed";
      throw new AppError(503, "identity_unavailable", `Identity verification ${message}.`);
    } finally {
      clearTimeout(timeout);
    }

    let body: IdentityToolkitResponse;
    try {
      body = (await response.json()) as IdentityToolkitResponse;
    } catch {
      throw new AppError(503, "identity_unavailable", "Identity verification returned an invalid response.");
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new AppError(401, "unauthorized", "The sign-in session is invalid or expired.");
    }
    if (!response.ok) {
      throw new AppError(503, "identity_unavailable", "Identity verification is temporarily unavailable.");
    }

    const user = body.users?.[0];
    if (!user?.localId || !user.email || user.disabled) {
      throw new AppError(401, "unauthorized", "The sign-in session is invalid or expired.");
    }

    return {
      uid: user.localId,
      email: user.email,
      emailVerified: user.emailVerified === true,
      ...(user.displayName ? { displayName: user.displayName } : {}),
    };
  }
}

export function extractBearer(authorization: string | undefined): string {
  if (!authorization) {
    throw new AppError(401, "unauthorized", "Authorization bearer token is required.");
  }

  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  if (!match?.[1]) {
    throw new AppError(401, "unauthorized", "Authorization bearer token is malformed.");
  }
  return match[1];
}

export async function authenticate(
  authorization: string | undefined,
  identityClient: IdentityClient,
  membershipReader: MembershipReader,
): Promise<Actor> {
  const identity = await identityClient.lookup(extractBearer(authorization));
  const member = await membershipReader.getMember(identity.uid);

  if (!member?.active) {
    throw new AppError(403, "forbidden", "This account does not have access.");
  }

  return {
    ...identity,
    role: member.role,
    ...(member.displayName ? { memberDisplayName: member.displayName } : {}),
  };
}
