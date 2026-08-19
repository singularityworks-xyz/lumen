import path from "node:path";
import { config as loadDotenv } from "dotenv";

// Loads the gitignored root .env (secrets only: OAuth client secrets, API
// keys) into the workers process. Bun already auto-loads the committed
// per-app .env.development defaults; this file OVERRIDES them so real
// secrets win over dev fakes. Missing file = no-op (dev fakes are used).
// Skipped entirely in production (NODE_ENV=production) — orchestrators
// (Dokploy, etc.) set env natively.
const REPO_ROOT = path.resolve(import.meta.dir, "../../..");

// Bun test runs each test file in its own process with the test file as
// argv[1] — use it to keep real secrets out of test processes even when a
// test sets NODE_ENV=development (this repo's tests do).
const BUN_TEST_FILE_REGEX = /\.test\.[cm]?[jt]sx?$/;

function isBunTest(): boolean {
  const target = process.argv[1];
  return typeof target === "string" && BUN_TEST_FILE_REGEX.test(target);
}

export function loadLocalEnvFiles(): void {
  if (
    isBunTest() ||
    process.env.NODE_ENV === "production" ||
    process.env.NODE_ENV === "test"
  ) {
    return;
  }

  loadDotenv({
    path: path.join(REPO_ROOT, ".env"),
    override: true,
    quiet: true,
  });
}
