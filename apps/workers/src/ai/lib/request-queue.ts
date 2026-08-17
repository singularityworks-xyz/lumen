import { createLogger } from "@lumen/logger";
import { createClient } from "redis";

const logger = createLogger({ name: "ai:request-queue" });
const RATE_LIMIT_PER_MINUTE = 30;
const WINDOW_SIZE_MS = 60_000;
const REDIS_KEY_PREFIX = "lumen:ai:ratelimit";

export type Priority = "high" | "normal" | "low";

type RedisClient = ReturnType<typeof createClient>;

interface QueueStatus {
  estimatedWaitMs: number;
  position: number;
  queueLength: number;
}

interface QueuedRequest<T> {
  addedAt: number;
  execute: () => Promise<T>;
  id: string;
  priority: Priority;
  reject: (error: Error) => void;
  resolve: (value: T) => void;
  workspaceId?: string;
}

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error("REDIS_URL environment variable is required");
}

let redisClient: RedisClient | null = null;
let redisConnectPromise: Promise<void> | null = null;
let redisReady = false;
let lastKnownRemaining = RATE_LIMIT_PER_MINUTE;

const REDIS_SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call("ZREMRANGEBYSCORE", key, 0, now - window)

local count = redis.call("ZCARD", key)
if count >= limit then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local reset = now + window
  if oldest[2] ~= nil then
    reset = tonumber(oldest[2]) + window
  end
  return {0, 0, reset}
end

redis.call("ZADD", key, now, member)
redis.call("PEXPIRE", key, window)

