import { getMeter } from "@lumen/logger/server";

type Meter = ReturnType<typeof getMeter>;
type Counter = ReturnType<Meter["createCounter"]>;
type Histogram = ReturnType<Meter["createHistogram"]>;

let aiMeter: Meter | null = null;
let aiRequestCounter: Counter | null = null;
let aiTokenCounter: Counter | null = null;
let aiStreamDurationHistogram: Histogram | null = null;
let aiModelFallbackCounter: Counter | null = null;
let aiRateLimitCounter: Counter | null = null;
let aiErrorCounter: Counter | null = null;
let aiMemoryRecallCounter: Counter | null = null;
let aiMemoryRecallDurationHistogram: Histogram | null = null;
let aiMemoryRetainCounter: Counter | null = null;

function ensureAiMetrics(): void {
  if (aiMeter) {
    return;
  }

  aiMeter = getMeter("lumen-ai");

  // Total AI requests
  aiRequestCounter = aiMeter.createCounter("ai_requests_total", {
    description: "Total number of AI chat requests",
  });

  // Token usage
  aiTokenCounter = aiMeter.createCounter("ai_tokens_total", {
    description: "Total tokens used by AI (input, output, cached)",
  });

  // Streaming duration
  aiStreamDurationHistogram = aiMeter.createHistogram(
    "ai_stream_duration_seconds",
    {
      description: "Duration of AI streaming responses in seconds",
      unit: "s",
    }
  );

  // Model fallback events
  aiModelFallbackCounter = aiMeter.createCounter("ai_model_fallbacks_total", {
    description: "Number of times a model fallback occurred due to rate limits",
  });

  // Rate limit hits
  aiRateLimitCounter = aiMeter.createCounter("ai_rate_limits_total", {
    description: "Number of rate limit errors encountered",
  });

  // AI errors
  aiErrorCounter = aiMeter.createCounter("ai_errors_total", {
    description: "Total number of AI errors",
  });

  // Long-term memory
  aiMemoryRecallCounter = aiMeter.createCounter("ai_memory_recalls_total", {
    description: "Total number of long-term memory recalls",
  });
  aiMemoryRecallDurationHistogram = aiMeter.createHistogram(
    "ai_memory_recall_duration_seconds",
    {
      description: "Duration of long-term memory recall in seconds",
      unit: "s",
    }
  );
  aiMemoryRetainCounter = aiMeter.createCounter("ai_memory_retains_total", {
    description: "Total number of conversation turns retained",
  });
}

export function recordAiRequest(attributes: {
  model: string;
  workspaceId: string;
  status: "success" | "error" | "rate_limited";
}): void {
  ensureAiMetrics();
  aiRequestCounter?.add(1, {
    model: attributes.model,
    workspace_id: attributes.workspaceId,
    status: attributes.status,
  });
}

export function recordTokenUsage(attributes: {
  model: string;
  type: "input" | "output" | "cached";
  count: number;
}): void {
  ensureAiMetrics();
  aiTokenCounter?.add(attributes.count, {
    model: attributes.model,
    token_type: attributes.type,
  });
}

export function recordStreamDuration(
  durationSeconds: number,
  attributes: {
    model: string;
    success: boolean;
  }
): void {
  ensureAiMetrics();
  aiStreamDurationHistogram?.record(durationSeconds, {
    model: attributes.model,
    success: String(attributes.success),
  });
}

export function recordModelFallback(attributes: {
  fromModel: string;
  toModel: string;
  reason: "rate_limit" | "error";
}): void {
  ensureAiMetrics();
  aiModelFallbackCounter?.add(1, {
    from_model: attributes.fromModel,
    to_model: attributes.toModel,
    reason: attributes.reason,
  });
}

export function recordRateLimitHit(attributes: {
  model: string;
  retryAfterSeconds?: number;
}): void {
  ensureAiMetrics();
  aiRateLimitCounter?.add(1, {
    model: attributes.model,
  });
}

export function recordAiError(attributes: {
  model: string;
  errorType: "rate_limit" | "api_error" | "timeout" | "unknown";
}): void {
  ensureAiMetrics();
  aiErrorCounter?.add(1, {
    model: attributes.model,
    error_type: attributes.errorType,
  });
}

export function recordMemoryRecall(attributes: {
  status: "disabled" | "empty" | "error" | "success";
  containers: number;
  workspaceId?: string;
}): void {
  ensureAiMetrics();
  aiMemoryRecallCounter?.add(1, {
    status: attributes.status,
    containers: String(attributes.containers),
    workspace_id: attributes.workspaceId ?? "",
  });
}

export function recordMemoryRecallDuration(
  durationSeconds: number,
  attributes: {
    status: "disabled" | "empty" | "error" | "success";
    containers: number;
    workspaceId?: string;
  }
): void {
  ensureAiMetrics();
  aiMemoryRecallDurationHistogram?.record(durationSeconds, {
    status: attributes.status,
    containers: String(attributes.containers),
    workspace_id: attributes.workspaceId ?? "",
  });
}

export function recordMemoryRetain(attributes: {
  status: "disabled" | "partial" | "error" | "success";
  containers: number;
}): void {
  ensureAiMetrics();
  aiMemoryRetainCounter?.add(1, {
    status: attributes.status,
    containers: String(attributes.containers),
  });
}
