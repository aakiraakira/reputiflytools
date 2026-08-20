import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  API_BASE,
  DIGEST_URL,
  PROJECT_ID,
  REPO_ROOT,
  WATCHLIST_URL,
  sha256,
  stableJson,
} from "./ops-lib.mjs";

export const HOSTING_APPS = {
  watchlist: {
    source: path.join(REPO_ROOT, "watchlist/index.html"),
    output: path.join(REPO_ROOT, "firebase-leads/hosting/watchlist/index.html"),
    url: WATCHLIST_URL,
    crossLink: DIGEST_URL,
    oldCrossLink: "https://reputifly.org/daily-digest/",
    label: "Daily Digest",
  },
  "daily-digest": {
    source: path.join(REPO_ROOT, "daily-digest/index.html"),
    output: path.join(REPO_ROOT, "firebase-leads/hosting/daily-digest/index.html"),
    url: DIGEST_URL,
    crossLink: WATCHLIST_URL,
    oldCrossLink: "https://reputifly.org/watchlist/",
    label: "Watchlist",
  },
};

export const REQUIRED_HOSTING_HEADERS = Object.freeze({
  "cache-control": "no-cache, no-store, must-revalidate",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy": "frame-ancestors 'none'",
});

export function validateHostingHeaders(getHeader, label = "hosting") {
  const failures = [];
  for (const [name, expected] of Object.entries(REQUIRED_HOSTING_HEADERS)) {
    const actual = getHeader(name);
    if (actual !== expected) failures.push(`${name} expected '${expected}' but received '${actual || "<missing>"}'`);
  }
  if (failures.length) throw new Error(`${label}: ${failures.join("; ")}`);
}

export function validateFirebaseHostingConfig(config) {
  const sites = Array.isArray(config?.hosting) ? config.hosting : [];
  const expectedTargets = {
    watchlist: "hosting/watchlist",
    "watchlist-legacy": "hosting/watchlist",
    digest: "hosting/daily-digest",
    "digest-legacy": "hosting/daily-digest",
  };
  for (const [target, publicDir] of Object.entries(expectedTargets)) {
    const site = sites.find((entry) => entry?.target === target);
    if (!site) throw new Error(`firebase.json: missing Hosting target '${target}'`);
    if (site.public !== publicDir) throw new Error(`firebase.json: '${target}' public directory must be '${publicDir}'`);
    const rule = site.headers?.find((entry) => entry?.source === "**");
    if (!rule || !Array.isArray(rule.headers)) throw new Error(`firebase.json: '${target}' lacks the all-path security header rule`);
    const values = new Map(rule.headers.map((entry) => [String(entry?.key || "").toLowerCase(), entry?.value]));
    validateHostingHeaders((name) => values.get(name), `firebase.json ${target}`);
  }
  return true;
}

const LINK_VARIANTS = [
  ["https://reputifly.org/watchlist/", WATCHLIST_URL],
  ["https://reputifly.org/watchlist", WATCHLIST_URL],
  ["https://reputifly.org/daily-digest/", DIGEST_URL],
  ["https://reputifly.org/daily-digest", DIGEST_URL],
];

export function renderHostingHtml(source) {
  let rendered = source;
  for (const [legacy, replacement] of LINK_VARIANTS) rendered = rendered.split(legacy).join(replacement);
  return rendered;
}

export function validateHostingHtml(name, html, { compareToSource } = {}) {
  const app = HOSTING_APPS[name];
  if (!app) throw new Error(`Unknown hosting app '${name}'`);
  const failures = [];
  if (!/^<!doctype html>/i.test(html.trimStart())) failures.push("missing HTML doctype");
  if (!/<\/html>\s*$/i.test(html)) failures.push("missing closing html tag");
  if (Buffer.byteLength(html) < 20_000) failures.push("unexpectedly small HTML artifact");
  if (!html.includes(API_BASE)) failures.push(`missing API base ${API_BASE}`);
  if (!html.includes(PROJECT_ID)) failures.push(`missing project marker ${PROJECT_ID}`);
  if (!html.includes(`href="${app.crossLink}"`)) failures.push(`missing canonical ${app.label} cross-link`);
  if (html.includes("script.google.com/macros/s/")) failures.push("legacy Apps Script endpoint is still present");
  if (/href=["']https:\/\/reputifly\.org\/(?:watchlist|daily-digest)\/?["']/i.test(html)) {
    failures.push("legacy reputifly.org app cross-link is still present");
  }
  if (/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(html)) failures.push("private key material is present");
  if (/\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/.test(html)) failures.push("Telegram bot-token-like material is present");
  if (/\bAIza[0-9A-Za-z_-]{30,}\b/.test(html)) {
    // Firebase web API keys are intentionally public, and the legacy auth
    // config currently contains one. Only reject key-like content when the
    // source did not already contain it; generation must never introduce one.
    if (compareToSource && !/\bAIza[0-9A-Za-z_-]{30,}\b/.test(compareToSource)) {
      failures.push("generated artifact introduced key-like material");
    }
  }
  if (compareToSource) {
    const expected = renderHostingHtml(compareToSource);
    if (!Buffer.from(html).equals(Buffer.from(expected))) failures.push("bytes differ from the deterministic source transformation");
  }
  if (failures.length) throw new Error(`${name}: ${failures.join("; ")}`);
}

export async function expectedHostingBuild() {
  const targets = {};
  for (const [name, app] of Object.entries(HOSTING_APPS)) {
    const source = await readFile(app.source, "utf8");
    const output = renderHostingHtml(source);
    validateHostingHtml(name, output, { compareToSource: source });
    targets[name] = {
      source: path.relative(REPO_ROOT, app.source),
      output: path.relative(REPO_ROOT, app.output),
      hostingUrl: app.url,
      crossLink: app.crossLink,
      sourceBytes: Buffer.byteLength(source),
      outputBytes: Buffer.byteLength(output),
      sourceSha256: sha256(source),
      outputSha256: sha256(output),
      html: output,
    };
  }
  const publicTargets = Object.fromEntries(
    Object.entries(targets).map(([name, { html: _html, ...target }]) => [name, target]),
  );
  const manifest = {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    apiBase: API_BASE,
    targets: publicTargets,
  };
  return { targets, manifest, manifestText: `${stableJson(manifest, 2)}\n` };
}
