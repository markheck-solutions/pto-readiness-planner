import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { Client, type ClientBase } from "pg";
import ts from "typescript";

import {
  bootstrapDemoSchema,
  DEMO_DATASET_ROW_ID,
  DEMO_SCHEMA,
  getSchemaBootstrapSql,
  seedDemoDataset,
  type DemoSeedResult,
} from "../src/db/seed";

type SqlStatement = {
  id: string;
  file: string;
  line: number;
  source: string;
  canonicalSql: string;
};

type SqlSink = {
  file: string;
  line: number;
  receiver: string;
  argument: string;
  classification: "static-sql" | "bootstrap-sql" | "unresolved";
  sqlId?: string;
  reason?: string;
};

type DependencyEdge = {
  from: string;
  to: string;
  importKind: "type" | "value";
  names: string[];
};

export type SqlSupportabilityManifest = {
  sourceFiles: string[];
  sqlStatements: SqlStatement[];
  sinks: SqlSink[];
  dependencyEdges: DependencyEdge[];
  hashes: {
    sql: string;
    sinks: string;
    dependencyGraph: string;
  };
};

type TableCountSpec = {
  table: string;
  resultKey: keyof DemoSeedResult["counts"];
};

const SQL_SOURCE_FILES = ["src/db/seed.ts", "scripts/db-seed.ts"];

const TABLE_COUNT_SPECS: TableCountSpec[] = [
  { table: "teams", resultKey: "teams" },
  { table: "roles", resultKey: "roles" },
  { table: "employees", resultKey: "employees" },
  { table: "coverage_requirements", resultKey: "coverageRequirements" },
  { table: "critical_windows", resultKey: "criticalWindows" },
  { table: "existing_absences", resultKey: "existingAbsences" },
  { table: "fairness_history", resultKey: "fairnessHistory" },
  { table: "pto_requests", resultKey: "ptoRequests" },
  { table: "seed_scenarios", resultKey: "scenarios" },
];

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

function canonicalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

function sha256Json(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function readSource(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

function parseSource(filePath: string) {
  return ts.createSourceFile(
    filePath,
    readSource(filePath),
    ts.ScriptTarget.Latest,
    true,
  );
}

function getLine(sourceFile: ts.SourceFile, node: ts.Node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

function isQueryCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "query"
  );
}

function substituteTemplateExpression(node: ts.TemplateExpression) {
  let sql = node.head.text;

  for (const span of node.templateSpans) {
    const expressionText = span.expression.getText();
    if (expressionText !== "DEMO_SCHEMA") return null;
    sql += DEMO_SCHEMA;
    sql += span.literal.text;
  }

  return sql;
}

function getStaticSqlText(node: ts.Expression) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (ts.isTemplateExpression(node)) {
    return substituteTemplateExpression(node);
  }

  return null;
}

function resolveImportTarget(fromFile: string, specifier: string) {
  if (!specifier.startsWith(".")) return specifier;

  const fromDir = path.dirname(fromFile);
  const resolved = normalizePath(path.normalize(path.join(fromDir, specifier)));
  const tsPath = `${resolved}.ts`;

  return fs.existsSync(tsPath) ? tsPath : resolved;
}

function getImportNames(node: ts.ImportDeclaration) {
  const clause = node.importClause;
  if (!clause) return [];

  const names: string[] = [];
  if (clause.name) names.push(clause.name.text);

  const namedBindings = clause.namedBindings;
  if (namedBindings && ts.isNamedImports(namedBindings)) {
    names.push(...namedBindings.elements.map((element) => element.name.text));
  }

  return names.sort();
}

function collectDependencyEdges(filePath: string) {
  const sourceFile = parseSource(filePath);
  const edges: DependencyEdge[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;

    edges.push({
      from: normalizePath(filePath),
      to: resolveImportTarget(filePath, statement.moduleSpecifier.text),
      importKind: statement.importClause?.isTypeOnly ? "type" : "value",
      names: getImportNames(statement),
    });
  }

  return edges;
}

function addBootstrapStatements(
  filePath: string,
  line: number,
  statements: SqlStatement[],
) {
  getSchemaBootstrapSql().forEach((sql, index) => {
    statements.push({
      id: `${filePath}:bootstrap:${index + 1}`,
      file: filePath,
      line,
      source: "getSchemaBootstrapSql",
      canonicalSql: canonicalizeSql(sql),
    });
  });
}

