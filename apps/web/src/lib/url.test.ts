import { afterEach, describe, expect, it } from "bun:test";

// Mock window for loopback tests
const originalWindow = globalThis.window;

function setWindowLocation(hostname: string) {
  Object.defineProperty(globalThis, "window", {
    value: { location: { hostname } },
    writable: true,
    configurable: true,
  });
}

function removeWindow() {
  Object.defineProperty(globalThis, "window", {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

// Import after setting up global state
import {
  normalizeApiOriginForCurrentHost,
  normalizeApiUrlForCurrentHost,
} from "./url";

describe("normalizeApiOriginForCurrentHost", () => {
  afterEach(() => {
    // Restore original window
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it("returns URL unchanged when window is undefined (SSR)", () => {
    removeWindow();
    const url = normalizeApiOriginForCurrentHost("http://localhost:3002");
    expect(url.hostname).toBe("localhost");
  });

  it("rewrites localhost to 127.0.0.1 when both are loopback", () => {
    setWindowLocation("127.0.0.1");
    const url = normalizeApiOriginForCurrentHost("http://localhost:3002");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.port).toBe("3002");
  });

  it("rewrites 127.0.0.1 to localhost when both are loopback", () => {
    setWindowLocation("localhost");
    const url = normalizeApiOriginForCurrentHost("http://127.0.0.1:3002");
    expect(url.hostname).toBe("localhost");
  });

  it("does not rewrite when API is not loopback", () => {
    setWindowLocation("localhost");
    const url = normalizeApiOriginForCurrentHost("http://api.example.com:3002");
    expect(url.hostname).toBe("api.example.com");
  });

  it("does not rewrite when current host is not loopback", () => {
    setWindowLocation("myapp.local");
    const url = normalizeApiOriginForCurrentHost("http://localhost:3002");
    expect(url.hostname).toBe("localhost");
  });

  it("preserves path and query params", () => {
    setWindowLocation("127.0.0.1");
    const url = normalizeApiOriginForCurrentHost(
      "http://localhost:3002/api/v1?key=value"
    );
    expect(url.pathname).toBe("/api/v1");
    expect(url.search).toBe("?key=value");
  });
});

describe("normalizeApiUrlForCurrentHost", () => {
  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it("strips trailing slash for origin-only URL without trailing slash", () => {
    removeWindow();
    const result = normalizeApiUrlForCurrentHost("http://localhost:3002");
    expect(result).toBe("http://localhost:3002");
    expect(result.endsWith("/")).toBe(false);
  });

  it("preserves trailing slash when input has one", () => {
    removeWindow();
    const result = normalizeApiUrlForCurrentHost("http://localhost:3002/");
    expect(result).toBe("http://localhost:3002/");
  });

  it("preserves path without trailing slash", () => {
    removeWindow();
    const result = normalizeApiUrlForCurrentHost(
      "http://localhost:3002/api/health"
    );
    expect(result).toBe("http://localhost:3002/api/health");
  });

  it("preserves query params", () => {
    removeWindow();
    const result = normalizeApiUrlForCurrentHost(
      "http://localhost:3002/api?key=val"
    );
    expect(result).toContain("key=val");
  });
});
