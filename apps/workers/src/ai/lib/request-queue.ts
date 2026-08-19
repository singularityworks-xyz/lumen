import { createLogger } from "@lumen/logger";
import { createClient } from "redis";

const logger = createLogger({ name: "ai:request-queue" });

// GeneralCompute rate limits (https://docs.generalcompute.com):
// - 100 requests per minute
// - 200,000 tokens per minute
export const RATE_LIMIT_PER_MINUTE = 100;
export const TOKEN_LIMIT_PER_MINUTE = 200_000;
const WINDOW_SIZE_MS = 60_000;
const REDIS_KEY_PREFIX = "lumen:ai:ratelimit";

// Default token reservation for calls that don't pass an explicit estimate.
// Callers that know their real usage should pass estimatedTokens and release
// with actual tokens afterwards.
const DEFAULT_TOKEN_ESTIMATE = 4096;

export type Priority = "high" | "normal" | "low";

type RedisClient = ReturnType<typeof createClient>;

interface QueueStatus {
  estimatedWaitMs: number;
  position: number;
  queueLength: number;
}

interface QueuedRequest {
  addedAt: number;
  estimatedTokens: number;
  id: string;
  onCapacity: (reservation: CapacityReservation) => void;
  onReject: (error: Error) => void;
  priority: Priority;
  workspaceId?: string;
}

export interface CapacityReservation {
  releaseTokens: (actualTokens: number) => Promise<void>;
}

interface CapacityResult {
  releaseTokens: (actualTokens: number) => Promise<void>;
}

const REDIS_URL = process.env.REDIS_URL;

let redisClient: RedisClient | null = null;
let redisConnectPromise: Promise<void> | null = null;
let redisReady = false;
let redisInitialized = false;
let lastKnownRemaining = RATE_LIMIT_PER_MINUTE;
let lastKnownTokensRemaining = TOKEN_LIMIT_PER_MINUTE;

// Atomically checks the request slot AND token budgets and reserves both
// together, so a request slot is never consumed when the token budget is
// exhausted (and vice versa).
const REDIS_CAPACITY_SCRIPT = `
local slotKey = KEYS[1]
local tokenKey = KEYS[2]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local slotLimit = tonumber(ARGV[3])
local tokenLimit = tonumber(ARGV[4])
local slotMember = ARGV[5]
local tokenMember = ARGV[6]
local estimatedTokens = tonumber(ARGV[7])

redis.call("ZREMRANGEBYSCORE", slotKey, 0, now - window)
redis.call("ZREMRANGEBYSCORE", tokenKey, 0, now - window)

local slotCount = redis.call("ZCARD", slotKey)
local slotRemaining = slotLimit - slotCount

local totalTokens = 0
local members = redis.call("ZRANGE", tokenKey, 0, -1)
for i = 1, #members do
  local _, _, count = string.find(members[i], ":(%-?%d+)$")
  if count ~= nil then
    totalTokens = totalTokens + tonumber(count)
  end
end

-- Result shape (every branch): {success, slotsRemaining, tokensRemaining, resetAt}
if slotCount >= slotLimit then
  local oldest = redis.call("ZRANGE", slotKey, 0, 0, "WITHSCORES")
  local reset = now + window
  if oldest[2] ~= nil then
    reset = tonumber(oldest[2]) + window
  end
  return {0, 0, tokenLimit - totalTokens, reset}
end

if totalTokens + estimatedTokens > tokenLimit then
  local oldest = redis.call("ZRANGE", tokenKey, 0, 0, "WITHSCORES")
  local reset = now + window
  if oldest[2] ~= nil then
    reset = tonumber(oldest[2]) + window
  end
  return {0, slotRemaining, 0, reset}
end

redis.call("ZADD", slotKey, now, slotMember)
redis.call("PEXPIRE", slotKey, window)
redis.call("ZADD", tokenKey, now, tokenMember)
redis.call("PEXPIRE", tokenKey, window)

return {1, slotRemaining - 1, tokenLimit - totalTokens - estimatedTokens, now + window}
`;

