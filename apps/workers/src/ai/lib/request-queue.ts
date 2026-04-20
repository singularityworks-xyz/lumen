import { createLogger } from "@lumen/logger";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const logger = createLogger({ name: "ai:request-queue" });
const RATE_LIMIT_PER_MINUTE = 30;
const WINDOW_SIZE_MS = 60_000;

export type Priority = "high" | "normal" | "low";

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

const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const isUpstashConfigured = Boolean(UPSTASH_REDIS_URL && UPSTASH_REDIS_TOKEN);
let upstashRatelimit: Ratelimit | null = null;

if (isUpstashConfigured) {
  try {
    const redis = new Redis({
      url: UPSTASH_REDIS_URL ?? "",
      token: UPSTASH_REDIS_TOKEN ?? "",
    });

    upstashRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_PER_MINUTE, "60 s"),
      analytics: true,
      prefix: "lumen:ai:ratelimit",
    });

    logger.info("Upstash Redis rate limiter initialized", {
      rateLimit: RATE_LIMIT_PER_MINUTE,
      windowSize: "60s",
    });
  } catch (error) {
    logger.error("Failed to initialize Upstash Redis", {
      error: error instanceof Error ? error.message : "Unknown",
    });
  }
}

if (!isUpstashConfigured) {
  logger.warn(
    "Upstash Redis not configured, using in-memory rate limiting. " +
      "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production."
  );
}

class InMemoryRateLimiter {
  private timestamps: number[] = [];

  reset(): void {
    this.timestamps = [];
  }

  limit(): {
    success: boolean;
    remaining: number;
    reset: number;
  } {
    const now = Date.now();
    const cutoff = now - WINDOW_SIZE_MS;
    this.timestamps = this.timestamps.filter((ts) => ts >= cutoff);

    if (this.timestamps.length >= RATE_LIMIT_PER_MINUTE) {
      const oldestTimestamp = this.timestamps[0];
      const reset = oldestTimestamp + WINDOW_SIZE_MS;
      return {
        success: false,
        remaining: 0,
        reset,
      };
    }

    this.timestamps.push(now);
    return {
      success: true,
      remaining: RATE_LIMIT_PER_MINUTE - this.timestamps.length,
      reset: now + WINDOW_SIZE_MS,
    };
  }

  getRemaining(): number {
    const now = Date.now();
    const cutoff = now - WINDOW_SIZE_MS;
    const validTimestamps = this.timestamps.filter((ts) => ts >= cutoff);
    return RATE_LIMIT_PER_MINUTE - validTimestamps.length;
  }
}

const inMemoryLimiter = new InMemoryRateLimiter();

// Export for testing only
export function _resetInMemoryLimiter(): void {
  inMemoryLimiter.reset();
}

// Unified rate limiter that uses Upstash when available, falls back to in-memory
async function checkRateLimit(identifier = "global"): Promise<{
  success: boolean;
  remaining: number;
  resetMs: number;
}> {
  if (upstashRatelimit) {
    try {
      const result = await upstashRatelimit.limit(identifier);
      return {
        success: result.success,
        remaining: result.remaining,
        resetMs: result.reset - Date.now(),
      };
    } catch (error) {
      logger.warn(
        "Upstash rate limit check failed, falling back to in-memory",
        {
          error: error instanceof Error ? error.message : "Unknown",
        }
      );
    }
  }

  const result = inMemoryLimiter.limit();
  return {
    success: result.success,
    remaining: result.remaining,
    resetMs: result.reset - Date.now(),
  };
}

// Rate-limited request queue with priority support
// Uses Upstash Redis for distributed rate limiting in production
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
    usingUpstash: boolean;
  } {
    const remaining = inMemoryLimiter.getRemaining();
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      isProcessing: this.processing,
      remaining,
      usingUpstash: Boolean(upstashRatelimit),
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

export function isUpstashEnabled(): boolean {
  return Boolean(upstashRatelimit);
}
