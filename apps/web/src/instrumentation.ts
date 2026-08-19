const WEB_VERSION = "1.1.35";

// Production startup gate: the container refuses to boot without the
// observability stack it is configured to export to. Runs here (server
// boot only) — this file is never bundled client-side, so process.exit is
// safe. Vars required by the env schema with defaults (org/streams) are
// excluded; these three have no meaningful default.
const PRODUCTION_REQUIRED_ENV: Array<{ key: string; purpose: string }> = [
  {
    key: "OTEL_EXPORTER_OTLP_ENDPOINT",
    purpose: "OpenTelemetry export (OpenObserve)",
  },
  { key: "OPENOBSERVE_USER", purpose: "OpenObserve auth" },
  { key: "OPENOBSERVE_PASSWORD", purpose: "OpenObserve auth" },
];

export async function register() {
  // Only initialize OTEL on the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV === "production") {
      const missing = PRODUCTION_REQUIRED_ENV.filter(
        ({ key }) => !process.env[key]
      );
      if (missing.length > 0) {
        const detail = missing
          .map(({ key, purpose }) => `  - ${key} (${purpose})`)
          .join("\n");
        console.error(
          [
            "",
            "Production startup check failed:",
            `${missing.length} required environment variable(s) are missing.`,
            detail,
            "Set them in the deployment environment (Dokploy) before starting the container.",
            "",
          ].join("\n")
        );
        process.exit(1);
      }
    }

    try {
      const { initOtel } = await import("@lumen/logger/server");
      const { createLogger } = await import("@lumen/logger");
      const { PrismaInstrumentation } = await import("@prisma/instrumentation");
      const logger = createLogger({ name: "instrumentation" });
      const initialized = initOtel("lumen-web", [new PrismaInstrumentation()], {
        serviceVersion: WEB_VERSION,
        samplingRatio: 0.2,
      });
      logger.info("[instrumentation] OpenTelemetry initialized:", {
        initialized,
        endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? "set" : "not set",
        auth:
          process.env.OPENOBSERVE_USER && process.env.OPENOBSERVE_PASSWORD
            ? "basic-auth set"
            : "not set",
        org: process.env.OPENOBSERVE_ORG ?? "default",
        logStream: process.env.OPENOBSERVE_LOG_STREAM ?? "lumen_web_logs",
        metricStream:
          process.env.OPENOBSERVE_METRIC_STREAM ?? "lumen_web_metrics",
        traceStream: process.env.OPENOBSERVE_TRACE_STREAM ?? "lumen_web_traces",
      });
    } catch (error) {
      console.error(
        "[instrumentation] Failed to initialize OpenTelemetry:",
        error instanceof Error ? error.message : error
      );
    }
  }
}