// Releases a token reservation. If actualTokens > 0 the reservation is
// re-added with the real token count (refunding the over-estimate);
// otherwise it is removed entirely.
const REDIS_TOKEN_RELEASE_SCRIPT = `
local tokenKey = KEYS[1]
local storedMember = ARGV[1]
local bareMember = ARGV[2]
local actualTokens = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local window = tonumber(ARGV[5])

redis.call("ZREM", tokenKey, storedMember)
if actualTokens > 0 then
  redis.call("ZADD", tokenKey, now, bareMember .. ":" .. actualTokens)
  redis.call("PEXPIRE", tokenKey, window)
end
return 1
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

function updateRateLimiterState(remaining: number, tokensRemaining: number) {
  lastKnownRemaining = remaining;
  lastKnownTokensRemaining = tokensRemaining;
}

function createMember(now: number): string {
  return `${now}-${Math.random().toString(36).slice(2, 9)}`;
}

// Redis is initialized lazily on first use so importing this module (and the
// AI routes) never requires Redis to be reachable at load time.
function ensureRedisInitialized(): void {
  if (redisInitialized) {
    return;
  }
  redisInitialized = true;

  if (!REDIS_URL) {
    logger.error(
      "REDIS_URL environment variable is required for AI rate limiting"
    );
    return;
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
      });
    });

    client.on("ready", () => {
      redisReady = true;
      logger.info("Redis rate limiter ready", {
        rateLimit: RATE_LIMIT_PER_MINUTE,
        tokenLimit: TOKEN_LIMIT_PER_MINUTE,
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
          tokenLimit: TOKEN_LIMIT_PER_MINUTE,
          windowSize: "60s",
        });
      })
      .catch((error) => {
        redisClient = null;
        redisReady = false;
        // Reset so the next tryAcquireCapacity retries initialization
        // instead of being permanently stuck on the failed attempt
        redisInitialized = false;
        logger.error("Failed to connect to Redis", {
          error: error instanceof Error ? error.message : "Unknown",
        });
      });
  } catch (error) {
    redisClient = null;
    redisReady = false;
    redisInitialized = false;
    logger.error("Failed to initialize Redis client", {
      error: error instanceof Error ? error.message : "Unknown",
    });
  }
}

// Attempts to acquire a request slot and a token reservation together.
// Returns { result: null, resetMs } when either limit is currently exhausted.
async function tryAcquireCapacity(
  estimatedTokens: number
): Promise<{ result: CapacityResult | null; resetMs: number }> {
  ensureRedisInitialized();

  if (!redisClient) {
    throw new Error(
      REDIS_URL
        ? "Redis rate limiter is not initialized"
        : "REDIS_URL environment variable is required"
    );
  }

  try {
    if (redisConnectPromise) {
      await redisConnectPromise;
    }

    if (!(redisClient.isReady && redisReady)) {
      throw new Error("Redis is not ready");
    }

    const now = Date.now();
    const slotMember = createMember(now);
    const tokenBare = `tok_${now}_${Math.random().toString(36).slice(2, 9)}`;
    const tokenStored = `${tokenBare}:${estimatedTokens}`;

    const rawResult = await redisClient.eval(REDIS_CAPACITY_SCRIPT, {
      keys: [
        `${REDIS_KEY_PREFIX}:ai-requests`,
        `${REDIS_KEY_PREFIX}:ai-tokens`,
      ],
      arguments: [
        String(now),
        String(WINDOW_SIZE_MS),
        String(RATE_LIMIT_PER_MINUTE),
        String(TOKEN_LIMIT_PER_MINUTE),
        slotMember,
        tokenStored,
        String(estimatedTokens),
      ],
    });

    if (Array.isArray(rawResult) && rawResult.length >= 4) {
      const successFlag = parseInteger(rawResult[0]);
      const remaining = parseInteger(rawResult[1]);
      const tokensRemaining = parseInteger(rawResult[2]);
      const resetAt = parseInteger(rawResult[3]);

      if (
        successFlag !== null &&
        remaining !== null &&
        tokensRemaining !== null &&
        resetAt !== null
      ) {
        updateRateLimiterState(remaining, tokensRemaining);

        if (successFlag === 1) {
          return {
            result: {
              releaseTokens: async (actualTokens: number) => {
                try {
                  await releaseTokenReservation(
                    tokenStored,
                    tokenBare,
                    actualTokens
                  );
                } catch (error) {
                  logger.warn("Failed to release token reservation", {
                    error: error instanceof Error ? error.message : "Unknown",
                  });
                }
              },
            },
            resetMs: Math.max(0, resetAt - now),
          };
        }

        return {
          result: null,
          resetMs: Math.max(0, resetAt - now),
        };
      }
    }

    throw new Error("Redis rate limiter returned an invalid result");
  } catch (error) {
    redisReady = false;
    logger.error("Redis rate limit check failed", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    throw new Error("Redis rate limit check failed");
  }
}

async function releaseTokenReservation(
  storedMember: string,
  bareMember: string,
  actualTokens: number
): Promise<void> {
  ensureRedisInitialized();

  if (!redisClient) {
    return;
  }

  try {
    if (redisConnectPromise) {
      await redisConnectPromise;
    }

    if (redisClient.isReady && redisReady) {
      await redisClient.eval(REDIS_TOKEN_RELEASE_SCRIPT, {
        keys: [`${REDIS_KEY_PREFIX}:ai-tokens`],
        arguments: [
          storedMember,
          bareMember,
          String(Math.max(0, Math.floor(actualTokens))),
          String(Date.now()),
          String(WINDOW_SIZE_MS),
        ],
      });
    }
  } catch (error) {
    logger.warn("Failed to release token reservation", {
      error: error instanceof Error ? error.message : "Unknown",
    });
  }
}

// Rate-limited request queue with priority support
// Uses Redis for distributed rate limiting (request slots + token budget)
class RateLimitedQueue {
  private readonly queue: QueuedRequest[] = [];
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
    tokensRemaining: number;
    usingRedis: boolean;
  } {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      isProcessing: this.processing,
      remaining: lastKnownRemaining,
      tokensRemaining: lastKnownTokensRemaining,
      usingRedis: isRedisEnabled(),
    };
  }

  // Enqueue a request with priority
  // Returns a promise that resolves when the request completes.
  // The returned releaseTokens(actualTokens) should be called with the real
  // token usage so over-estimated reservations are refunded.
  async enqueue<T>(
    execute: () => Promise<T>,
    options: {
      priority?: Priority;
      workspaceId?: string;
      estimatedTokens?: number;
    } = {}
  ): Promise<{
    result: T;
    wasQueued: boolean;
    waitTimeMs?: number;
    releaseTokens: (actualTokens: number) => Promise<void>;
  }> {
    const {
      priority = "normal",
      workspaceId,
      estimatedTokens = DEFAULT_TOKEN_ESTIMATE,
    } = options;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const acquired = await tryAcquireCapacity(estimatedTokens);
    if (acquired?.result) {
      logger.debug("Executing request immediately", {
        requestId,
        priority,
        workspaceId,
        remaining: lastKnownRemaining,
      });

      this.activeRequests += 1;
      try {
        const result = await execute();
        return {
          result,
          wasQueued: false,
          releaseTokens: acquired.result.releaseTokens,
        };
      } catch (error) {
        // The caller never receives releaseTokens on failure, so release the
        // reservation here (0 = no tokens actually consumed) to avoid
        // charging the full estimate until the window expires
        await acquired.result.releaseTokens(0).catch(() => undefined);
        throw error;
      } finally {
        this.activeRequests -= 1;
      }
    }

    const startTime = Date.now();
    const resetMs = acquired?.resetMs ?? WINDOW_SIZE_MS;

    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: requestId,
        priority,
        estimatedTokens,
        workspaceId,
        addedAt: startTime,
        onCapacity: (reservation) => {
          this.activeRequests += 1;
          execute()
            .then((result) =>
              resolve({
                result,
                wasQueued: true,
                waitTimeMs: Date.now() - startTime,
                releaseTokens: reservation.releaseTokens,
              })
            )
            .catch((error) => {
              // The caller never receives releaseTokens on failure, so
              // release the reservation here (0 = no tokens consumed)
              reservation.releaseTokens(0).catch(() => undefined);
              reject(
                error instanceof Error ? error : new Error("Unknown error")
              );
            })
            .finally(() => {
              this.activeRequests -= 1;
            });
        },
        onReject: reject,
      };

      this.addToQueue(queuedRequest);

      const position = this.queue.findIndex((r) => r.id === requestId) + 1;
      logger.info("Request queued", {
        requestId,
        priority,
        workspaceId,
        position,
        queueLength: this.queue.length,
        estimatedWaitMs: resetMs,
      });

      this.processQueue();
    });
  }

  // Reserve capacity (request slot + token budget) without running anything.
  // Intended for streaming callers: acquire capacity, run the stream, then
  // call reservation.releaseTokens(actualTokens) in a finally block.
  // The reservation counts as an active request until released.
  async reserveCapacity(
    options: {
      priority?: Priority;
      workspaceId?: string;
      estimatedTokens?: number;
    } = {}
  ): Promise<{
    reservation: CapacityReservation | null;
    wasQueued: boolean;
    waitTimeMs?: number;
  }> {
    const {
      priority = "normal",
      workspaceId,
      estimatedTokens = DEFAULT_TOKEN_ESTIMATE,
    } = options;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const acquired = await tryAcquireCapacity(estimatedTokens);
    if (acquired?.result) {
      this.activeRequests += 1;
      return {
        reservation: this.wrapReservation(acquired.result),
        wasQueued: false,
      };
    }

    const startTime = Date.now();
    const resetMs = acquired?.resetMs ?? WINDOW_SIZE_MS;

    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: requestId,
        priority,
        estimatedTokens,
        workspaceId,
        addedAt: startTime,
        onCapacity: (reservation) => {
          this.activeRequests += 1;
          resolve({
            reservation: this.wrapReservation(reservation),
            wasQueued: true,
            waitTimeMs: Date.now() - startTime,
          });
        },
        onReject: reject,
      };

      this.addToQueue(queuedRequest);

      const position = this.queue.findIndex((r) => r.id === requestId) + 1;
      logger.info("Capacity request queued", {
        requestId,
        priority,
        workspaceId,
        position,
        queueLength: this.queue.length,
        estimatedWaitMs: resetMs,
      });

      this.processQueue();
    });
  }

  // Wraps a reservation so its release is idempotent: activeRequests is
  // decremented at most once per reservation, and the underlying Redis
  // release runs at most once. Double releases (buggy callers, finally
  // blocks that also release explicitly) cannot corrupt the counters.
  private wrapReservation(
    reservation: CapacityReservation
  ): CapacityReservation {
    let released = false;
    const originalRelease = reservation.releaseTokens;

    return {
      releaseTokens: async (actualTokens: number) => {
        if (released) {
          return;
        }
        released = true;
        this.activeRequests -= 1;
        await originalRelease(actualTokens);
      },
    };
  }

  private addToQueue(request: QueuedRequest): void {
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
        const request = this.queue.shift();
        if (!request) {
          continue;
        }

        let reservation: CapacityReservation;
        try {
          reservation = await this.acquireWithRetry(request.estimatedTokens);
        } catch (error) {
          // Reject current request and all remaining on rate limit failure
          const queueError =
            error instanceof Error
              ? error
              : new Error("Unknown rate limit error");
          request.onReject(queueError);
          while (this.queue.length > 0) {
            const remainingRequest = this.queue.shift();
            if (remainingRequest) {
              remainingRequest.onReject(queueError);
            }
          }
          return;
        }

        const waitTime = Date.now() - request.addedAt;
        logger.info("Processing queued request", {
          requestId: request.id,
          priority: request.priority,
          workspaceId: request.workspaceId,
          waitTimeMs: waitTime,
          remainingInQueue: this.queue.length,
        });

        request.onCapacity(reservation);
      }
    } finally {
      this.processing = false;
    }
  }

  private async acquireWithRetry(
    estimatedTokens: number,
    maxAttempts = 60
  ): Promise<CapacityReservation> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const acquired = await tryAcquireCapacity(estimatedTokens);

      if (acquired?.result) {
        return acquired.result;
      }

      // Wait until the oldest reservation expires (with a minimum of 1 second)
      const waitTime = Math.max(
        1000,
        Math.min(acquired?.resetMs ?? WINDOW_SIZE_MS, 5000)
      );
      logger.debug("Rate limit reached, waiting for capacity", {
        waitTimeMs: waitTime,
        remaining: lastKnownRemaining,
        tokensRemaining: lastKnownTokensRemaining,
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