function classifyQueryCall(
  filePath: string,
  sourceFile: ts.SourceFile,
  node: ts.CallExpression,
  statements: SqlStatement[],
  bootstrapAdded: boolean,
) {
  const line = getLine(sourceFile, node);
  const expression = node.expression as ts.PropertyAccessExpression;
  const receiver = expression.expression.getText(sourceFile);
  const argument = node.arguments[0];

  if (!argument) {
    return {
      bootstrapAdded,
      sink: {
        file: filePath,
        line,
        receiver,
        argument: "<missing>",
        classification: "unresolved" as const,
        reason: "query call has no SQL argument",
      },
    };
  }

  if (ts.isIdentifier(argument) && argument.text === "stmt") {
    if (!bootstrapAdded) addBootstrapStatements(filePath, line, statements);

    return {
      bootstrapAdded: true,
      sink: {
        file: filePath,
        line,
        receiver,
        argument: argument.getText(sourceFile),
        classification: "bootstrap-sql" as const,
        sqlId: `${filePath}:bootstrap:*`,
      },
    };
  }

  const sqlText = getStaticSqlText(argument);
  if (sqlText === null) {
    return {
      bootstrapAdded,
      sink: {
        file: filePath,
        line,
        receiver,
        argument: argument.getText(sourceFile),
        classification: "unresolved" as const,
        reason: "SQL argument is not a static string or approved template",
      },
    };
  }

  const id = `${filePath}:${line}`;
  statements.push({
    id,
    file: filePath,
    line,
    source: "query",
    canonicalSql: canonicalizeSql(sqlText),
  });

  return {
    bootstrapAdded,
    sink: {
      file: filePath,
      line,
      receiver,
      argument: argument.getText(sourceFile),
      classification: "static-sql" as const,
      sqlId: id,
    },
  };
}

function collectQuerySinks(filePath: string) {
  const sourceFile = parseSource(filePath);
  const statements: SqlStatement[] = [];
  const sinks: SqlSink[] = [];
  let bootstrapAdded = false;

  function visit(node: ts.Node) {
    if (isQueryCall(node)) {
      const result = classifyQueryCall(
        filePath,
        sourceFile,
        node,
        statements,
        bootstrapAdded,
      );
      bootstrapAdded = result.bootstrapAdded;
      sinks.push(result.sink);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { statements, sinks };
}

function buildManifest(
  statements: SqlStatement[],
  sinks: SqlSink[],
  dependencyEdges: DependencyEdge[],
): SqlSupportabilityManifest {
  const sqlStatements = [...statements].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const sortedSinks = [...sinks].sort((a, b) =>
    `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`),
  );
  const sortedEdges = [...dependencyEdges].sort((a, b) =>
    `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`),
  );

  return {
    sourceFiles: SQL_SOURCE_FILES,
    sqlStatements,
    sinks: sortedSinks,
    dependencyEdges: sortedEdges,
    hashes: {
      sql: sha256Json(sqlStatements),
      sinks: sha256Json(sortedSinks),
      dependencyGraph: sha256Json(sortedEdges),
    },
  };
}

export function discoverSqlSupportability(): SqlSupportabilityManifest {
  const statements: SqlStatement[] = [];
  const sinks: SqlSink[] = [];
  const dependencyEdges: DependencyEdge[] = [];

  for (const filePath of SQL_SOURCE_FILES) {
    const discovered = collectQuerySinks(filePath);
    statements.push(...discovered.statements);
    sinks.push(...discovered.sinks);
    dependencyEdges.push(...collectDependencyEdges(filePath));
  }

  return buildManifest(statements, sinks, dependencyEdges);
}

function assertManifestSupported(manifest: SqlSupportabilityManifest) {
  const unresolved = manifest.sinks.filter(
    (sink) => sink.classification === "unresolved",
  );
  if (unresolved.length > 0) {
    throw new Error(
      `Unresolved SQL query sinks: ${unresolved
        .map((sink) => `${sink.file}:${sink.line}`)
        .join(", ")}`,
    );
  }

  if (manifest.sqlStatements.length === 0) {
    throw new Error("No SQL statements were extracted.");
  }
}

function getSqlGateDatabaseUrl() {
  const url = (process.env.SQL_GATE_DATABASE_URL ?? "").trim();
  if (!url) {
    throw new Error("SQL_GATE_DATABASE_URL is required for npm run sql:check.");
  }
  return url;
}

