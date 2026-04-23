import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type LineHits = Map<number, number>;

const SF_REGEX = /^SF:(.+)$/m;
const DA_REGEX = /^DA:(\d+),(\d+)(?:,[^\n]+)?$/gm;

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function parseFileLineHits(content: string): Map<string, LineHits> {
  const byFile = new Map<string, LineHits>();

  for (const block of content.split("end_of_record")) {
    const sourceMatch = block.match(SF_REGEX);

    if (!sourceMatch) {
      continue;
    }

    const filePath = normalizePath(sourceMatch[1].trim());
    const existing = byFile.get(filePath) ?? new Map<number, number>();
    let daMatch = DA_REGEX.exec(block);

    while (daMatch) {
      const line = Number.parseInt(daMatch[1], 10);
      const hits = Number.parseInt(daMatch[2], 10);
      const currentHits = existing.get(line) ?? 0;

      existing.set(line, currentHits + hits);
      daMatch = DA_REGEX.exec(block);
    }

    DA_REGEX.lastIndex = 0;
    byFile.set(filePath, existing);
  }

  return byFile;
}

function mergeLineHits(contents: string[]): Map<string, LineHits> {
  const merged = new Map<string, LineHits>();

  for (const content of contents) {
    const fileLineHits = parseFileLineHits(content);

    for (const [filePath, lines] of fileLineHits.entries()) {
      const existing = merged.get(filePath) ?? new Map<number, number>();

      for (const [line, hits] of lines.entries()) {
        existing.set(line, (existing.get(line) ?? 0) + hits);
      }

      merged.set(filePath, existing);
    }
  }

  return merged;
}

export function mergeLcovContents(contents: string[]): string {
  const merged = mergeLineHits(contents);
  const files = [...merged.keys()].sort();
  const output: string[] = [];

  for (const filePath of files) {
    const lineHits = merged.get(filePath);

    if (!lineHits || lineHits.size === 0) {
      continue;
    }

    const lines = [...lineHits.keys()].sort((a, b) => a - b);
    const linesFound = lines.length;
    const linesHit = lines.reduce(
      (count, line) => count + ((lineHits.get(line) ?? 0) > 0 ? 1 : 0),
      0
    );

    output.push("TN:");
    output.push(`SF:${filePath}`);

    for (const line of lines) {
      output.push(`DA:${line},${lineHits.get(line) ?? 0}`);
    }

    output.push(`LF:${linesFound}`);
    output.push(`LH:${linesHit}`);
    output.push("end_of_record");
  }

  return `${output.join("\n")}\n`;
}

function parseCliArgs(args: string[]): {
  inputPaths: string[];
  outputPath: string;
} {
  let outputPath = "coverage/merged/lcov.info";
  const inputPaths: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--output") {
      const next = args[index + 1];

      if (!next) {
        throw new Error("Missing path after --output");
      }

      outputPath = next;
      index += 1;
      continue;
    }

    inputPaths.push(arg);
  }

  if (inputPaths.length === 0) {
    throw new Error(
      "Usage: bun run scripts/testing/merge-lcov.ts --output <path> <input...>"
    );
  }

  return {
    inputPaths,
    outputPath,
  };
}

export function main(args: string[] = process.argv.slice(2)): number {
  try {
    const { inputPaths, outputPath } = parseCliArgs(args);
    const contents = inputPaths.map((inputPath) =>
      readFileSync(resolve(inputPath), "utf8")
    );
    const merged = mergeLcovContents(contents);
    const absoluteOutputPath = resolve(outputPath);

    mkdirSync(dirname(absoluteOutputPath), { recursive: true });
    writeFileSync(absoluteOutputPath, merged, "utf8");

    return 0;
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("Unknown error while merging LCOV files.");
    }

    return 1;
  }
}

if (import.meta.main) {
  process.exit(main());
}
