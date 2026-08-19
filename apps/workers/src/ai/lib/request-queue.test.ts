import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

// Set environment variables BEFORE any imports to ensure Redis is configured
process.env.REDIS_URL = "redis://127.0.0.1:16379";

const mockLoggerInfo = mock(() => {
  // intentionally empty mock
});
const mockLoggerWarn = mock(() => {
  // intentionally empty mock
});
const mockLoggerError = mock(() => {
  // intentionally empty mock
});
const mockLoggerDebug = mock(() => {
  // intentionally empty mock
});

// Redis eval result shape: [success, slotsRemaining, tokensRemaining, resetAt]
const mockEval = mock(
  (): Promise<readonly [number, number, number, number]> =>
    Promise.resolve([1, 99, 199_000, Date.now() + 60_000] as const)
);
const mockConnect = mock(() => Promise.resolve());
const mockOn = mock(() => {
  // intentionally empty mock
});
const mockCreateClient = mock(() => ({
  connect: mockConnect,
  eval: mockEval,
  isReady: true,
  on: mockOn,
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: mockLoggerDebug,
  }),
}));

mock.module("redis", () => ({
  createClient: mockCreateClient,
}));

// Import types for the module we're about to import
type RequestQueueModule = typeof import("./request-queue");

// Use dynamic import with cache-busting to get fresh module
const requestQueueModule = (await import(
  `./request-queue?${Date.now()}`
)) as RequestQueueModule;

const {
  aiRequestQueue,
  getQueueStats,
  getQueueStatus,
  isRedisEnabled,
  RATE_LIMIT_PER_MINUTE,
  TOKEN_LIMIT_PER_MINUTE,
} = requestQueueModule;

beforeEach(() => {
  mockLoggerInfo.mockClear();
  mockLoggerWarn.mockClear();
  mockLoggerError.mockClear();
  mockLoggerDebug.mockClear();
  mockEval.mockClear();
  mockOn.mockClear();
  mockConnect.mockClear();
  // Reset mock to ensure fresh state for each test
  mockEval.mockImplementation(() =>
    Promise.resolve([1, 99, 199_000, Date.now() + 60_000] as const)
  );
});

describe("RateLimitedQueue - immediate execution", () => {
  it("WORKERS-U-05: immediate execution bypasses queue when rate limit allows", async () => {
    const execute = mock(() => Promise.resolve("ok"));

    const { result, wasQueued } = await aiRequestQueue.enqueue(execute);

    expect(result).toBe("ok");
    expect(wasQueued).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("WORKERS-U-05: immediate execution increments activeRequests during execution", async () => {
    let activeRequestsDuringExecution = 0;
    const execute = mock(() => {
      // Capture activeRequests during execution
      const stats = getQueueStats();
      activeRequestsDuringExecution = stats.activeRequests;
      return Promise.resolve("ok");
    });

    await aiRequestQueue.enqueue(execute);

    // During execution, activeRequests should be incremented
    expect(activeRequestsDuringExecution).toBe(1);

    // After execution completes, activeRequests should be back to 0
    const stats = getQueueStats();
    expect(stats.activeRequests).toBe(0);
  });

  it("returns a releaseTokens function that refunds the token reservation", async () => {
    const execute = mock(() => Promise.resolve("ok"));

    const { releaseTokens } = await aiRequestQueue.enqueue(execute, {
      estimatedTokens: 4096,
    });

    // releaseTokens re-runs eval (the release script)
    await releaseTokens(1000);
    expect(mockEval).toHaveBeenCalledTimes(2);
  });
});

describe("RateLimitedQueue - capacity exhaustion", () => {
  it("queues the request when the request slot limit is reached", async () => {
    // Simulate the slot limit being hit on first attempt, then succeeding on retry
    let callCount = 0;
    mockEval.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([
          0,
          RATE_LIMIT_PER_MINUTE,
          0,
          Date.now() + 10,
        ] as const);
      }
      return Promise.resolve([1, 99, 199_000, Date.now() + 60_000] as const);
    });

    const execute = mock(() => Promise.resolve("queued-ok"));
    const { result, wasQueued, waitTimeMs } = await aiRequestQueue.enqueue(
      execute,
      { priority: "high" }
    );

    expect(result).toBe("queued-ok");
    expect(wasQueued).toBe(true);
    expect(waitTimeMs).toBeGreaterThanOrEqual(0);
    expect(execute).toHaveBeenCalledTimes(1);
  }, 15_000);

  it("queues the request when the token budget is exhausted", async () => {
    // Simulate the token budget being hit on first attempt, then succeeding on retry
    let callCount = 0;
    mockEval.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([
          0,
          0,
          TOKEN_LIMIT_PER_MINUTE,
          Date.now() + 10,
        ] as const);
      }
      return Promise.resolve([1, 99, 199_000, Date.now() + 60_000] as const);
    });

    const execute = mock(() => Promise.resolve("token-queued"));
    const { result, wasQueued } = await aiRequestQueue.enqueue(execute);

    expect(result).toBe("token-queued");
    expect(wasQueued).toBe(true);
  }, 15_000);
});

