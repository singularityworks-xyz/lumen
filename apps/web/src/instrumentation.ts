export async function register() {
  // Only initialize OTEL on the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initOtel } = await import("@lumen/logger/server");
    initOtel("lumen-web");
  }
}
