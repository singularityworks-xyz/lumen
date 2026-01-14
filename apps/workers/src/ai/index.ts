// biome-ignore lint/performance/noBarrelFile: AI module barrel export
export {
  recordAiError,
  recordAiRequest,
  recordModelFallback,
  recordRateLimitHit,
  recordStreamDuration,
  recordTokenUsage,
} from "./metrics";
export {
  getModel,
  getModelChain,
  isAiEnabled,
  isRateLimitError,
} from "./providers";
export { aiRoutes } from "./routes";
