import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const watchlist = readFileSync(path.join(ROOT, "watchlist/index.html"), "utf8");
const digest = readFileSync(path.join(ROOT, "daily-digest/index.html"), "utf8");

function staticMarkup(html) {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

function styles(html) {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join("\n");
}

function count(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function assertUniqueStaticIds(html, label) {
  const ids = [...staticMarkup(html).matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  assert.equal(duplicate, undefined, `${label} must not clone any static DOM ID`);
}

test("desktop layouts are CSS-only views of one mobile DOM", () => {
  const watchMarkup = staticMarkup(watchlist);
  const digestMarkup = staticMarkup(digest);
  assert.equal(count(watchMarkup, /<main\b/gi), 1, "Watchlist has one main DOM");
  assert.equal(count(digestMarkup, /<main\b/gi), 1, "Digest has one main DOM");
  assert.match(watchMarkup, /<main\b[^>]*class=["'][^"']*\bwatch-workspace\b/);
  assert.match(digestMarkup, /<main\b[^>]*class=["'][^"']*\bdigest-workspace\b[^>]*id=["']app["']|<main\b[^>]*id=["']app["'][^>]*class=["'][^"']*\bdigest-workspace\b/);
  assert.equal(count(digestMarkup, /class=["'][^"']*\bdigest-rail\b[^"']*["']/gi), 1, "Digest has one summary/proof rail");
  assert.equal(count(digestMarkup, /class=["'][^"']*\bdigest-editor-section\b[^"']*["']/gi), 4, "Digest reuses four editor sections");
  assertUniqueStaticIds(watchlist, "Watchlist");
  assertUniqueStaticIds(digest, "Digest");

  const watchCss = styles(watchlist);
  const digestCss = styles(digest);
  assert.match(watchCss, /@media\s*\(min-width\s*:\s*1100px\)[\s\S]*?\.wcard\s*\{[^}]*display\s*:\s*grid/i);
  assert.match(digestCss, /@media\s*\(min-width\s*:\s*1100px\)[\s\S]*?\.digest-workspace\s*\{[^}]*display\s*:\s*grid/i);
  assert.match(digestCss, /\.digest-rail\s*\{[^}]*position\s*:\s*sticky/i);
  assert.doesNotMatch(staticMarkup(digest), /desktop[-_ ]only|mobile[-_ ]only/i, "Responsive layout must not fork editor DOM");
});

test("mobile-first invariants and primary action target sizes remain intact", () => {
  for (const [label, html] of [["Watchlist", watchlist], ["Digest", digest]]) {
    const css = styles(html);
    const desktopIndex = css.search(/@media\s*\(min-width\s*:\s*1100px\)/i);
    assert.ok(desktopIndex > 0, `${label} desktop breakpoint exists after base styles`);
    const mobileCss = css.slice(0, desktopIndex);
    assert.match(mobileCss, /\.wrap\s*\{[^}]*max-width\s*:\s*560px/i, `${label} keeps familiar narrow mobile base`);
    assert.match(mobileCss, /\.tabbar\s*\{[^}]*position\s*:\s*fixed/i, `${label} keeps mobile tab bar`);
    assert.match(mobileCss, /\.sheet\s*\{[^}]*position\s*:\s*fixed[^}]*bottom\s*:\s*0/i, `${label} keeps bottom sheet`);
    assert.match(mobileCss, /safe-area-inset-bottom/i, `${label} retains safe-area padding`);
    assert.match(mobileCss, /\.btn\s*\{[^}]*min-height\s*:\s*44px/i, `${label} base buttons meet 44px target`);
    assert.match(mobileCss, /\.input\s*\{[^}]*min-height\s*:\s*44px/i, `${label} inputs meet 44px target`);
    assert.match(mobileCss, /\.optpill\s*\{[^}]*min-height\s*:\s*4[4-9]px/i, `${label} option controls meet 44px target`);
  }
  assert.match(watchlist, /\.wacts\s+\.btn\s*\{[^}]*min-height\s*:\s*44px/i);
  assert.match(watchlist, /\.outcome-grid\s+\.optpill\s*\{[^}]*min-height\s*:\s*44px/i);
});

test("server proof, safe provenance, and neutral accountability hooks are persistent", () => {
  for (const [label, html] of [["Watchlist", watchlist], ["Digest", digest]]) {
    const markup = staticMarkup(html);
    assert.match(markup, /id=["']syncBanner["'][^>]*role=["']status["']/i, `${label} has persistent sync status`);
    assert.match(markup, /id=["']syncSupport["']/i, `${label} has support-only request details`);
    assert.match(html, /envelope\.dataAsOf\s*!==\s*meta\.serverTime/, `${label} requires server as-of proof to match server time`);
    assert.match(html, /meta\.requestId/, `${label} exposes the support request ID`);
    assert.match(html, /function\s+acceptActors\s*\(/, `${label} accepts referenced actor labels`);
    assert.match(html, /function\s+actorLabel\s*\(/, `${label} has neutral unresolved-actor fallback`);
  }
  assert.match(watchlist, /id=["']dailyStatusPanel["']/);
  assert.match(watchlist, />Recorded today</);
  assert.match(watchlist, /Only server-confirmed work/);
  assert.match(watchlist, /["']\/v1\/daily-status["']/);
  assert.match(watchlist, /["']\/v1\/team\/daily-status["']/);
  assert.doesNotMatch(watchlist, /keystroke|screen time|online time|productivity score/i);
});

test("follow-up workflow requires one server receipt before local accounting", () => {
  assert.match(watchlist, /data-log-followup/);
  for (const outcome of ["no_reply", "spoke", "won", "lost"]) {
    assert.match(watchlist, new RegExp(`data-outcome=["']${outcome}["']`));
  }
  assert.equal(count(watchlist, /id=["']followUpCommit["']/g), 1, "Follow-up commit control is one sheet-template ID");
  assert.match(watchlist, /\/v1\/leads\/[^\n]*\/follow-ups/);
  assert.match(watchlist, /headers\s*:\s*\{["']Idempotency-Key["']\s*:\s*item\.key\}/);
  assert.match(watchlist, /var\s+receipt\s*=\s*followUpReceipt\(data,item\)[\s\S]{0,500}applyReceipt\(receipt\.lead\)/);
  assert.match(watchlist, /Follow-up not confirmed[^\n]*no outcome is counted/);
});

test("digest timeline uses canonical acceptance/delivery proof and bounded visibility-aware polling", () => {
  const markup = staticMarkup(digest);
  assert.match(markup, /id=["']deliveryTimeline["']/);
  assert.match(digest, /data\.acceptedAt/);
  assert.match(digest, /data\.acceptedBy/);
  assert.match(digest, /data\.businessDate/);
  assert.match(digest, /(?:data\.digest|digest)\.deliveredAt/);
  assert.match(digest, /(?:data\.digest|digest)\.telegramMessageId/);
  assert.match(digest, /document\.hidden|document\.visibilityState/);
  assert.match(digest, /deliveryPollAttempts\s*>=\s*waits\.length/i);
  assert.doesNotMatch(digest, /lastDeliveryError/i, "Digest UI must not depend on an internal delivery error field");
});