async function runSeedTransaction(db: ClientBase) {
  await db.query("BEGIN");
  try {
    await bootstrapDemoSchema(db);
    const result = await seedDemoDataset(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

async function readTableCount(db: ClientBase, table: string) {
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*)::integer AS count FROM ${DEMO_SCHEMA}.${table};`,
  );
  return result.rows[0]?.count ?? 0;
}

async function verifySeedCounts(db: ClientBase, seedResult: DemoSeedResult) {
  const counts: Record<string, number> = {};

  for (const spec of TABLE_COUNT_SPECS) {
    const actual = await readTableCount(db, spec.table);
    const expected = seedResult.counts[spec.resultKey];
    if (actual !== expected) {
      throw new Error(
        `Count mismatch for ${spec.table}: expected ${expected}, got ${actual}`,
      );
    }
    counts[spec.table] = actual;
  }

  return counts;
}

async function verifyDatasetFingerprint(
  db: ClientBase,
  seedResult: DemoSeedResult,
) {
  const result = await db.query<{
    dataset_version: string;
    seed_fingerprint: string;
  }>(
    `SELECT dataset_version, seed_fingerprint
       FROM ${DEMO_SCHEMA}.demo_dataset
      WHERE id = $1;`,
    [DEMO_DATASET_ROW_ID],
  );
  const row = result.rows[0];

  if (!row) throw new Error("Missing demo_dataset fingerprint row.");
  if (row.dataset_version !== seedResult.datasetVersion) {
    throw new Error("Dataset version mismatch after seed.");
  }
  if (row.seed_fingerprint !== seedResult.seedFingerprint) {
    throw new Error("Dataset fingerprint mismatch after seed.");
  }
}

function assertIdempotentCounts(
  firstCounts: Record<string, number>,
  secondCounts: Record<string, number>,
) {
  const first = JSON.stringify(firstCounts);
  const second = JSON.stringify(secondCounts);
  if (first !== second) {
    throw new Error(`Seed is not idempotent. first=${first} second=${second}`);
  }
}

async function runSqlBehaviorProof() {
  const client = new Client({ connectionString: getSqlGateDatabaseUrl() });
  await client.connect();

  try {
    const firstSeed = await runSeedTransaction(client);
    const firstCounts = await verifySeedState(client, firstSeed);
    const secondSeed = await runSeedTransaction(client);
    const secondCounts = await verifySeedState(client, secondSeed);
    assertIdempotentCounts(firstCounts, secondCounts);

    return {
      datasetVersion: secondSeed.datasetVersion,
      seedFingerprint: secondSeed.seedFingerprint,
      counts: secondCounts,
    };
  } finally {
    await client.end();
  }
}

async function verifySeedState(db: ClientBase, seedResult: DemoSeedResult) {
  const counts = await verifySeedCounts(db, seedResult);
  await verifyDatasetFingerprint(db, seedResult);
  const datasetRows = await readTableCount(db, "demo_dataset");

  if (datasetRows !== 1) {
    throw new Error(`demo_dataset row count mismatch: ${datasetRows}`);
  }

  return { ...counts, demo_dataset: datasetRows };
}

function printManifest(manifest: SqlSupportabilityManifest) {
  console.log(`SQL source files: ${manifest.sourceFiles.join(", ")}`);
  console.log(`SQL query sinks: ${manifest.sinks.length}`);
  console.log(`Extracted SQL statements: ${manifest.sqlStatements.length}`);
  console.log(`SQL hash: ${manifest.hashes.sql}`);
  console.log(`Sink hash: ${manifest.hashes.sinks}`);
  console.log(`Dependency graph hash: ${manifest.hashes.dependencyGraph}`);
}

function printStatuses(
  gateImplementation: "PASS" | "FAIL",
  repoSqlSupportability: "PASS" | "FAIL",
  sqlBehaviorProof: "PASS" | "FAIL",
) {
  console.log(`Gate implementation: ${gateImplementation}`);
  console.log(`Repo SQL supportability: ${repoSqlSupportability}`);
  console.log(`SQL behavior proof: ${sqlBehaviorProof}`);
}

async function runMain() {
  let gateImplementation: "PASS" | "FAIL" = "FAIL";
  let repoSqlSupportability: "PASS" | "FAIL" = "FAIL";
  let sqlBehaviorProof: "PASS" | "FAIL" = "FAIL";

  try {
    const manifest = discoverSqlSupportability();
    assertManifestSupported(manifest);
    gateImplementation = "PASS";
    printManifest(manifest);

    const proof = await runSqlBehaviorProof();
    sqlBehaviorProof = "PASS";
    repoSqlSupportability = "PASS";

    console.log(`Dataset version: ${proof.datasetVersion}`);
    console.log(`Dataset fingerprint: ${proof.seedFingerprint}`);
    console.log(`Verified counts: ${JSON.stringify(proof.counts)}`);
    printStatuses(gateImplementation, repoSqlSupportability, sqlBehaviorProof);
  } catch (error: unknown) {
    printStatuses(gateImplementation, repoSqlSupportability, sqlBehaviorProof);
    console.error(error instanceof Error ? error.message : "sql check failed");
    process.exitCode = 1;
  }
}

function isEntrypoint() {
  const scriptPath = process.argv[1];
  if (!scriptPath) return false;
  return import.meta.url === pathToFileURL(path.resolve(scriptPath)).href;
}

if (isEntrypoint()) {
  void runMain();
}
