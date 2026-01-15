// biome-ignore lint/performance/noBarrelFile: AI module barrel export
export {
  addMessage,
  clearConversation,
  getConversationContext,
  getOrCreateConversation,
  onTitleGenerated,
  toApiMessages,
  updateConversationTitle,
} from "./conversation-service";
export { isEncryptionEnabled } from "./encryption";
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
export {
  aiRequestQueue,
  getQueueStats,
  isUpstashEnabled,
} from "./request-queue";
export { aiRoutes } from "./routes";
export {
  cleanupOldConversations,
  needsSummarization,
  runMaintenanceTasks,
  summarizeConversation,
} from "./summarization";
export {
  generateConversationTitle,
  shouldGenerateTitle,
} from "./title-generator";
