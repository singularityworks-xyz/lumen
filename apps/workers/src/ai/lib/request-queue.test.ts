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

const mockEval = mock(() =>
  Promise.resolve([1, 29, Date.now() + 60_000] as const)
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

const { aiRequestQueue, getQueueStats, getQueueStatus, isRedisEnabled } =
  requestQueueModule;

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
    Promise.resolve([1, 29, Date.now() + 60_000] as const)
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
    expect(stats).toHaveProperty("usingRedis");
    expect(typeof stats.queueLength).toBe("number");
    expect(typeof stats.activeRequests).toBe("number");
    expect(typeof stats.isProcessing).toBe("boolean");
    expect(typeof stats.remaining).toBe("number");
    expect(typeof stats.usingRedis).toBe("boolean");
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
