import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  expectedPagesBuild,
  PAGES_APPS,
  PAGES_DIGEST_URL,
  PAGES_WATCHLIST_URL,
  renderPagesHtml,
  validatePagesHtml,
} from "../pages-lib.mjs";

test("Pages transform changes only Firebase app links", () => {
  const source = [
    '<a href="https://watchlist-v2.web.app/">W</a>',
    '<a href="https://daily-digest-v2.web.app/">D</a>',
    "<script>const untouched='https://example.com/'</script>",
  ].join("");
  assert.equal(
    renderPagesHtml(source),
    [
      `<a href="${PAGES_WATCHLIST_URL}">W</a>`,
      `<a href="${PAGES_DIGEST_URL}">D</a>`,
      "<script>const untouched='https://example.com/'</script>",
    ].join(""),
  );
});

test("tracked Pages apps exactly match the frozen Firebase sources", async () => {
  const build = await expectedPagesBuild();
  for (const [name, app] of Object.entries(PAGES_APPS)) {
    const actual = await readFile(app.output, "utf8");
    assert.equal(actual, build.targets[name].html, `${name} tracked output is stale`);
    assert.doesNotThrow(() => validatePagesHtml(name, actual));
  }
});

test("Pages validation rejects legacy Apps Script transport and Firebase app links", async () => {
  const build = await expectedPagesBuild();
  const watchlist = build.targets.watchlist.html;
  assert.throws(
    () => validatePagesHtml("watchlist", watchlist.replace("</head>", '<script src="https://script.google.com/macros/s/legacy/exec"></script></head>')),
    /legacy Apps Script transport/,
  );
  assert.throws(
    () => validatePagesHtml("watchlist", watchlist.replace(PAGES_DIGEST_URL, "https://daily-digest-v2.web.app/")),
    /canonical Daily Digest cross-link|Firebase Hosting app link/,
  );
  for (const marker of [
    "function jsonp(){}",
    "fetch(url,{mode:'no-cors'})",
    "const url='/session?idToken=secret'",
    "window.__ENDPOINT='/legacy'",
    "const ENDPOINT='/legacy'",
  ]) {
    assert.throws(
      () => validatePagesHtml("watchlist", watchlist.replace("</body>", `<script>${marker}</script></body>`)),
      /legacy opaque transport/,
    );
  }
});

test("CI checks tracked Pages bytes and keeps both read-only production verifiers", async () => {
  const workflow = await readFile(new URL("../../../.github/workflows/leads.yml", import.meta.url), "utf8");
  const pagesGenerationCommands = [...workflow.matchAll(/node scripts\/leads\/generate-pages\.mjs([^\n]*)/g)];
  assert.ok(pagesGenerationCommands.length >= 2);
  assert.ok(
    pagesGenerationCommands.every((match) => match[1].includes("--check")),
    "CI must not regenerate tracked Pages files before checking them",
  );
  assert.match(workflow, /node scripts\/leads\/verify-deployment\.mjs/);
  assert.match(workflow, /node scripts\/leads\/verify-pages\.mjs/);
});
