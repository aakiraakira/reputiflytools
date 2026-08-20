#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { API_BASE, parseCli, publicError, sha256 } from "./ops-lib.mjs";
import { HOSTING_APPS, validateHostingHeaders, validateHostingHtml } from "./hosting-lib.mjs";

function help() {
  console.log(`Usage:
  node scripts/leads/verify-deployment.mjs [--app all|watchlist|daily-digest]
      [--watchlist-url URL] [--daily-digest-url URL]

Fetches Firebase Hosting with a deterministic cache buster and requires the
served, decoded index bytes to exactly match the locally generated artifact.`);
}

function checkedUrl(value, fallback) {
  const url = new URL(value || fallback);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error("Hosting verification URL must use HTTPS except on localhost");
  return url;
}

async function verify(name, configuredUrl, timeoutMs) {
  const app = HOSTING_APPS[name];
  const localBytes = await readFile(app.output);
  const localSha = sha256(localBytes);
  const url = checkedUrl(configuredUrl, app.url);
  url.searchParams.set("rfly_verify", localSha.slice(0, 16));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "text/html", "Cache-Control": "no-cache" },
      redirect: "error",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`${name}: hosting returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) throw new Error(`${name}: hosting did not return text/html`);
  validateHostingHeaders((header) => response.headers.get(header), `${name} served headers`);
  const servedBytes = Buffer.from(await response.arrayBuffer());
  const servedSha = sha256(servedBytes);
  if (servedSha !== localSha) {
    throw new Error(`${name}: served SHA ${servedSha} differs from generated SHA ${localSha}; do not cut over`);
  }
  validateHostingHtml(name, servedBytes.toString("utf8"));
  console.log(`[PASS] ${name}: served ${servedBytes.length} bytes sha256=${servedSha}`);
}

async function main() {
  const args = parseCli(process.argv.slice(2), {
    app: "string",
    "watchlist-url": "string",
    "daily-digest-url": "string",
    "timeout-ms": "string",
    help: "boolean",
  });
  if (args.help) return help();
  if (args._.length) throw new Error("Unexpected positional arguments");
  const selected = args.app || "all";
  if (!["all", ...Object.keys(HOSTING_APPS)].includes(selected)) throw new Error("--app must be all, watchlist, or daily-digest");
  const timeoutMs = Number(args["timeout-ms"] || 20_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error("--timeout-ms must be 1000..60000");
  const names = selected === "all" ? Object.keys(HOSTING_APPS) : [selected];
  for (const name of names) {
    await verify(name, args[`${name}-url`], timeoutMs);
  }
  console.log(`Deployment SHA verification passed (${names.length}/${names.length}); API base expected at ${new URL(API_BASE).host}.`);
}

main().catch((error) => {
  console.error(`ERROR: ${publicError(error)}`);
  process.exitCode = 1;
});
