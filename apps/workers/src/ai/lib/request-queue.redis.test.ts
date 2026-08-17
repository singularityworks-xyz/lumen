import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const originalNodeEnv = process.env.NODE_ENV;
const originalRedisUrl = process.env.REDIS_URL;

process.env.NODE_ENV = "development";
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

type RequestQueueModule = typeof import("./request-queue");

const requestQueueModule = (await import(
  `./request-queue?redis=${Date.now()}`
)) as RequestQueueModule;

const { aiRequestQueue, getQueueStats, isRedisEnabled } = requestQueueModule;

beforeEach(() => {
  mockLoggerInfo.mockClear();
  mockLoggerWarn.mockClear();
  mockLoggerError.mockClear();
  mockLoggerDebug.mockClear();
  mockEval.mockClear();
  mockOn.mockClear();
});

describe("RateLimitedQueue - redis backend", () => {
  it("uses redis when Redis is configured", async () => {
    const execute = mock(() => Promise.resolve("ok"));

    const { result, wasQueued } = await aiRequestQueue.enqueue(execute);

    expect(result).toBe("ok");
    expect(wasQueued).toBe(false);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockEval).toHaveBeenCalledTimes(1);
    expect(isRedisEnabled()).toBe(true);
    expect(getQueueStats().usingRedis).toBe(true);
  });

  it("does not log the in-memory fallback warning when redis is available", async () => {
    await aiRequestQueue.enqueue(() => Promise.resolve("ok"));

    expect(mockLoggerWarn).not.toHaveBeenCalledWith(
      expect.stringContaining("Redis not configured"),
      expect.anything()
    );
  });
});

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.REDIS_URL = originalRedisUrl;
  mock.restore();
});
