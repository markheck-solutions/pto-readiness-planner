import { describe, expect, it } from "vitest";

import { discoverSqlSupportability } from "../../scripts/sql-supportability-check";

describe("sql supportability discovery", () => {
  it("extracts seed SQL, sinks, and dependency graph without unresolved query sinks", () => {
    const manifest = discoverSqlSupportability();

    expect(manifest.sourceFiles).toEqual([
      "src/db/seed.ts",
      "scripts/db-seed.ts",
    ]);
    expect(manifest.sqlStatements.length).toBeGreaterThan(20);
    expect(manifest.sinks.length).toBeGreaterThan(20);
    expect(
      manifest.sinks.filter((sink) => sink.classification === "unresolved"),
    ).toEqual([]);
    expect(manifest.dependencyEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "scripts/db-seed.ts",
          to: "src/db/seed.ts",
        }),
        expect.objectContaining({
          from: "src/db/seed.ts",
          to: "src/demo/dataset.ts",
        }),
      ]),
    );
    expect(manifest.hashes.sql).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.hashes.sinks).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.hashes.dependencyGraph).toMatch(/^[a-f0-9]{64}$/);
  });
});
