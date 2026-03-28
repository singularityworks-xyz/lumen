import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MONITORED_PATHS: Array<{ path: string; threshold: number }> = [
  { path: "apps/web/src/features/kanban", threshold: 0.95 },
  { path: "apps/web/src/features/collab", threshold: 0.95 },
  { path: "apps/web/src/lib", threshold: 0.95 },
  { path: "apps/web/src/hooks", threshold: 0.95 },
  { path: "apps/workers/src/collab", threshold: 0.95 },
  { path: "apps/workers/src/auth", threshold: 0.95 },
  { path: "apps/workers/src/session.ts", threshold: 0.95 },
  { path: "apps/workers/src/ai/lib", threshold: 0.95 },
  { path: "packages/yjs-shared", threshold: 0.95 },
  { path: "packages/native-bridge", threshold: 0.95 },
  { path: "packages/logger/src", threshold: 0.95 },
  { path: "packages/db/src/lib", threshold: 0.95 },
  { path: "packages/ai/src", threshold: 0.98 },
];

const SF_REGEX = /SF:(.+)/;
const LF_REGEX = /LF:(\d+)/;
const LH_REGEX = /LH:(\d+)/;
const FNF_REGEX = /FNF:(\d+)/;
const FNH_REGEX = /FNH:(\d+)/;

interface LcovRecord {
  functionsFound: number;
  functionsHit: number;
  linesFound: number;
  linesHit: number;
  path: string;
}

function parseLcov(content: string): LcovRecord[] {
  const records: LcovRecord[] = [];
  const blocks = content.split("end_of_record");

  for (const block of blocks) {
    const sourceMatch = block.match(SF_REGEX);
    if (!sourceMatch) {
      continue;
    }

    const path = sourceMatch[1].trim();
    const lfMatch = block.match(LF_REGEX);
    const lhMatch = block.match(LH_REGEX);
    const ffnMatch = block.match(FNF_REGEX);
    const fnhMatch = block.match(FNH_REGEX);

    records.push({
      path,
      linesFound: lfMatch ? Number.parseInt(lfMatch[1], 10) : 0,
      linesHit: lhMatch ? Number.parseInt(lhMatch[1], 10) : 0,
      functionsFound: ffnMatch ? Number.parseInt(ffnMatch[1], 10) : 0,
      functionsHit: fnhMatch ? Number.parseInt(fnhMatch[1], 10) : 0,
    });
  }

  return records;
}

function checkThresholds(lcovPath: string): void {
  if (!existsSync(lcovPath)) {
    console.error(`LCOV file not found: ${lcovPath}`);
    console.error("Run tests with coverage first.");
    process.exit(1);
  }

  const content = readFileSync(lcovPath, "utf-8");
  const records = parseLcov(content);

  if (records.length === 0) {
    console.error("No coverage records found in LCOV file.");
    process.exit(1);
  }

  let hasFailures = false;
  const failures: string[] = [];

  for (const { path: monitoredPath, threshold } of MONITORED_PATHS) {
    const matching = records.filter((r) => r.path.includes(monitoredPath));

    if (matching.length === 0) {
      console.warn(`⚠ No coverage data for: ${monitoredPath}`);
      continue;
    }

    let totalFound = 0;
    let totalHit = 0;

    for (const record of matching) {
      totalFound += record.linesFound;
      totalHit += record.linesHit;
    }

    if (totalFound === 0) {
      continue;
    }

    const coverage = totalHit / totalFound;

    if (coverage < threshold) {
      hasFailures = true;
      const pct = (coverage * 100).toFixed(1);
      failures.push(
        `✗ ${monitoredPath}: ${pct}% (threshold: ${(threshold * 100).toFixed(1)}%) — ${totalHit}/${totalFound} lines`
      );
    } else {
      const pct = (coverage * 100).toFixed(1);
      console.log(`✓ ${monitoredPath}: ${pct}% (min: ${(threshold * 100).toFixed(1)}%)`);
    }
  }

  if (hasFailures) {
    console.error("\nCoverage gate FAILED:\n");
    for (const failure of failures) {
      console.error(`  ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    `\n✓ All monitored paths meet their per-path line coverage thresholds.`
  );
}

const lcovPath = process.argv[2] || "coverage/bun/lcov.info";
checkThresholds(resolve(lcovPath));
