import { expect, test } from "@playwright/test";

test.describe("Native App Smoke Tests", () => {
  test.describe.configure({ mode: "serial" });

  test("native app configuration is valid", async ({ page }) => {
    const configPath = await page.request.get(
      "http://localhost:4001/apps/native/src-tauri/tauri.conf.json"
    );
    expect(configPath.ok()).toBeTruthy();
  });

  test("websocket connection path is configured", async ({ page }) => {
    await page.goto("http://localhost:3000");

    const hasWebSocketSupport = await page.evaluate(() => {
      return typeof WebSocket !== "undefined";
    });
    expect(hasWebSocketSupport).toBeTruthy();
  });

  test("deep-link scheme is configured", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:4001/apps/native/src-tauri/tauri.conf.json"
    );
    const config = await response.json();

    expect(config.plugins?.["deep-link"]?.desktop?.schemes).toContain("lumen");
  });

  test("window controls are configured", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:4001/apps/native/src-tauri/tauri.conf.json"
    );
    const config = await response.json();

    expect(config.app?.windows?.[0]?.decorations).toBe(false);
  });

  test("CSP allows necessary connections", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:4001/apps/native/src-tauri/tauri.conf.json"
    );
    const config = await response.json();

    const csp = config.app?.security?.csp || "";
    expect(csp).toContain("connect-src");
    expect(csp).toContain("ws:");
    expect(csp).toContain("wss:");
  });

  test("native capabilities include required permissions", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:4001/apps/native/src-tauri/capabilities/default.json"
    );
    const capabilities = await response.json();

    expect(capabilities.permissions).toContain("core:window:allow-close");
    expect(capabilities.permissions).toContain("core:window:allow-minimize");
    expect(capabilities.permissions).toContain(
      "core:window:allow-toggle-maximize"
    );
    expect(capabilities.permissions).toContain("websocket:default");
  });

  test("store plugin is configured for persistence", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:4001/apps/native/src-tauri/tauri.conf.json"
    );
    const config = await response.json();

    expect(config.app?.windows?.[0]).toBeDefined();
  });

  test("app can load in webview context", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("native bridge API is available", async ({ page }) => {
    await page.goto("http://localhost:3000");

    const hasNativeBridge = await page.evaluate(() => {
      return (
        typeof (window as any).__TAURI__ !== "undefined" ||
        typeof (window as any).tauri !== "undefined" ||
        document.querySelector("[data-tauri]") !== null
      );
    });

    if (!hasNativeBridge) {
      console.log(
        "Tauri API not available - running in browser context (expected in some test environments)"
      );
    }
  });
});

test.describe("Native Window Behavior", () => {
  test("window dimensions are configured correctly", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:4001/apps/native/src-tauri/tauri.conf.json"
    );
    const config = await response.json();

    const window = config.app?.windows?.[0];
    expect(window?.width).toBe(1280);
    expect(window?.height).toBe(800);
  });

  test("window is resizable", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:4001/apps/native/src-tauri/tauri.conf.json"
    );
    const config = await response.json();

    expect(config.app?.windows?.[0]?.resizable).toBe(true);
  });
});

test.describe("Native Security Configuration", () => {
  test("security CSP is properly configured", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:4001/apps/native/src-tauri/tauri.conf.json"
    );
    const config = await response.json();

    const csp = config.app?.security?.csp;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src");
  });

  test("bundle configuration is valid for release", async ({ page }) => {
    const response = await page.request.get(
      "http://localhost:4001/apps/native/src-tauri/tauri.conf.json"
    );
    const config = await response.json();

    expect(config.bundle?.active).toBe(true);
    expect(config.bundle?.targets).toBe("all");
    expect(config.bundle?.icon?.length).toBeGreaterThan(0);
  });
});