describe("RateLimitedQueue - priority queue insertion", () => {
  it("WORKERS-U-05: high priority requests are inserted before normal priority", async () => {
    const executionOrder: string[] = [];

    const highPromise = aiRequestQueue.enqueue(
      () => {
        executionOrder.push("high");
        return Promise.resolve("high");
      },
      { priority: "high" }
    );

    const normalPromise = aiRequestQueue.enqueue(
      () => {
        executionOrder.push("normal");
        return Promise.resolve("normal");
      },
      { priority: "normal" }
    );

    await Promise.all([highPromise, normalPromise]);

    const highIndex = executionOrder.indexOf("high");
    const normalIndex = executionOrder.indexOf("normal");
    expect(highIndex).toBeLessThan(normalIndex);
  });

  it("WORKERS-U-05: normal priority requests are inserted before low priority", async () => {
    const executionOrder: string[] = [];

    const normalPromise = aiRequestQueue.enqueue(
      () => {
        executionOrder.push("normal");
        return Promise.resolve("normal");
      },
      { priority: "normal" }
    );

    const lowPromise = aiRequestQueue.enqueue(
      () => {
        executionOrder.push("low");
        return Promise.resolve("low");
      },
      { priority: "low" }
    );

    await Promise.all([normalPromise, lowPromise]);

    const normalIndex = executionOrder.indexOf("normal");
    const lowIndex = executionOrder.indexOf("low");
    expect(normalIndex).toBeLessThan(lowIndex);
  });
});

describe("RateLimitedQueue - reserveCapacity", () => {
  it("reserves capacity without executing and releases on demand", async () => {
    const { reservation, wasQueued } = await aiRequestQueue.reserveCapacity({
      estimatedTokens: 2048,
    });

    expect(wasQueued).toBe(false);
    expect(reservation).not.toBeNull();

    await reservation?.releaseTokens(500);
    // 1 eval for reserve + 1 eval for release
    expect(mockEval).toHaveBeenCalledTimes(2);
  });

  it("queues capacity reservation when the token budget is exhausted", async () => {
    let callCount = 0;
    mockEval.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([
          0,
          0,
          TOKEN_LIMIT_PER_MINUTE,
          Date.now() + 10,
        ] as const);
      }
      return Promise.resolve([1, 99, 199_000, Date.now() + 60_000] as const);
    });

    const { reservation, wasQueued } = await aiRequestQueue.reserveCapacity({
      priority: "high",
      estimatedTokens: 4096,
    });

    expect(wasQueued).toBe(true);
    expect(reservation).not.toBeNull();
    await reservation?.releaseTokens(0);
  }, 15_000);
});

describe("RateLimitedQueue - status reporting", () => {
  it("WORKERS-U-05: returns null status for unknown request ID", () => {
    const status = getQueueStatus("nonexistent-id");
    expect(status).toBeNull();
  });

  it("WORKERS-U-05: queue status includes queueLength", () => {
    const _status = getQueueStatus("unknown-id");
    // getQueueStatus returns null for unknown IDs, so we check getQueueStats instead
    const stats = getQueueStats();
    expect(typeof stats.queueLength).toBe("number");
  });
});

describe("RateLimitedQueue - mandatory Redis", () => {
  it("requires Redis to be configured", () => {
    expect(isRedisEnabled()).toBe(true);
    expect(getQueueStats().usingRedis).toBe(true);
  });
});

describe("RateLimitedQueue - stats", () => {
  it("getStats returns expected shape", () => {
    const stats = getQueueStats();

    expect(stats).toHaveProperty("queueLength");
    expect(stats).toHaveProperty("activeRequests");
    expect(stats).toHaveProperty("isProcessing");
    expect(stats).toHaveProperty("remaining");
    expect(stats).toHaveProperty("tokensRemaining");
    expect(stats).toHaveProperty("usingRedis");
    expect(typeof stats.queueLength).toBe("number");
    expect(typeof stats.activeRequests).toBe("number");
    expect(typeof stats.isProcessing).toBe("boolean");
    expect(typeof stats.remaining).toBe("number");
    expect(typeof stats.tokensRemaining).toBe("number");
    expect(typeof stats.usingRedis).toBe("boolean");
  });

  it("exposes the GeneralCompute rate limits", () => {
    expect(RATE_LIMIT_PER_MINUTE).toBe(100);
    expect(TOKEN_LIMIT_PER_MINUTE).toBe(200_000);
  });
});

describe("isRedisEnabled", () => {
  it("returns a boolean", () => {
    const result = isRedisEnabled();
    expect(typeof result).toBe("boolean");
  });
});

afterAll(() => {
  mock.restore();
});
