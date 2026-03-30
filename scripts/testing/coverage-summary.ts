import { Glob } from "bun";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface LcovRecord {
  linesFound: number;
  linesHit: number;
  path: string;
}

type LayerKind =
  | "unit"
  | "integration"
  | "e2e"
  | "visual"
  | "exunit"
  | "rust";

interface CoverageSource {
  defaultPath: string;
  envVar?: string;
}

interface LayerConfig {
  kind: LayerKind;
  patterns: string[];
}

interface SubjectConfig {
  category: "app" | "package";
  coverageRoots: string[];
  coverageSources: CoverageSource[];
  id: string;
  layers: LayerConfig[];
  note?: string;
  targetCoverage?: number;
}

interface LayerSummary {
  count: number;
  kind: LayerKind;
}

interface CoverageMeasurement {
  linesFound: number;
  linesHit: number;
  ratio: number;
}

export interface SubjectSummary {
  category: "app" | "package";
  coverage: CoverageMeasurement | null;
  id: string;
  layers: LayerSummary[];
  notes: string[];
  status: "good" | "info" | "warn";
  targetCoverage?: number;
}

const BUN_LCOV_SOURCE: CoverageSource = {
  defaultPath: "coverage/bun/lcov.info",
  envVar: "BUN_LCOV_PATH",
};

const PRESENCE_LCOV_SOURCE: CoverageSource = {
  defaultPath: "apps/presence/cover/lcov.info",
  envVar: "PRESENCE_LCOV_PATH",
};

const NATIVE_LCOV_SOURCE: CoverageSource = {
  defaultPath: "apps/native/src-tauri/coverage/lcov.info",
  envVar: "NATIVE_LCOV_PATH",
};

const SUBJECTS: SubjectConfig[] = [
  {
    id: "apps/web",
    category: "app",
    coverageRoots: ["apps/web/src/"],
    coverageSources: [BUN_LCOV_SOURCE],
    targetCoverage: 0.95,
    layers: [
      { kind: "unit", patterns: ["apps/web/src/**/*.test.ts"] },
      { kind: "integration", patterns: ["apps/web/test/integration/*.test.ts"] },
      { kind: "e2e", patterns: ["apps/web/e2e/*.spec.ts"] },
      { kind: "visual", patterns: ["apps/web/e2e/visual/*.spec.ts"] },
    ],
  },
  {
    id: "apps/workers",
    category: "app",
    coverageRoots: ["apps/workers/src/"],
    coverageSources: [BUN_LCOV_SOURCE],
    targetCoverage: 0.95,
    layers: [
      { kind: "unit", patterns: ["apps/workers/src/**/*.test.ts"] },
      {
        kind: "integration",
        patterns: ["apps/workers/test/integration/*.test.ts"],
      },
    ],
  },
  {
    id: "apps/presence",
    category: "app",
    coverageRoots: ["apps/presence/lib/"],
    coverageSources: [PRESENCE_LCOV_SOURCE],
    layers: [
      { kind: "exunit", patterns: ["apps/presence/test/**/*_test.exs"] },
      { kind: "e2e", patterns: ["apps/presence/e2e/*.spec.ts"] },
    ],
    note: "ExUnit and browser tests exist, but CI does not publish Presence coverage yet.",
  },
  {
    id: "apps/native",
    category: "app",
    coverageRoots: ["apps/native/src-tauri/src/"],
    coverageSources: [NATIVE_LCOV_SOURCE],
    layers: [{ kind: "rust", patterns: ["apps/native/src-tauri/src/**/*.rs"] }],
    note: "Native app coverage is not instrumented in CI. JS bridge coverage is tracked separately.",
  },
  {
    id: "packages/native-bridge",
    category: "package",
    coverageRoots: ["packages/native-bridge/src/"],
    coverageSources: [BUN_LCOV_SOURCE],
    targetCoverage: 0.95,
    layers: [
      { kind: "unit", patterns: ["packages/native-bridge/src/*.test.ts"] },
      {
        kind: "integration",
        patterns: ["packages/native-bridge/test/integration/*.test.ts"],
      },
    ],
  },
  {
    id: "packages/logger",
    category: "package",
    coverageRoots: ["packages/logger/src/"],
    coverageSources: [BUN_LCOV_SOURCE],
    targetCoverage: 0.95,
    layers: [{ kind: "unit", patterns: ["packages/logger/src/*.test.ts"] }],
  },
  {
    id: "packages/db",
    category: "package",
    coverageRoots: ["packages/db/src/"],
    coverageSources: [BUN_LCOV_SOURCE],
    targetCoverage: 0.95,
    layers: [
      { kind: "unit", patterns: ["packages/db/src/*.test.ts"] },
      { kind: "integration", patterns: ["packages/db/test/integration/*.test.ts"] },
    ],
  },
  {
    id: "packages/ai",
    category: "package",
    coverageRoots: ["packages/ai/src/"],
    coverageSources: [BUN_LCOV_SOURCE],
    targetCoverage: 0.98,
    layers: [{ kind: "unit", patterns: ["packages/ai/src/*.test.ts"] }],
  },
  {
    id: "packages/yjs-shared",
    category: "package",
    coverageRoots: ["packages/yjs-shared/src/"],
    coverageSources: [BUN_LCOV_SOURCE],
    targetCoverage: 0.95,
    layers: [
      { kind: "unit", patterns: ["packages/yjs-shared/src/*.test.ts"] },
      {
        kind: "integration",
        patterns: ["packages/yjs-shared/test/integration/*.test.ts"],
      },
    ],
  },
];

