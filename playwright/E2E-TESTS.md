# E2E Test Instructions

Run E2E tests from the repo root with Bun. The Playwright config at `playwright/playwright.config.ts` is required because it wires the right ports and starts the dedicated web/workers/presence test servers automatically.

1. Install dependencies:
   `bun install`
2. Install Playwright browsers (first-time setup):
   `bunx playwright install --with-deps chromium firefox webkit`
3. Run the full E2E suite:
   `bun run test:e2e`
4. Run Chromium with 20 workers (default team flow):
   `PLAYWRIGHT_WORKERS=20 bunx playwright test -c playwright/playwright.config.ts --project=chromium`
5. Run only collaboration + share E2E suites in Chromium with 20 workers:
   `PLAYWRIGHT_WORKERS=20 bunx playwright test -c playwright/playwright.config.ts apps/web/e2e/share apps/web/e2e/collaboration --project=chromium`

Current suite size (Chromium): 153 E2E tests in 29 files (`bunx playwright test -c playwright/playwright.config.ts --project=chromium --list`). Estimated full-suite runtime varies by machine: high-end desktop (12+ cores) ~8-12 min, mid-range laptop (6-8 cores) ~12-20 min, lower-end laptop (4 cores) ~20-35 min, and GitHub Actions (`ubuntu-latest`) ~18-30 min on warm cache or ~25-40 min on cold cache (first browser/dependency setup).