return {1, limit - count - 1, now + window}
`;

function parseInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function updateRateLimiterState(remaining: number): void {
  lastKnownRemaining = remaining;
}

function createRateLimitMember(now: number): string {
  return `${now}-${Math.random().toString(36).slice(2, 9)}`;
}

try {
  const client = createClient({
    url: REDIS_URL,
    socket: {
      connectTimeout: 1000,
    },
  });

  client.on("error", (error) => {
    redisReady = false;
    logger.error("Redis rate limiter error", {
      error: error instanceof Error ? error.message : "Unknown",
      url: REDIS_URL,
    });
  });

  client.on("ready", () => {
    redisReady = true;
    logger.info("Redis rate limiter ready", {
      rateLimit: RATE_LIMIT_PER_MINUTE,
      url: REDIS_URL,
      windowSize: "60s",
    });
  });

  redisClient = client;
  redisConnectPromise = client
    .connect()
    .then(() => {
      redisReady = true;
      logger.info("Redis rate limiter initialized", {
        rateLimit: RATE_LIMIT_PER_MINUTE,
        url: REDIS_URL,
        windowSize: "60s",
      });
    })
    .catch((error) => {
      redisClient = null;
      redisReady = false;
      logger.error("Failed to connect to Redis", {
        error: error instanceof Error ? error.message : "Unknown",
        url: REDIS_URL,
      });
      throw new Error("Redis connection failed");
    });
} catch (error) {
  logger.error("Failed to initialize Redis client", {
    error: error instanceof Error ? error.message : "Unknown",
    url: REDIS_URL,
  });
  throw new Error("Redis initialization failed");
}

// Rate limiter that uses Redis
async function checkRateLimit(identifier = "global"): Promise<{
  success: boolean;
  remaining: number;
  resetMs: number;
}> {
  if (!redisClient) {
    throw new Error("Redis client not initialized");
  }

  try {
    if (redisConnectPromise) {
      await redisConnectPromise;
    }

    if (!(redisClient.isReady && redisReady)) {
      throw new Error("Redis is not ready");
    }

    const now = Date.now();
    const rawResult = await redisClient.eval(REDIS_SLIDING_WINDOW_SCRIPT, {
      keys: [`${REDIS_KEY_PREFIX}:${identifier}`],
      arguments: [
        String(now),
        String(WINDOW_SIZE_MS),
        String(RATE_LIMIT_PER_MINUTE),
        createRateLimitMember(now),
      ],
    });

    if (Array.isArray(rawResult) && rawResult.length >= 3) {
      const successFlag = parseInteger(rawResult[0]);
      const remaining = parseInteger(rawResult[1]);
      const resetAt = parseInteger(rawResult[2]);

      if (successFlag !== null && remaining !== null && resetAt !== null) {
        updateRateLimiterState(remaining);
        return {
          success: successFlag === 1,
          remaining,
          resetMs: Math.max(0, resetAt - now),
        };
      }
    }

    throw new Error("Redis rate limiter returned an invalid result");
  } catch (error) {
    redisReady = false;
    logger.error("Redis rate limit check failed", {
      error: error instanceof Error ? error.message : "Unknown",
      identifier,
    });
    throw new Error("Redis rate limit check failed");
  }
}

// Rate-limited request queue with priority support
// Uses Redis for distributed rate limiting (mandatory)
class RateLimitedQueue {
  private readonly queue: QueuedRequest<unknown>[] = [];
  private processing = false;
  private activeRequests = 0;

  getQueueStatus(requestId: string): QueueStatus | null {
    const position = this.queue.findIndex((r) => r.id === requestId);
    if (position === -1) {
      return null;
    }

    const estimatedWaitMs = this.estimateWaitTime(position);
    return {
      position: position + 1,
      estimatedWaitMs,
      queueLength: this.queue.length,
    };
  }

  // Get current stats about the queue
  getStats(): {
    queueLength: number;
    activeRequests: number;
    isProcessing: boolean;
    remaining: number;
    usingRedis: boolean;
  } {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      isProcessing: this.processing,
      remaining: lastKnownRemaining,
      usingRedis: true,
    };
  }

  // Enqueue a request with priority
  // Returns a promise that resolves when the request completes
  async enqueue<T>(
    execute: () => Promise<T>,
    options: {
      priority?: Priority;
      workspaceId?: string;
    } = {}
  ): Promise<{ result: T; wasQueued: boolean; waitTimeMs?: number }> {
    const { priority = "normal", workspaceId } = options;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const rateLimitResult = await checkRateLimit("ai-requests");

    if (rateLimitResult.success) {
      logger.debug("Executing request immediately", {
        requestId,
        priority,
        workspaceId,
        remaining: rateLimitResult.remaining,
      });

      this.activeRequests += 1;
      try {
        const result = await execute();
        return { result, wasQueued: false };
      } finally {
        this.activeRequests -= 1;
      }
    }

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        id: requestId,
        priority,
        execute,
        resolve: (result: T) =>
          resolve({
            result,
            wasQueued: true,
            waitTimeMs: Date.now() - startTime,
          }),
        reject,
        addedAt: startTime,
        workspaceId,
      };

      this.addToQueue(queuedRequest as QueuedRequest<unknown>);

      const position = this.queue.findIndex((r) => r.id === requestId) + 1;
      logger.info("Request queued", {
        requestId,
        priority,
        workspaceId,
        position,
        queueLength: this.queue.length,
        estimatedWaitMs: rateLimitResult.resetMs,
      });

      this.processQueue();
    });
  }

  // Enqueue a request but don't wait for it (fire and forget with callback)
  enqueueAsync<T>(
    execute: () => Promise<T>,
    options: {
      priority?: Priority;
      workspaceId?: string;
      onComplete?: (result: T, wasQueued: boolean) => void;
      onError?: (error: Error) => void;
    } = {}
  ): { requestId: string; getStatus: () => QueueStatus | null } {
    const { priority = "normal", workspaceId, onComplete, onError } = options;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Start the enqueue process
    this.enqueue(execute, { priority, workspaceId })
      .then(({ result, wasQueued }) => onComplete?.(result, wasQueued))
      .catch((error) => onError?.(error));

    return {
      requestId,
      getStatus: () => this.getQueueStatus(requestId),
    };
  }

  private addToQueue(request: QueuedRequest<unknown>): void {
    // Insert based on priority (high > normal > low)
    const priorityOrder: Record<Priority, number> = {
      high: 0,
      normal: 1,
      low: 2,
    };

    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i += 1) {
      if (
        priorityOrder[request.priority] < priorityOrder[this.queue[i].priority]
      ) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, request);
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        await this.waitForSlot();

        const request = this.queue.shift();
        if (!request) {
          continue;
        }

        const waitTime = Date.now() - request.addedAt;
        logger.info("Processing queued request", {
          requestId: request.id,
          priority: request.priority,
          workspaceId: request.workspaceId,
          waitTimeMs: waitTime,
          remainingInQueue: this.queue.length,
        });

        this.activeRequests += 1;
        try {
          const result = await request.execute();
          request.resolve(result);
        } catch (error) {
          request.reject(
            error instanceof Error ? error : new Error("Unknown error")
          );
        } finally {
          this.activeRequests -= 1;
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async waitForSlot(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      const result = await checkRateLimit("ai-requests");

      if (result.success) {
        return;
      }

      // Wait until reset time (with a minimum of 1 second)
      const waitTime = Math.max(1000, Math.min(result.resetMs, 5000));
      logger.debug("Rate limit reached, waiting for slot", {
        waitTimeMs: waitTime,
        remaining: result.remaining,
        attempt: attempts + 1,
      });

      await this.sleep(waitTime);
      attempts += 1;
    }

    throw new Error("Rate limit wait timeout exceeded");
  }

  private estimateWaitTime(position: number): number {
    const msPerRequest = WINDOW_SIZE_MS / RATE_LIMIT_PER_MINUTE;
    return position * msPerRequest;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const aiRequestQueue = new RateLimitedQueue();

// Re-export queue methods for direct access in tests
export const getQueueStatus = (requestId: string) =>
  aiRequestQueue.getQueueStatus(requestId);

export function getQueueStats() {
  return aiRequestQueue.getStats();
}

export function isRedisEnabled(): boolean {
  return Boolean(redisClient && redisReady);
}
