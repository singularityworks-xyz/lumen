import { Glob } from "bun";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const ROOT = resolve(import.meta.dir, "../..");

function findTestFiles(pattern: string): string[] {
  const glob = new Glob(pattern);
  const files: string[] = [];

  for (const file of glob.scanSync({ onlyFiles: true, cwd: ROOT })) {
    files.push(file);
  }

  return files.sort();
}

function runBunTest(args: string[], options?: { coverage?: boolean; coverageThreshold?: number }): Promise<number> {
  return new Promise((resolve) => {
    const cmd = spawn("bun", args, {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env },
    });

    cmd.on("close", (code) => resolve(code ?? 0));
  });
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "unit:web": {
      const files = findTestFiles("apps/web/src/**/*.test.{ts,tsx}");
      console.log(`Running ${files.length} web unit tests in isolation...`);
      let hasFailure = false;
      for (const file of files) {
        const code = await runBunTest([
          "test",
          "--preload",
          "./tests/config/web.setup.ts",
          file,
        ]);
        if (code !== 0) hasFailure = true;
      }
      process.exit(hasFailure ? 1 : 0);
    }

    case "unit:workers": {
      const files = findTestFiles("apps/workers/src/**/*.test.ts");
      console.log(`Running ${files.length} workers unit tests in isolation...`);
      let hasFailure = false;
      for (const file of files) {
        const code = await runBunTest([
          "test",
          "--preload",
          "./packages/db/src/setup/workers.setup.ts",
          file,
        ]);
        if (code !== 0) hasFailure = true;
      }
      process.exit(hasFailure ? 1 : 0);
    }

    case "unit:packages": {
      const packages = [
        { path: "packages/ai/src", pattern: "**/*.test.ts" },
        { path: "packages/db/src", pattern: "**/*.test.ts" },
        { path: "packages/logger/src", pattern: "**/*.test.ts" },
        { path: "packages/native-bridge/src", pattern: "**/*.test.ts" },
        { path: "packages/yjs-shared/src", pattern: "**/*.test.ts" },
      ];

      let exitCode = 0;
      for (const pkg of packages) {
        const files = findTestFiles(`${pkg.path}/${pkg.pattern}`);
        console.log(`Running ${files.length} ${pkg.path} tests...`);
        const code = await runBunTest([
          "test",
          "--preload",
          "./tests/config/bun.setup.ts",
          ...files,
        ]);
        if (code !== 0) exitCode = code;
      }
      process.exit(exitCode);
    }

    case "integration:web": {
      const files = findTestFiles("apps/web/test/integration/*.test.ts");
      console.log(`Running ${files.length} web integration tests...`);
      const exitCode = await runBunTest([
        "test",
        "--preload",
        "./tests/config/web.setup.ts",
        ...files,
      ]);
      process.exit(exitCode);
    }

    case "integration:workers": {
      const files = findTestFiles("apps/workers/test/integration/*.test.ts");
      console.log(`Running ${files.length} workers integration tests...`);
      const exitCode = await runBunTest([
        "test",
        "--preload",
        "./packages/db/src/setup/workers.setup.ts",
        ...files,
      ]);
      process.exit(exitCode);
    }

    case "coverage:web": {
      const files = findTestFiles("apps/web/src/**/*.test.{ts,tsx}");
      console.log(`Running ${files.length} web unit tests with coverage...`);
      const exitCode = await runBunTest(
        [
          "test",
          "--preload",
          "./tests/config/web.setup.ts",
          ...files,
          "--coverage",
          "--coverage-threshold=0.95",
        ],
        { coverage: true, coverageThreshold: 0.95 }
      );
      process.exit(exitCode);
    }

    case "coverage:workers": {
      const files = findTestFiles("apps/workers/src/**/*.test.ts");
      console.log(`Running ${files.length} workers unit tests with coverage...`);
      const exitCode = await runBunTest([
        "test",
        "--preload",
        "./packages/db/src/setup/workers.setup.ts",
        ...files,
        "--coverage",
      ]);
      process.exit(exitCode);
    }

    case "coverage:packages": {
      const packages = [
        { path: "packages/ai/src", pattern: "**/*.test.ts", threshold: 0.98 },
        { path: "packages/db/src", pattern: "**/*.test.ts", threshold: 0.95 },
        { path: "packages/logger/src", files: ["config.test.ts", "logger.test.ts", "tracer.test.ts", "metrics.test.ts"], threshold: 0.95 },
        { path: "packages/native-bridge/src", pattern: "**/*.test.ts", threshold: 0.95 },
        { path: "packages/yjs-shared/src", pattern: "**/*.test.ts", threshold: 0.95 },
      ];

      let exitCode = 0;
      for (const pkg of packages) {
        let files: string[];
        if (pkg.files) {
          files = pkg.files.map((f) => `${pkg.path}/${f}`);
        } else {
          files = findTestFiles(`${pkg.path}/${pkg.pattern}`);
        }
        console.log(`Running coverage for ${pkg.path} (${files.length} files)...`);
        const code = await runBunTest([
          "test",
          "--preload",
          "./tests/config/bun.setup.ts",
          ...files,
          "--coverage",
        ]);
        if (code !== 0) exitCode = code;
      }
      process.exit(exitCode);
    }

    case "coverage": {
      console.log("Running all coverage tests...\n");
      console.log("=== Web Coverage ===");
      let code = await runBunTest(["run", "scripts/testing/test-scripts.ts", "coverage:web"]);
      if (code !== 0) {
        console.error("Web coverage failed");
        process.exit(code);
      }

      console.log("\n=== Workers Coverage ===");
      code = await runBunTest(["run", "scripts/testing/test-scripts.ts", "coverage:workers"]);
      if (code !== 0) {
        console.error("Workers coverage failed");
        process.exit(code);
      }

      console.log("\n=== Packages Coverage ===");
      code = await runBunTest(["run", "scripts/testing/test-scripts.ts", "coverage:packages"]);
      if (code !== 0) {
        console.error("Packages coverage failed");
        process.exit(code);
      }

      console.log("\n✅ All coverage tests passed");
      process.exit(0);
    }

    case "e2e": {
      const exitCode = await runBunTest([
        "x",
        "playwright",
        "test",
        "-c",
        "playwright/playwright.config.ts",
      ]);
      process.exit(exitCode);
    }

    case "visual": {
      const exitCode = await runBunTest([
        "x",
        "playwright",
        "test",
        "-c",
        "playwright/playwright.visual.config.ts",
      ]);
      process.exit(exitCode);
    }

    case "load:ramp": {
      const exitCode = await runCommand("k6", ["run", "load/k6/ws-collab-ramp.ts"]);
      process.exit(exitCode);
    }

    case "load:soak": {
      const exitCode = await runCommand("k6", ["run", "load/k6/ws-collab-soak.ts"]);
      process.exit(exitCode);
    }

    case "load:spike": {
      const exitCode = await runCommand("k6", ["run", "load/k6/ws-collab-spike.ts"]);
      process.exit(exitCode);
    }

    case "load:convergence": {
      const exitCode = await runCommand("k6", ["run", "load/k6/ws-collab-convergence.ts"]);
      process.exit(exitCode);
    }

    case "load:hybrid": {
      const exitCode = await runCommand("k6", ["run", "load/k6/hybrid-load.ts"]);
      process.exit(exitCode);
    }

    case "find": {
      const pattern = process.argv[3];
      if (!pattern) {
        console.error("Usage: test-scripts.ts find <glob-pattern>");
        process.exit(1);
      }
      const files = findTestFiles(pattern);
      for (const file of files) {
        console.log(file);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Available commands:");
      console.error("  unit:web, unit:workers, unit:packages");
      console.error("  integration:web, integration:workers");
      console.error("  coverage:web, coverage:workers, coverage:packages, coverage");
      console.error("  e2e, visual");
      console.error("  load:ramp, load:soak, load:spike, load:convergence, load:hybrid");
      console.error("  find <pattern>");
      process.exit(1);
  }
}

function runCommand(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    });
    proc.on("close", (code) => resolve(code ?? 0));
  });
}

main();
