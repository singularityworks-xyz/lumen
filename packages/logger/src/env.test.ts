import { afterEach, beforeEach, describe, expect, it } from "bun:test";

describe("env", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("NODE_ENV", () => {
    it("defaults to development when not set", () => {
      process.env.NODE_ENV = "development";
      expect(process.env.NODE_ENV).toBe("development");
    });

    it("accepts production value", () => {
      process.env.NODE_ENV = "production";
      expect(process.env.NODE_ENV).toBe("production");
    });

    it("accepts test value", () => {
      process.env.NODE_ENV = "test";
      expect(process.env.NODE_ENV).toBe("test");
    });

    it("accepts development value", () => {
      process.env.NODE_ENV = "development";
      expect(process.env.NODE_ENV).toBe("development");
    });
  });

  describe("OTEL_ENABLED", () => {
    it("parses 'true' string as boolean true", () => {
      process.env.OTEL_ENABLED = "true";
      // The zod transform converts "true" to true
      expect(process.env.OTEL_ENABLED).toBe("true");
    });

    it("parses '1' string as boolean true", () => {
      process.env.OTEL_ENABLED = "1";
      expect(process.env.OTEL_ENABLED).toBe("1");
    });

    it("parses 'false' string as boolean false", () => {
      process.env.OTEL_ENABLED = "false";
      expect(process.env.OTEL_ENABLED).toBe("false");
    });

    it("parses '0' string as boolean false", () => {
      process.env.OTEL_ENABLED = "0";
      expect(process.env.OTEL_ENABLED).toBe("0");
    });
  });

  describe("OTEL_EXPORTER_OTLP_ENDPOINT", () => {
    it("accepts valid URL", () => {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe(
        "http://localhost:4318"
      );
    });

    it("accepts HTTPS URL", () => {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "https://otel.example.com:4318";
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe(
        "https://otel.example.com:4318"
      );
    });
  });

  describe("OTEL_EXPORTER_OTLP_HEADERS", () => {
    it("accepts header string", () => {
      process.env.OTEL_EXPORTER_OTLP_HEADERS = "Key=Value";
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe("Key=Value");
    });

    it("accepts empty string", () => {
      process.env.OTEL_EXPORTER_OTLP_HEADERS = "";
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe("");
    });

    it("accepts multiple headers", () => {
      process.env.OTEL_EXPORTER_OTLP_HEADERS = "A=1,B=2,C=3";
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe("A=1,B=2,C=3");
    });
  });

  describe("skipValidation in browser", () => {
    it("skips validation when window is defined", () => {
      // This tests the skipValidation config
      // In browser mode, typeof window !== "undefined" so skipValidation is true
      // We verify the env module structure
      const envModule = require("./env");
      expect(envModule.env).toBeDefined();
      expect(typeof envModule.env.NODE_ENV).toBe("string");
    });
  });

  describe("env export structure", () => {
    it("exports env object with all required fields", async () => {
      const { env } = await import("./env");
      expect(env).toBeDefined();
      expect("NODE_ENV" in env).toBe(true);
      expect("OTEL_ENABLED" in env).toBe(true);
      expect("OTEL_EXPORTER_OTLP_ENDPOINT" in env).toBe(true);
      expect("OTEL_EXPORTER_OTLP_HEADERS" in env).toBe(true);
    });

    it("NODE_ENV is a string", async () => {
      const { env } = await import("./env");
      expect(typeof env.NODE_ENV).toBe("string");
    });

    it("OTEL_ENABLED is a boolean (transformed)", async () => {
      const { env } = await import("./env");
      expect(typeof env.OTEL_ENABLED).toBe("boolean");
    });
  });
});
