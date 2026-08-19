// biome-ignore lint/performance/noBarrelFile: AI module barrel export
export {
  addMessage,
  clearConversation,
  getConversationContext,
  getOrCreateConversation,
  onTitleGenerated,
  toApiMessages,
  updateConversationTitle,
} from "./chats/conversation-service";
export {
  cleanupOldConversations,
  needsSummarization,
  runMaintenanceTasks,
  summarizeConversation,
} from "./chats/summarization";
export {
  generateConversationTitle,
  shouldGenerateTitle,
} from "./chats/title-generator";
export { isEncryptionEnabled } from "./lib/encryption";
export {
  recordAiError,
  recordAiRequest,
  recordMemoryRecall,
  recordMemoryRecallDuration,
  recordMemoryRetain,
  recordModelFallback,
  recordRateLimitHit,
  recordStreamDuration,
  recordTokenUsage,
} from "./lib/metrics";
export {
  aiRequestQueue,
  getQueueStats,
  isRedisEnabled,
} from "./lib/request-queue";
export {
  getModel,
  getModelChain,
  isAiEnabled,
  isRateLimitError,
} from "./providers";
export { aiRoutes } from "./routes";
export type { ToolExecutionResult } from "./tools/tool-executor";
export { executeTool, executeToolDirect } from "./tools/tool-executor";
