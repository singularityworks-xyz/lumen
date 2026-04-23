import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { main, mergeLcovContents } from "./merge-lcov";

describe("mergeLcovContents", () => {
  test("merges line hits from multiple reports", () => {
    const merged = mergeLcovContents([
      [
        "TN:",
        "SF:/repo/apps/web/src/app.ts",
        "DA:1,1",
        "DA:2,0",
        "LF:2",
        "LH:1",
        "end_of_record",
      ].join("\n"),
      [
        "TN:",
        "SF:/repo/apps/web/src/app.ts",
        "DA:2,3",
        "DA:3,1",
        "LF:2",
        "LH:2",
        "end_of_record",
      ].join("\n"),
    ]);

    expect(merged).toContain("SF:/repo/apps/web/src/app.ts");
    expect(merged).toContain("DA:1,1");
    expect(merged).toContain("DA:2,3");
    expect(merged).toContain("DA:3,1");
    expect(merged).toContain("LF:3");
    expect(merged).toContain("LH:3");
  });
});

describe("main", () => {
  let rootDir = "";

  afterEach(() => {
    if (rootDir) {
      rmSync(rootDir, { recursive: true, force: true });
      rootDir = "";
    }
  });

  test("writes merged lcov output", () => {
    rootDir = mkdtempSync(join(tmpdir(), "lumen-merge-lcov-"));

    const inputA = join(rootDir, "a.lcov.info");
    const inputB = join(rootDir, "b.lcov.info");
    const output = join(rootDir, "out", "merged.lcov.info");

    writeFileSync(
      inputA,
      [
        "TN:",
        "SF:/repo/packages/db/src/lib/file.ts",
        "DA:10,1",
        "LF:1",
        "LH:1",
        "end_of_record",
      ].join("\n")
    );
    writeFileSync(
      inputB,
      [
        "TN:",
        "SF:/repo/packages/db/src/lib/file.ts",
        "DA:10,2",
        "DA:11,0",
        "LF:2",
        "LH:1",
        "end_of_record",
      ].join("\n")
    );

    const exitCode = main(["--output", output, inputA, inputB]);
    const content = readFileSync(output, "utf8");

    expect(exitCode).toBe(0);
    expect(content).toContain("SF:/repo/packages/db/src/lib/file.ts");
    expect(content).toContain("DA:10,3");
    expect(content).toContain("DA:11,0");
    expect(content).toContain("LF:2");
    expect(content).toContain("LH:1");
  });
});
