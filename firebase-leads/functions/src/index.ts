import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { createApi } from "./api";
import { IdentityToolkitClient, type IdentityClient } from "./auth";
import { FirestoreRepository } from "./firestore-repository";
import {
  TelegramHttpClient,
  enqueueMorningReminder,
  processOutboxBatch,
} from "./services";

const REGION = "asia-southeast1";
const TIME_ZONE = "Asia/Singapore";
const API_SERVICE_ACCOUNT = "reputifly-leads-api@reputifly-leads-2.iam.gserviceaccount.com";
const WORKER_SERVICE_ACCOUNT = "reputifly-leads-worker@reputifly-leads-2.iam.gserviceaccount.com";

const legacyFirebaseApiKey = defineSecret("LEGACY_FIREBASE_API_KEY");
const telegramBotToken = defineSecret("TELEGRAM_BOT_TOKEN");
const telegramChatId = defineSecret("TELEGRAM_CHAT_ID");

initializeApp();
const repository = new FirestoreRepository(getFirestore());

let identityClient: IdentityClient | undefined;
const lazyIdentityClient: IdentityClient = {
  lookup(idToken) {
    identityClient ??= new IdentityToolkitClient(legacyFirebaseApiKey.value());
    return identityClient.lookup(idToken);
  },
};

const app = createApi({
  repository,
  identityClient: lazyIdentityClient,
  logError(message, context) {
    logger.error(message, context);
  },
});

export const api = onRequest(
  {
    region: REGION,
    invoker: "public",
    minInstances: 1,
    maxInstances: 10,
    concurrency: 80,
    timeoutSeconds: 30,
    memory: "256MiB",
    cors: false,
    serviceAccount: API_SERVICE_ACCOUNT,
    secrets: [legacyFirebaseApiKey],
  },
  app,
);

export const outboxWorker = onSchedule(
  {
    region: REGION,
    schedule: "* * * * *",
    timeZone: TIME_ZONE,
    timeoutSeconds: 55,
    memory: "256MiB",
    maxInstances: 1,
    concurrency: 1,
    serviceAccount: WORKER_SERVICE_ACCOUNT,
    secrets: [telegramBotToken, telegramChatId],
  },
  async () => {
    const result = await processOutboxBatch({
      repository,
      telegram: new TelegramHttpClient(telegramBotToken.value(), telegramChatId.value()),
    });
    logger.info("Outbox worker completed", result);
  },
);

export const morningReminder = onSchedule(
  {
    region: REGION,
    schedule: "0 9 * * *",
    timeZone: TIME_ZONE,
    timeoutSeconds: 30,
    memory: "256MiB",
    maxInstances: 1,
    concurrency: 1,
    serviceAccount: WORKER_SERVICE_ACCOUNT,
  },
  async () => {
    const localDate = dateInTimeZone(new Date(), TIME_ZONE);
    const result = await enqueueMorningReminder({ repository, localDate });
    logger.info("Morning reminder scheduled", result);
  },
);

export const operationalHealth = onSchedule(
  {
    region: REGION,
    schedule: "*/5 * * * *",
    timeZone: TIME_ZONE,
    timeoutSeconds: 30,
    memory: "256MiB",
    maxInstances: 1,
    concurrency: 1,
    serviceAccount: WORKER_SERVICE_ACCOUNT,
  },
  async () => {
    const now = new Date();
    const result = await repository.checkOperationalHealth({
      now: now.toISOString(),
      staleBefore: new Date(now.getTime() - 15 * 60_000).toISOString(),
    });
    await repository.recordSystemHeartbeat("operationalHealth", {
      at: now.toISOString(),
      healthy: result.staleOutboxCount === 0 && result.deadOutboxCount === 0,
      ...result,
    });
    if (result.staleOutboxCount > 0 || result.deadOutboxCount > 0) {
      // ERROR severity is intentionally the alert boundary. Do not enqueue an
      // alert through the same broken outbox or log notification contents.
      logger.error("Operational health check failed", result);
    } else {
      logger.info("Operational health check passed", result);
    }
  },
);

export function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
