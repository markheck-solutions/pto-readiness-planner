import { Client } from "pg";

import { demoSeedDataset, DEMO_SEED_FINGERPRINT } from "../src/demo/dataset";
import { bootstrapDemoSchema, seedDemoDataset } from "../src/db/seed";

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  return { dryRun };
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));

  if (dryRun) {
    console.log("Demo seed dry run");
    console.log(`datasetVersion: ${demoSeedDataset.version}`);
    console.log(`seedFingerprint: ${DEMO_SEED_FINGERPRINT}`);
    console.log(
      `counts: ${JSON.stringify(
        {
          teams: demoSeedDataset.teams.length,
          roles: demoSeedDataset.roles.length,
          employees: demoSeedDataset.employees.length,
          coverageRequirements: demoSeedDataset.coverageRequirements.length,
          criticalWindows: demoSeedDataset.criticalWindows.length,
          existingAbsences: demoSeedDataset.existingAbsences.length,
          ptoRequests: demoSeedDataset.ptoRequests.length,
          scenarios: demoSeedDataset.scenarios.length,
        },
        null,
        2,
      )}`,
    );
    return;
  }

  const url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) {
    console.error("DATABASE_URL is required to seed. Set it in .env.local.");
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query("BEGIN");
    await bootstrapDemoSchema(client);
    const result = await seedDemoDataset(client);
    await client.query("COMMIT");

    console.log("Demo seed complete");
    console.log(`datasetVersion: ${result.datasetVersion}`);
    console.log(`seedFingerprint: ${result.seedFingerprint}`);
    console.log(`counts: ${JSON.stringify(result.counts, null, 2)}`);
  } catch (err: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failures
    }
    const msg = err instanceof Error ? err.message : "db seed failed";
    console.error(msg);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : "db seed failed";
  console.error(msg);
  process.exitCode = 1;
});
