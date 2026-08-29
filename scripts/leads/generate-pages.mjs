#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { atomicWrite, parseCli, publicError } from "./ops-lib.mjs";
import { expectedPagesBuild, PAGES_APPS } from "./pages-lib.mjs";

async function main() {
  const args = parseCli(process.argv.slice(2), { check: "boolean", help: "boolean" });
  if (args.help) {
    console.log("Usage: node scripts/leads/generate-pages.mjs [--check]");
    console.log("Generates tracked GitHub Pages apps; --check performs no writes.");
    return;
  }
  if (args._.length) throw new Error("Unexpected positional arguments");

  const build = await expectedPagesBuild();
  if (args.check) {
    for (const [name, app] of Object.entries(PAGES_APPS)) {
      const actual = await readFile(app.output, "utf8").catch(() => null);
      if (actual === null) throw new Error(`${name}: tracked Pages artifact is missing; run without --check`);
      if (actual !== build.targets[name].html) {
        throw new Error(`${name}: tracked Pages artifact is stale; run without --check`);
      }
    }
    console.log("Tracked GitHub Pages artifacts are deterministic and current (2/2).");
    return;
  }

  for (const [name, app] of Object.entries(PAGES_APPS)) {
    await atomicWrite(app.output, build.targets[name].html, 0o644);
    console.log(`[GENERATED] ${build.targets[name].output} sha256=${build.targets[name].outputSha256}`);
  }
}

main().catch((error) => {
  console.error(`ERROR: ${publicError(error)}`);
  process.exitCode = 1;
});
