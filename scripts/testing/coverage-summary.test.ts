import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildCoverageSummary,
  parseLcov,
  renderCoverageSummary,
  summarizeCoverage,
} from "./coverage-summary";

describe("parseLcov", () => {
  test("parses LCOV records", () => {
    const records = parseLcov(`
TN:
SF:/repo/apps/web/src/app.ts
LF:10
LH:7
end_of_record
`);

    expect(records).toEqual([
      {
        path: "/repo/apps/web/src/app.ts",
        linesFound: 10,
        linesHit: 7,
      },
    ]);
  });
});

describe("summarizeCoverage", () => {
  test("ignores test files when aggregating coverage", () => {
    const coverage = summarizeCoverage(
      [
        { path: "/repo/apps/web/src/app.ts", linesFound: 10, linesHit: 6 },
        { path: "/repo/apps/web/src/app.test.ts", linesFound: 20, linesHit: 20 },
      ],
      ["apps/web/src/"]
    );

    expect(coverage).toEqual({
      linesFound: 10,
      linesHit: 6,
      ratio: 0.6,
    });
  });
});

describe("buildCoverageSummary", () => {
  let rootDir = "";

  afterEach(() => {
    if (rootDir) {
      rmSync(rootDir, { recursive: true, force: true });
      rootDir = "";
    }
  });

  test("builds advisory summaries for measured and uninstrumented targets", () => {
    rootDir = mkdtempSync(join(tmpdir(), "lumen-coverage-summary-"));

    mkdirSync(join(rootDir, "coverage", "bun"), { recursive: true });
    writeFileSync(
      join(rootDir, "coverage", "bun", "lcov.info"),
      `
TN:
SF:${join(rootDir, "apps/web/src/app.ts").replaceAll("\\", "/")}
LF:10
LH:4
end_of_record
TN:
SF:${join(rootDir, "packages/yjs-shared/src/index.ts").replaceAll("\\", "/")}
LF:20
LH:10
end_of_record
`
    );

    mkdirSync(join(rootDir, "apps", "web", "src"), { recursive: true });
    mkdirSync(join(rootDir, "apps", "web", "test", "integration"), {
      recursive: true,
    });
    mkdirSync(join(rootDir, "apps", "web", "e2e", "visual"), {
      recursive: true,
    });
    mkdirSync(join(rootDir, "apps", "presence", "test"), { recursive: true });
    mkdirSync(join(rootDir, "apps", "presence", "e2e"), { recursive: true });
    mkdirSync(join(rootDir, "apps", "native", "src-tauri", "src"), {
      recursive: true,
    });
    mkdirSync(join(rootDir, "packages", "yjs-shared", "src"), {
      recursive: true,
    });
    mkdirSync(join(rootDir, "packages", "yjs-shared", "test", "integration"), {
      recursive: true,
    });

    writeFileSync(join(rootDir, "apps", "web", "src", "app.test.ts"), "test");
    writeFileSync(
      join(rootDir, "apps", "web", "test", "integration", "app.test.ts"),
      "test"
    );
    writeFileSync(join(rootDir, "apps", "web", "e2e", "flow.spec.ts"), "test");
    writeFileSync(
      join(rootDir, "apps", "web", "e2e", "visual", "screen.spec.ts"),
      "test"
    );
    writeFileSync(
      join(rootDir, "apps", "presence", "test", "presence_test.exs"),
      "test"
    );
    writeFileSync(
      join(rootDir, "apps", "presence", "e2e", "health.spec.ts"),
      "test"
    );
    writeFileSync(
      join(rootDir, "apps", "native", "src-tauri", "src", "lib.rs"),
      "pub fn run() {}"
    );
    writeFileSync(
      join(rootDir, "packages", "yjs-shared", "src", "index.test.ts"),
      "test"
    );
    writeFileSync(
      join(rootDir, "packages", "yjs-shared", "test", "integration", "sync.integration.test.ts"),
      "test"
    );

    const summary = buildCoverageSummary(rootDir);
    const web = summary.find((subject) => subject.id === "apps/web");
    const presence = summary.find((subject) => subject.id === "apps/presence");
    const native = summary.find((subject) => subject.id === "apps/native");
    const yjs = summary.find((subject) => subject.id === "packages/yjs-shared");

    expect(web?.coverage?.ratio).toBe(0.4);
    expect(web?.status).toBe("warn");
    expect(web?.layers.map((layer) => layer.count)).toEqual([1, 1, 1, 1]);

    expect(presence?.coverage).toBeNull();
    expect(presence?.status).toBe("info");

    expect(native?.status).toBe("warn");
    expect(native?.notes).toContain(
      "No tests found and no coverage artifact is available."
    );

    expect(yjs?.coverage?.ratio).toBe(0.5);
    expect(yjs?.status).toBe("warn");

    const markdown = renderCoverageSummary(summary);

    expect(markdown).toContain("| apps/web | 40.0% unit lines (target 95.0%) |");
    expect(markdown).toContain("apps/presence");
    expect(markdown).toContain("packages/yjs-shared");
  });
});
