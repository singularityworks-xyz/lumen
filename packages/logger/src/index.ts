// Core logger exports (legacy API) - browser-safe
// Config is browser-safe (no Node.js deps)
export type { OtelConfig } from "./config";
// biome-ignore lint/performance/noBarrelFile: safyy re-export
export { getOtelConfig } from "./config";
export type { Logger, LoggerOptions, LogLevel } from "./logger";
export { createChildLogger, createLogger, logger } from "./logger";
