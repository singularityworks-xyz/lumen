import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Mock env before importing config
mock.module("./env", () => ({
  env: {
    NODE_ENV: "test",
    OTEL_ENABLED: true,
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
    OTEL_EXPORTER_OTLP_HEADERS:
      "Authorization=Bearer%20Token123,InvalidHeader,ValidKey=ValidValue",
  },
}));

import { getOtelConfig } from "./config";

describe("getOtelConfig", () => {
  let originalWindow: typeof window | undefined;

  beforeEach(() => {
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error
      globalThis.window = undefined;
    } else {
      globalThis.window = originalWindow;
    }
  });

  it("disables OTEL in browser", () => {
    // @ts-expect-error
    globalThis.window = {};

    const config = getOtelConfig("test-service");

    expect(config.enabled).toBe(false);
    expect(config.endpoint).toBe("");
    expect(config.environment).toBe("browser");
    expect(config.headers).toEqual({});
  });

  it("header parsing decodes and ignores malformed pairs correctly", () => {
    // @ts-expect-error
    globalThis.window = undefined;

    const config = getOtelConfig("test-service");

    expect(config.headers).toEqual({
      Authorization: "Bearer Token123",
      ValidKey: "ValidValue",
    });
  });

  it("endpoint plus enabled flag control final activation", () => {
    // @ts-expect-error
    globalThis.window = undefined;

    // By default mocked env has enabled=true and endpoint set
    const config = getOtelConfig("test-service");
    expect(config.enabled).toBe(true);
  });
});
