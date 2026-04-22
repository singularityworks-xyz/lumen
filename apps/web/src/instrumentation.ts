const WEB_VERSION = "1.1.0";

export async function register() {
  // Only initialize OTEL on the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
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
        headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ? "set" : "not set",
      });
    } catch (error) {
      console.error(
        "[instrumentation] Failed to initialize OpenTelemetry:",
        error instanceof Error ? error.message : error
      );
    }
  }
}
