#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { HOSTING_APPS, validateHostingHtml } from "./hosting-lib.mjs";
import { publicError } from "./ops-lib.mjs";

function inlineScripts(html) {
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    if (/\bsrc\s*=/.test(match[1])) continue;
    scripts.push({ module: /\btype\s*=\s*["']module["']/i.test(match[1]), source: match[2] });
  }
  return scripts;
}

function assertUniqueIds(name, html) {
  const staticMarkup = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const seen = new Set();
  const duplicates = new Set();
  for (const match of staticMarkup.matchAll(/<[^>]+\sid\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    if (seen.has(match[1])) duplicates.add(match[1]);
    seen.add(match[1]);
  }
  if (duplicates.size) throw new Error(`${name}: duplicate static HTML id(s): ${[...duplicates].join(", ")}`);
}

async function syntaxCheck(name, html, temporaryDirectory) {
  const scripts = inlineScripts(html);
  if (!scripts.length) throw new Error(`${name}: no inline scripts discovered`);
  for (let index = 0; index < scripts.length; index += 1) {
    const script = scripts[index];
    const file = path.join(temporaryDirectory, `${name}-${index}.${script.module ? "mjs" : "cjs"}`);
    await writeFile(file, script.source);
    const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (check.status !== 0) {
      const firstDiagnostic = String(check.stderr || check.stdout || "syntax error").split("\n").find(Boolean);
      throw new Error(`${name}: inline script ${index + 1}/${scripts.length} failed syntax check (${firstDiagnostic})`);
    }
  }
  return scripts.length;
}

async function main() {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "rfly-leads-static-"));
  try {
    for (const [name, app] of Object.entries(HOSTING_APPS)) {
      const [source, generated] = await Promise.all([readFile(app.source, "utf8"), readFile(app.output, "utf8")]);
      validateHostingHtml(name, generated, { compareToSource: source });
      assertUniqueIds(name, source);
      const scriptCount = await syntaxCheck(name, source, temporaryDirectory);
      console.log(`[PASS] ${name}: ${scriptCount} inline script(s), unique static IDs, generated content contract`);
    }
    console.log("Static frontend tests passed (2/2).");
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`ERROR: ${publicError(error)}`);
  process.exitCode = 1;
});
