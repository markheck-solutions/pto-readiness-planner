import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { safeReadText } from "../../scripts/demo-safety-scan";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pto-safety-scan-"));
}

function withTempDir<T>(runTest: (tempDir: string) => T) {
  const tempDir = makeTempDir();
  try {
    return runTest(tempDir);
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true });
  }
}

describe("demo safety scan file reading", () => {
  it("reads a small text file through the safety scan reader", () => {
    withTempDir((tempDir) => {
      const filePath = path.join(tempDir, "sample.txt");
      fs.writeFileSync(filePath, "safe demo text", "utf8");

      expect(safeReadText(filePath)).toBe("safe demo text");
    });
  });

  it("skips directories instead of reading through a path", () => {
    withTempDir((tempDir) => {
      expect(safeReadText(tempDir)).toBeNull();
    });
  });

  it("skips missing files", () => {
    withTempDir((tempDir) => {
      const filePath = path.join(tempDir, "missing.txt");

      expect(safeReadText(filePath)).toBeNull();
    });
  });
});
