import { readFileSync, writeFileSync } from "node:fs";

interface Aggregate {
  errors: number;
  failures: number;
  tests: number;
  time: number;
}

const TESTSUITES_REGEX = /<testsuites\b[^>]*>([\s\S]*?)<\/testsuites>/;
const TESTSUITE_TAG_REGEX = /<(testsuite|\/testsuite)\b([^>]*)>/g;
const ATTR_REGEX = /\b(tests|failures|errors|time)\s*=\s*"([^"]*)"/g;

function extractTestsuitesContent(xml: string): string {
  const match = xml.match(TESTSUITES_REGEX);
  return match ? match[1].trim() : "";
}

function sumTopLevelTestsuiteAttributes(content: string): Aggregate {
  const aggregate: Aggregate = {
    tests: 0,
    failures: 0,
    errors: 0,
    time: 0,
  };
  let depth = 0;
  let match: RegExpExecArray | null;

  match = TESTSUITE_TAG_REGEX.exec(content);
  while (match !== null) {
    const tag = match[1];
    const attrString = match[2];

    if (tag === "testsuite") {
      depth += 1;
      if (depth === 1) {
        let attrMatch = ATTR_REGEX.exec(attrString);
        while (attrMatch !== null) {
          const key = attrMatch[1] as keyof Aggregate;
          const value = Number.parseFloat(attrMatch[2]);
          if (!Number.isNaN(value)) {
            aggregate[key] += value;
          }
          attrMatch = ATTR_REGEX.exec(attrString);
        }
        ATTR_REGEX.lastIndex = 0;
      }
    } else {
      depth = Math.max(0, depth - 1);
    }
    match = TESTSUITE_TAG_REGEX.exec(content);
  }

  TESTSUITE_TAG_REGEX.lastIndex = 0;
  return aggregate;
}

export function main(args: string[] = process.argv.slice(2)): number {
  const outputPath = args[0];
  const inputPaths = args.slice(1);

  if (!outputPath || inputPaths.length === 0) {
    console.error(
      "Usage: bun run scripts/testing/merge-junit.ts <output.xml> <input1.xml> [input2.xml ...]"
    );
    return 1;
  }

  const contents: string[] = [];
  const total: Aggregate = { tests: 0, failures: 0, errors: 0, time: 0 };

  for (const inputPath of inputPaths) {
    const xml = readFileSync(inputPath, "utf8");
    const content = extractTestsuitesContent(xml);
    if (content) {
      contents.push(content);
      const aggregate = sumTopLevelTestsuiteAttributes(content);
      total.tests += aggregate.tests;
      total.failures += aggregate.failures;
      total.errors += aggregate.errors;
      total.time += aggregate.time;
    }
  }

  const merged = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites tests="${total.tests}" failures="${total.failures}" errors="${total.errors}" time="${total.time.toFixed(6)}">\n${contents.join("\n")}\n</testsuites>\n`;

  writeFileSync(outputPath, merged, "utf8");
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
