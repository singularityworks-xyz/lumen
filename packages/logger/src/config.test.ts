import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const envState: Record<string, unknown> = {
  NODE_ENV: "test",
  OTEL_ENABLED: true,
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:5080/api/default",
  OTEL_EXPORTER_OTLP_HEADERS:
    "Authorization=Bearer%20Token123,InvalidHeader,ValidKey=ValidValue",
};

const envProxy = new Proxy({} as Record<string, unknown>, {
  get(_target, prop: string) {
    return envState[prop];
  },
  ownKeys() {
    return Reflect.ownKeys(envState);
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    if (prop in envState) {
      return { configurable: true, enumerable: true, value: envState[prop] };
    }
    return;
  },
});

mock.module("./env", () => ({
  env: envProxy,
}));

import { getOtelConfig } from "./config";

describe("getOtelConfig", () => {
  let originalWindow: typeof window | undefined;

  beforeEach(() => {
    originalWindow = globalThis.window;
    envState.NODE_ENV = "test";
    envState.OTEL_ENABLED = true;
    envState.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:5080/api/default";
    envState.OTEL_EXPORTER_OTLP_HEADERS =
      "Authorization=Bearer%20Token123,InvalidHeader,ValidKey=ValidValue";
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error
      globalThis.window = undefined;
    } else {
      globalThis.window = originalWindow;
    }
  });

  describe("browser environment resolution", () => {
    it("disables OTEL in browser mode", () => {
      // @ts-expect-error
      globalThis.window = {};

      const config = getOtelConfig("test-service");

      expect(config.enabled).toBe(false);
      expect(config.endpoint).toBe("");
      expect(config.environment).toBe("browser");
      expect(config.headers).toEqual({});
    });

    it("returns empty headers in browser mode regardless of env config", () => {
      // @ts-expect-error
      globalThis.window = {};

      const config = getOtelConfig("test-service");

      expect(config.headers).toEqual({});
    });

    it("preserves service name in browser mode", () => {
      // @ts-expect-error
      globalThis.window = {};

      const config = getOtelConfig("my-browser-svc");

      expect(config.serviceName).toBe("my-browser-svc");
    });
  });

  describe("server environment resolution", () => {
    beforeEach(() => {
      // @ts-expect-error
      globalThis.window = undefined;
    });

    it("returns enabled config with endpoint and headers", () => {
      const config = getOtelConfig("test-service");

      expect(config.enabled).toBe(true);
      expect(config.endpoint).toBe("http://localhost:5080/api/default");
      expect(config.environment).toBe("test");
      expect(config.serviceName).toBe("test-service");
    });

    it("reflects production NODE_ENV", () => {
      envState.NODE_ENV = "production";

      const config = getOtelConfig("prod-svc");

      expect(config.environment).toBe("production");
    });

    it("reflects development NODE_ENV", () => {
      envState.NODE_ENV = "development";

      const config = getOtelConfig("dev-svc");

      expect(config.environment).toBe("development");
    });
  });

  describe("OTEL header parsing", () => {
    beforeEach(() => {
      // @ts-expect-error
      globalThis.window = undefined;
    });

    it("decodes URL-encoded values and ignores malformed pairs", () => {
      const config = getOtelConfig("test-service");

      expect(config.headers).toEqual({
        Authorization: "Bearer Token123",
        ValidKey: "ValidValue",
      });
    });

    it("returns empty headers when OTEL_EXPORTER_OTLP_HEADERS is undefined", () => {
      envState.OTEL_EXPORTER_OTLP_HEADERS = undefined;

      const config = getOtelConfig("test-service");

      expect(config.headers).toEqual({});
    });

    it("returns empty headers when OTEL_EXPORTER_OTLP_HEADERS is empty string", () => {
      envState.OTEL_EXPORTER_OTLP_HEADERS = "";

      const config = getOtelConfig("test-service");

      expect(config.headers).toEqual({});
    });

    it("ignores pairs without equals sign", () => {
      envState.OTEL_EXPORTER_OTLP_HEADERS = "NoEquals,Key=Value";

      const config = getOtelConfig("test-service");

      expect(config.headers).toEqual({ Key: "Value" });
    });

    it("ignores pairs where equals is at position 0", () => {
      envState.OTEL_EXPORTER_OTLP_HEADERS = "=ValueAtStart,Key=Value";

      const config = getOtelConfig("test-service");

      expect(config.headers).toEqual({ Key: "Value" });
    });

    it("handles key=value where value contains equals sign", () => {
      envState.OTEL_EXPORTER_OTLP_HEADERS = "Token=abc=def";

      const config = getOtelConfig("test-service");

      expect(config.headers).toEqual({ Token: "abc=def" });
    });

    it("decodes percent-encoded values", () => {
      envState.OTEL_EXPORTER_OTLP_HEADERS = "Key=hello%20world";

      const config = getOtelConfig("test-service");

      expect(config.headers).toEqual({ Key: "hello world" });
    });

    it("trims whitespace around keys and values", () => {
      envState.OTEL_EXPORTER_OTLP_HEADERS = " Key1 = Value1 , Key2 = Value2 ";

      const config = getOtelConfig("test-service");

      expect(config.headers).toEqual({ Key1: "Value1", Key2: "Value2" });
    });

    it("handles multiple comma-separated headers", () => {
      envState.OTEL_EXPORTER_OTLP_HEADERS = "A=1,B=2,C=3";

      const config = getOtelConfig("test-service");

      expect(config.headers).toEqual({ A: "1", B: "2", C: "3" });
    });
  });

  describe("enabled/disabled activation matrix", () => {
    beforeEach(() => {
      // @ts-expect-error
      globalThis.window = undefined;
    });

    it("enabled when OTEL_ENABLED=true and endpoint is set", () => {
      envState.OTEL_ENABLED = true;
      envState.OTEL_EXPORTER_OTLP_ENDPOINT =
        "http://localhost:5080/api/default";

      const config = getOtelConfig("svc");

      expect(config.enabled).toBe(true);
    });

    it("disabled when OTEL_ENABLED=false", () => {
      envState.OTEL_ENABLED = false;
      envState.OTEL_EXPORTER_OTLP_ENDPOINT =
        "http://localhost:5080/api/default";

      const config = getOtelConfig("svc");

      expect(config.enabled).toBe(false);
    });

    it("disabled when endpoint is empty string", () => {
      envState.OTEL_ENABLED = true;
      envState.OTEL_EXPORTER_OTLP_ENDPOINT = "";

      const config = getOtelConfig("svc");

      expect(config.enabled).toBe(false);
    });

    it("disabled when endpoint is undefined", () => {
      envState.OTEL_ENABLED = true;
      envState.OTEL_EXPORTER_OTLP_ENDPOINT = undefined;

      const config = getOtelConfig("svc");

      expect(config.enabled).toBe(false);
    });

    it("disabled when both OTEL_ENABLED=false and no endpoint", () => {
      envState.OTEL_ENABLED = false;
      envState.OTEL_EXPORTER_OTLP_ENDPOINT = "";

      const config = getOtelConfig("svc");

      expect(config.enabled).toBe(false);
    });
  });
});
