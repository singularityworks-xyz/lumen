import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const envState: Record<string, unknown> = {
  NODE_ENV: "test",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:5080",
  OPENOBSERVE_ORG: "default",
  OPENOBSERVE_LOG_STREAM: "lumen_logs",
  OPENOBSERVE_METRIC_STREAM: "lumen_metrics",
  OPENOBSERVE_TRACE_STREAM: "lumen_traces",
};

// Mirrors the zod schema defaults in env.ts: createEnv applies .default()
// when a var is unset, so the proxy must too.
const envDefaults: Record<string, unknown> = {
  NODE_ENV: "development",
  OPENOBSERVE_ORG: "default",
  OPENOBSERVE_LOG_STREAM: "lumen_logs",
  OPENOBSERVE_METRIC_STREAM: "lumen_metrics",
  OPENOBSERVE_TRACE_STREAM: "lumen_traces",
};

const envProxy = new Proxy({} as Record<string, unknown>, {
  get(_target, prop: string) {
    return envState[prop] ?? envDefaults[prop];
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

import { getOtelConfig, getOtlpSignalEndpoint } from "./config";

describe("getOtelConfig", () => {
  let originalWindow: typeof window | undefined;

  beforeEach(() => {
    originalWindow = globalThis.window;
    envState.NODE_ENV = "test";
    envState.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:5080";
    envState.OPENOBSERVE_USER = undefined;
    envState.OPENOBSERVE_PASSWORD = undefined;
    envState.OPENOBSERVE_ORG = "default";
    envState.OPENOBSERVE_LOG_STREAM = "lumen_logs";
    envState.OPENOBSERVE_METRIC_STREAM = "lumen_metrics";
    envState.OPENOBSERVE_TRACE_STREAM = "lumen_traces";
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

    it("returns enabled config with endpoint, org and streams", () => {
      const config = getOtelConfig("test-service");

      expect(config.enabled).toBe(true);
      expect(config.endpoint).toBe("http://localhost:5080");
      expect(config.org).toBe("default");
      expect(config.logStream).toBe("lumen_logs");
      expect(config.metricStream).toBe("lumen_metrics");
      expect(config.traceStream).toBe("lumen_traces");
      expect(config.environment).toBe("test");
      expect(config.serviceName).toBe("test-service");
    });

    it("applies OpenObserve defaults when env vars are unset", () => {
      envState.OPENOBSERVE_ORG = undefined;
      envState.OPENOBSERVE_LOG_STREAM = undefined;
      envState.OPENOBSERVE_METRIC_STREAM = undefined;
      envState.OPENOBSERVE_TRACE_STREAM = undefined;

      const config = getOtelConfig("svc");

      expect(config.org).toBe("default");
      expect(config.logStream).toBe("lumen_logs");
      expect(config.metricStream).toBe("lumen_metrics");
      expect(config.traceStream).toBe("lumen_traces");
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

  describe("OpenObserve Basic auth headers", () => {
    beforeEach(() => {
      // @ts-expect-error
      globalThis.window = undefined;
      envState.OPENOBSERVE_USER = undefined;
      envState.OPENOBSERVE_PASSWORD = undefined;
    });

    it("builds Basic auth from OPENOBSERVE_USER and OPENOBSERVE_PASSWORD", () => {
      envState.OPENOBSERVE_USER = "testuser";
      envState.OPENOBSERVE_PASSWORD = "testpass";

      const config = getOtelConfig("test-service");

      expect(config.headers.Authorization).toBe(
        `Basic ${Buffer.from("testuser:testpass").toString("base64")}`
      );
    });

    it("does not add an Authorization header when credentials are missing", () => {
      envState.OPENOBSERVE_USER = undefined;
      envState.OPENOBSERVE_PASSWORD = undefined;

      const config = getOtelConfig("test-service");

      expect(config.headers.Authorization).toBeUndefined();
    });

    it("does not add an Authorization header when only one credential is set", () => {
      envState.OPENOBSERVE_USER = "testuser";
      envState.OPENOBSERVE_PASSWORD = undefined;

      const config = getOtelConfig("test-service");

      expect(config.headers.Authorization).toBeUndefined();
    });
  });

  describe("activation matrix (OTEL is mandatory, driven by endpoint)", () => {
    beforeEach(() => {
      // @ts-expect-error
      globalThis.window = undefined;
    });

    it("enabled when endpoint is set", () => {
      envState.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:5080";

      const config = getOtelConfig("svc");

      expect(config.enabled).toBe(true);
    });

    it("disabled when endpoint is empty string", () => {
      envState.OTEL_EXPORTER_OTLP_ENDPOINT = "";

      const config = getOtelConfig("svc");

      expect(config.enabled).toBe(false);
    });

    it("disabled when endpoint is undefined", () => {
      envState.OTEL_EXPORTER_OTLP_ENDPOINT = undefined;

      const config = getOtelConfig("svc");

      expect(config.enabled).toBe(false);
    });
  });

  describe("getOtlpSignalEndpoint", () => {
    beforeEach(() => {
      // @ts-expect-error
      globalThis.window = undefined;
    });

    it("builds per-signal endpoints with org in the path", () => {
      const config = getOtelConfig("svc");

      expect(getOtlpSignalEndpoint(config, "traces")).toBe(
        "http://localhost:5080/api/default/v1/traces"
      );
      expect(getOtlpSignalEndpoint(config, "metrics")).toBe(
        "http://localhost:5080/api/default/v1/metrics"
      );
      expect(getOtlpSignalEndpoint(config, "logs")).toBe(
        "http://localhost:5080/api/default/v1/logs"
      );
    });

    it("strips trailing slashes from the endpoint", () => {
      envState.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:5080/";

      const config = getOtelConfig("svc");

      expect(getOtlpSignalEndpoint(config, "traces")).toBe(
        "http://localhost:5080/api/default/v1/traces"
      );
    });
  });
});
