import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  ActivePhoneClaimsMigrationBlockedError,
  migrateActivePhoneClaims,
} from "./active-phone-claims-migration";

interface Arguments {
  projectId: string;
  apply: boolean;
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2));
  initializeApp({ credential: applicationDefault(), projectId: arguments_.projectId });
  try {
    const report = await migrateActivePhoneClaims(getFirestore(), { apply: arguments_.apply });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    if (error instanceof ActivePhoneClaimsMigrationBlockedError) {
      process.stderr.write(`${error.message}\n${JSON.stringify(error.report, null, 2)}\n`);
      process.exitCode = 2;
      return;
    }
    throw error;
  }
}

function parseArguments(values: string[]): Arguments {
  let projectId = "";
  let applyConfirmation = "";
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--project") {
      projectId = values[index + 1] ?? "";
      index += 1;
    } else if (value === "--apply") {
      applyConfirmation = values[index + 1] ?? "";
      index += 1;
    } else {
      throw new Error(`Unknown migration argument: ${value ?? ""}`);
    }
  }
  if (!/^[a-z][a-z0-9-]{4,29}$/.test(projectId)) {
    throw new Error("Pass the explicit Firebase project with --project <project-id>.");
  }
  if (applyConfirmation && applyConfirmation !== projectId) {
    throw new Error("--apply must be followed by the same explicit project id.");
  }
  return { projectId, apply: applyConfirmation === projectId };
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown migration failure";
  process.stderr.write(`Active phone claim migration failed: ${message}\n`);
  process.exitCode = 1;
});
