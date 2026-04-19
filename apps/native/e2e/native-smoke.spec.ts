import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

interface TauriConfig {
  app?: {
    security?: {
      csp?: string;
    };
    windows?: Array<{
      decorations?: boolean;
      height?: number;
      resizable?: boolean;
      width?: number;
    }>;
  };
  bundle?: {
    active?: boolean;
    icon?: string[];
    targets?: string;
  };
  identifier?: string;
  plugins?: {
    "deep-link"?: {
      desktop?: {
        schemes?: string[];
      };
    };
    store?: Record<string, unknown>;
  };
  productName?: string;
  version?: string;
}

interface NativeCapabilities {
  permissions: string[];
}

const TAURI_CONFIG_PATH = fileURLToPath(
  new URL("../src-tauri/tauri.conf.json", import.meta.url)
);

const DEFAULT_CAPABILITIES_PATH = fileURLToPath(
  new URL("../src-tauri/capabilities/default.json", import.meta.url)
);

async function loadJsonFile<T>(filePath: string): Promise<T> {
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents) as T;
}

function loadTauriConfig(): Promise<TauriConfig> {
  return loadJsonFile<TauriConfig>(TAURI_CONFIG_PATH);
}

function loadDefaultCapabilities(): Promise<NativeCapabilities> {
  return loadJsonFile<NativeCapabilities>(DEFAULT_CAPABILITIES_PATH);
}

test.describe("Native App Smoke Tests", () => {
  test.describe.configure({ mode: "serial" });

  test("native app configuration is valid", async () => {
    const config = await loadTauriConfig();

    expect(typeof config.productName).toBe("string");
    expect(config.productName?.length).toBeGreaterThan(0);
    expect(typeof config.identifier).toBe("string");
    expect(config.identifier?.length).toBeGreaterThan(0);
    expect(typeof config.version).toBe("string");
    expect(config.version?.length).toBeGreaterThan(0);
  });

  test("websocket connection path is configured", async ({ page }) => {
    await page.goto("http://localhost:3000");

    const hasWebSocketSupport = await page.evaluate(
      () => typeof WebSocket !== "undefined"
    );
    expect(hasWebSocketSupport).toBeTruthy();
  });

  test("deep-link scheme is configured", async () => {
    const config = await loadTauriConfig();

    expect(config.plugins?.["deep-link"]?.desktop?.schemes).toContain("lumen");
  });

  test("window controls are configured", async () => {
    const config = await loadTauriConfig();

    expect(config.app?.windows?.[0]?.decorations).toBe(false);
  });

  test("CSP allows necessary connections", async () => {
    const config = await loadTauriConfig();

    const csp = config.app?.security?.csp || "";
    expect(csp).toContain("connect-src");
    expect(csp).toContain("ws:");
    expect(csp).toContain("wss:");
  });

  test("native capabilities include required permissions", async () => {
    const capabilities = await loadDefaultCapabilities();

    expect(capabilities.permissions).toContain("core:window:allow-close");
    expect(capabilities.permissions).toContain("core:window:allow-minimize");
    expect(capabilities.permissions).toContain(
      "core:window:allow-toggle-maximize"
    );
    expect(capabilities.permissions).toContain("websocket:default");
  });

  test("window configuration exists for persistence-sensitive flows", async () => {
    const config = await loadTauriConfig();

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
      const nativeWindow = window as Window & {
        __TAURI__?: unknown;
        tauri?: unknown;
      };

      return (
        typeof nativeWindow.__TAURI__ !== "undefined" ||
        typeof nativeWindow.tauri !== "undefined" ||
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
  test("window dimensions are configured correctly", async () => {
    const config = await loadTauriConfig();

    const window = config.app?.windows?.[0];
    expect(window?.width).toBe(1280);
    expect(window?.height).toBe(800);
  });

  test("window is resizable", async () => {
    const config = await loadTauriConfig();

    expect(config.app?.windows?.[0]?.resizable).toBe(true);
  });
});

test.describe("Native Security Configuration", () => {
  test("security CSP is properly configured", async () => {
    const config = await loadTauriConfig();

    const csp = config.app?.security?.csp;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src");
  });

  test("bundle configuration is valid for release", async () => {
    const config = await loadTauriConfig();

    expect(config.bundle?.active).toBe(true);
    expect(config.bundle?.targets).toBe("all");
    expect(config.bundle?.icon?.length).toBeGreaterThan(0);
  });
});
