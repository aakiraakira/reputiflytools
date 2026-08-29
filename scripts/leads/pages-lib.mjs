import { readFile } from "node:fs/promises";
import path from "node:path";
import { API_BASE, PROJECT_ID, REPO_ROOT, sha256 } from "./ops-lib.mjs";

export const PAGES_WATCHLIST_URL = "https://reputifly.org/watchlist/";
export const PAGES_DIGEST_URL = "https://reputifly.org/daily-digest/";

export const PAGES_APPS = Object.freeze({
  watchlist: Object.freeze({
    source: path.join(REPO_ROOT, "firebase-leads/apps/watchlist/index.html"),
    output: path.join(REPO_ROOT, "watchlist/index.html"),
    selfUrl: PAGES_WATCHLIST_URL,
    crossLink: PAGES_DIGEST_URL,
    label: "Daily Digest",
  }),
  "daily-digest": Object.freeze({
    source: path.join(REPO_ROOT, "firebase-leads/apps/daily-digest/index.html"),
    output: path.join(REPO_ROOT, "daily-digest/index.html"),
    selfUrl: PAGES_DIGEST_URL,
    crossLink: PAGES_WATCHLIST_URL,
    label: "Watchlist",
  }),
});

const FIREBASE_APP_LINKS = Object.freeze([
  ["https://watchlist-v2.web.app/", PAGES_WATCHLIST_URL],
  ["https://watchlist-v2.web.app", PAGES_WATCHLIST_URL],
  ["https://daily-digest-v2.web.app/", PAGES_DIGEST_URL],
  ["https://daily-digest-v2.web.app", PAGES_DIGEST_URL],
]);

export function renderPagesHtml(source) {
  let rendered = source;
  for (const [firebaseUrl, pagesUrl] of FIREBASE_APP_LINKS) {
    rendered = rendered.split(firebaseUrl).join(pagesUrl);
  }
  return rendered;
}

export function validatePagesHtml(name, html, { compareToSource } = {}) {
  const app = PAGES_APPS[name];
  if (!app) throw new Error(`Unknown GitHub Pages app '${name}'`);
  const failures = [];
  if (!/^<!doctype html>/i.test(html.trimStart())) failures.push("missing HTML doctype");
  if (!/<\/html>\s*$/i.test(html)) failures.push("missing closing html tag");
  if (Buffer.byteLength(html) < 20_000) failures.push("unexpectedly small HTML artifact");
  if (!html.includes(API_BASE)) failures.push(`missing API base ${API_BASE}`);
  if (!html.includes(PROJECT_ID)) failures.push(`missing project marker ${PROJECT_ID}`);
  if (!html.includes(`href="${app.selfUrl}"`)) failures.push("missing canonical self-link");
  if (!html.includes(`href="${app.crossLink}"`)) {
    failures.push(`missing canonical ${app.label} cross-link`);
  }
  if (/href=["']https:\/\/(?:watchlist-v2|daily-digest-v2)\.web\.app\/?["']/i.test(html)) {
    failures.push("Firebase Hosting app link is still present");
  }
  if (/script\.google\.com|google\.script\.run|googleusercontent\.com\/macros\/|\/macros\/s\//i.test(html)) {
    failures.push("legacy Apps Script transport is still present");
  }
  if (/\bjsonp\b|mode\s*:\s*["']no-cors["']|[?&](?:t|token|idToken)=|window\.__ENDPOINT|\b(?:var|let|const)\s+ENDPOINT\b/i.test(html)) {
    failures.push("legacy opaque transport is still present");
  }
  if (!/Authorization\s*=\s*["']Bearer ["']\s*\+\s*token/.test(html)) {
    failures.push("missing bearer-token API transport");
  }
  if (/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(html)) failures.push("private key material is present");
  if (/\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/.test(html)) {
    failures.push("Telegram bot-token-like material is present");
  }
  if (compareToSource) {
    const expected = renderPagesHtml(compareToSource);
    if (!Buffer.from(html).equals(Buffer.from(expected))) {
      failures.push("bytes differ from the deterministic source transformation");
    }
  }
  if (failures.length) throw new Error(`${name}: ${failures.join("; ")}`);
}

export async function expectedPagesBuild() {
  const targets = {};
  for (const [name, app] of Object.entries(PAGES_APPS)) {
    const source = await readFile(app.source, "utf8");
    const html = renderPagesHtml(source);
    validatePagesHtml(name, html, { compareToSource: source });
    targets[name] = {
      source: path.relative(REPO_ROOT, app.source),
      output: path.relative(REPO_ROOT, app.output),
      sourceBytes: Buffer.byteLength(source),
      outputBytes: Buffer.byteLength(html),
      sourceSha256: sha256(source),
      outputSha256: sha256(html),
      html,
    };
  }
  return { targets };
}
