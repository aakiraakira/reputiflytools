#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWrite, parseCli, publicError, REPO_ROOT } from "./ops-lib.mjs";
import { expectedHostingBuild, HOSTING_APPS } from "./hosting-lib.mjs";

async function main() {
  const args = parseCli(process.argv.slice(2), { check: "boolean", help: "boolean" });
  if (args.help) {
    console.log("Usage: node scripts/leads/generate-hosting.mjs [--check]");
    console.log("Copies deterministic Firebase Hosting artifacts; --check performs no writes.");
    return;
  }
  if (args._.length) throw new Error("Unexpected positional arguments");
  const build = await expectedHostingBuild();
  const manifestPath = path.join(REPO_ROOT, "firebase-leads/hosting/build-manifest.json");

  if (args.check) {
    for (const [name, app] of Object.entries(HOSTING_APPS)) {
      let actual;
      try {
        actual = await readFile(app.output, "utf8");
      } catch {
        throw new Error(`${name}: generated artifact is missing; run without --check`);
      }
      if (actual !== build.targets[name].html) throw new Error(`${name}: generated artifact is stale`);
    }
    const actualManifest = await readFile(manifestPath, "utf8").catch(() => "");
    if (actualManifest !== build.manifestText) throw new Error("hosting build manifest is missing or stale");
    console.log("Hosting artifacts are deterministic and current (2/2).");
    return;
  }

  for (const [name, app] of Object.entries(HOSTING_APPS)) {
    await atomicWrite(app.output, build.targets[name].html, 0o644);
  }
  await atomicWrite(manifestPath, build.manifestText, 0o644);
  console.log("Generated Firebase Hosting artifacts (2/2) and build-manifest.json.");
}

main().catch((error) => {
  console.error(`ERROR: ${publicError(error)}`);
  process.exitCode = 1;
});