const END_OF_RECORD = "end_of_record";
const SF_REGEX = /SF:(.+)/;
const LF_REGEX = /LF:(\d+)/;
const LH_REGEX = /LH:(\d+)/;

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function isTestPath(path: string): boolean {
  return (
    path.includes("/test/") ||
    path.includes("/e2e/") ||
    path.endsWith(".test.ts") ||
    path.endsWith(".spec.ts") ||
    path.endsWith("_test.exs")
  );
}

export function parseLcov(content: string): LcovRecord[] {
  const records: LcovRecord[] = [];

  for (const block of content.split(END_OF_RECORD)) {
    const sourceMatch = block.match(SF_REGEX);

    if (!sourceMatch) {
      continue;
    }

    const normalizedPath = normalizePath(sourceMatch[1].trim());
    const lfMatch = block.match(LF_REGEX);
    const lhMatch = block.match(LH_REGEX);

    records.push({
      path: normalizedPath,
      linesFound: lfMatch ? Number.parseInt(lfMatch[1], 10) : 0,
      linesHit: lhMatch ? Number.parseInt(lhMatch[1], 10) : 0,
    });
  }

  return records;
}

function getConfiguredPath(rootDir: string, source: CoverageSource): string {
  const envPath = source.envVar ? process.env[source.envVar] : undefined;

  return resolve(rootDir, envPath ?? source.defaultPath);
}

export function loadLcovRecords(
  rootDir: string,
  coverageSources: CoverageSource[]
): LcovRecord[] {
  const records: LcovRecord[] = [];

  for (const source of coverageSources) {
    const lcovPath = getConfiguredPath(rootDir, source);

    if (!existsSync(lcovPath)) {
      continue;
    }

    records.push(...parseLcov(readFileSync(lcovPath, "utf8")));
  }

  return records;
}

function countFiles(rootDir: string, patterns: string[]): number {
  const matches = new Set<string>();

  for (const pattern of patterns) {
    const glob = new Glob(pattern);

    for (const file of glob.scanSync({ cwd: rootDir, onlyFiles: true })) {
      matches.add(normalizePath(file));
    }
  }

  return matches.size;
}

function countRustTestFiles(rootDir: string, patterns: string[]): number {
  const matches = new Set<string>();

  for (const pattern of patterns) {
    const glob = new Glob(pattern);

    for (const file of glob.scanSync({ cwd: rootDir, onlyFiles: true })) {
      const relativePath = normalizePath(file);
      const absolutePath = join(rootDir, relativePath);
      const content = readFileSync(absolutePath, "utf8");

      if (
        /#\[\s*test\s*\]/m.test(content) ||
        /#\[\s*cfg\s*\(\s*test\s*\)\s*\]/m.test(content) ||
        /\bmod\s+tests\b/m.test(content)
      ) {
        matches.add(relativePath);
      }
    }
  }

  return matches.size;
}

function summarizeLayer(rootDir: string, layer: LayerConfig): LayerSummary {
  const count =
    layer.kind === "rust"
      ? countRustTestFiles(rootDir, layer.patterns)
      : countFiles(rootDir, layer.patterns);

  return {
    kind: layer.kind,
    count,
  };
}

