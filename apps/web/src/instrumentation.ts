export async function register() {
  // Only initialize OTEL on the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { initOtel } = await import("@lumen/logger/server");
      const { PrismaInstrumentation } = await import("@prisma/instrumentation");
      initOtel("lumen-web", [new PrismaInstrumentation()]);
      console.log("[instrumentation] OpenTelemetry initialized successfully");
    } catch (error) {
      console.error(
        "[instrumentation] Failed to initialize OpenTelemetry:",
        error instanceof Error ? error.message : error
      );
    }
  }
}
