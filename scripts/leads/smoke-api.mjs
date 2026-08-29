#!/usr/bin/env node
import { API_BASE, parseCli, publicError } from "./ops-lib.mjs";
import {
  apiToken,
  normalizeApiBase,
  runAuthenticatedReadSmoke,
} from "./api-lib.mjs";

function help() {
  console.log(`Usage: node scripts/leads/smoke-api.mjs [--api-base URL] [--timeout-ms 15000]

Read-only production API contract test. Requires LEADS_ID_TOKEN in the
environment. It never prints the token, response bodies, lead IDs, or PII.`);
}

async function main() {
  const args = parseCli(process.argv.slice(2), {
    "api-base": "string",
    "timeout-ms": "string",
    help: "boolean",
  });
  if (args.help) return help();
  if (args._.length) throw new Error("Unexpected positional arguments");
  const apiBase = normalizeApiBase(args["api-base"] || API_BASE);
  const timeoutMs = Number(args["timeout-ms"] || 15_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error("--timeout-ms must be 1000..60000");
  const token = apiToken();

  await runAuthenticatedReadSmoke({ apiBase, token, timeoutMs });
}

main().catch((error) => {
  console.error(`ERROR: ${publicError(error)}`);
  process.exitCode = 1;
});