export function summarizeCoverage(
  records: LcovRecord[],
  coverageRoots: string[]
): CoverageMeasurement | null {
  const relevant = records.filter(
    (record) =>
      !isTestPath(record.path) &&
      coverageRoots.some((root) => record.path.includes(normalizePath(root)))
  );

  if (relevant.length === 0) {
    return null;
  }

  let linesFound = 0;
  let linesHit = 0;

  for (const record of relevant) {
    linesFound += record.linesFound;
    linesHit += record.linesHit;
  }

  if (linesFound === 0) {
    return null;
  }

  return {
    linesFound,
    linesHit,
    ratio: linesHit / linesFound,
  };
}

function summarizeSubject(rootDir: string, subject: SubjectConfig): SubjectSummary {
  const records = loadLcovRecords(rootDir, subject.coverageSources);
  const coverage = summarizeCoverage(records, subject.coverageRoots);
  const layers = subject.layers.map((layer) => summarizeLayer(rootDir, layer));
  const notes: string[] = [];
  const totalTests = layers.reduce((sum, layer) => sum + layer.count, 0);
  let status: SubjectSummary["status"];

  if (coverage && subject.targetCoverage && coverage.ratio < subject.targetCoverage) {
    notes.push(
      `Measured unit line coverage ${formatPercent(coverage.ratio)} is below the advisory target ${formatPercent(subject.targetCoverage)}.`
    );
    status = "warn";
  } else if (coverage) {
    status = "good";
  } else if (totalTests === 0) {
    notes.push("No tests found and no coverage artifact is available.");
    status = "warn";
  } else {
    notes.push("Tests exist, but no coverage artifact is published for this target yet.");
    status = "info";
  }

  if (subject.note) {
    notes.push(subject.note);
  }

  return {
    id: subject.id,
    category: subject.category,
    coverage,
    layers,
    notes,
    status,
    targetCoverage: subject.targetCoverage,
  };
}

export function buildCoverageSummary(rootDir: string): SubjectSummary[] {
  return SUBJECTS.map((subject) => summarizeSubject(rootDir, subject));
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCoverage(summary: SubjectSummary): string {
  if (!summary.coverage) {
    return "not instrumented";
  }

  const base = `${formatPercent(summary.coverage.ratio)} unit lines`;

  if (!summary.targetCoverage) {
    return base;
  }

  return `${base} (target ${formatPercent(summary.targetCoverage)})`;
}

function formatLayers(summary: SubjectSummary): string {
  return summary.layers
    .map((layer) => `${layer.kind}: ${layer.count}`)
    .join(", ");
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|");
}

export function renderCoverageSummary(summary: SubjectSummary[]): string {
  const apps = summary.filter((subject) => subject.category === "app");
  const packages = summary.filter((subject) => subject.category === "package");
  const warnings = summary.flatMap((subject) =>
    subject.status === "warn"
      ? subject.notes.map((note) => `- ${subject.id}: ${note}`)
      : []
  );

  const sections = [
    "# Coverage Summary",
    "",
    "Coverage is advisory only. Measured percentages come from instrumented LCOV data for non-test source files. Integration, e2e, ExUnit, visual, and Rust columns report test surface unless a coverage artifact is available.",
    "",
    "## Apps",
    "",
    "| Target | Measured coverage | Test surface | Status | Notes |",
    "| --- | --- | --- | --- | --- |",
    ...apps.map(renderRow),
    "",
    "## Packages",
    "",
    "| Target | Measured coverage | Test surface | Status | Notes |",
    "| --- | --- | --- | --- | --- |",
    ...packages.map(renderRow),
  ];

  if (warnings.length > 0) {
    sections.push("", "## Advisory Warnings", "", ...warnings);
  }

  return sections.join("\n");
}

function renderRow(summary: SubjectSummary): string {
  const notes =
    summary.notes.length > 0
      ? escapeMarkdown(summary.notes.join(" "))
      : "None.";

  return `| ${summary.id} | ${escapeMarkdown(formatCoverage(summary))} | ${escapeMarkdown(formatLayers(summary))} | ${summary.status} | ${notes} |`;
}

function appendStepSummary(markdown: string): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  if (!summaryPath) {
    return;
  }

  appendFileSync(summaryPath, `${markdown}\n`);
}

export function main(rootDir: string = process.cwd()): number {
  const summary = buildCoverageSummary(rootDir);
  const markdown = renderCoverageSummary(summary);

  console.log(markdown);
  appendStepSummary(markdown);

  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
