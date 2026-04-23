import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
process.env.NODE_ENV = "development";
process.env.REDIS_URL = "redis://127.0.0.1:5354";

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

mock.module("@upstash/redis", () => ({
  Redis: class {},
}));

mock.module("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    function RatelimitMock() {
      // constructor mock for tests
    },
    {
      slidingWindow: mock(() => "sliding-window"),
    }
  ),
}));

mock.module("redis", () => ({
  createClient: mockCreateClient,
}));

type RequestQueueModule = typeof import("./request-queue");

const requestQueueModule = (await import(
  `./request-queue?local-redis=${Date.now()}`
)) as RequestQueueModule;

const { aiRequestQueue, getQueueStats, isUpstashEnabled } = requestQueueModule;

beforeEach(() => {
  mockLoggerInfo.mockClear();
  mockLoggerWarn.mockClear();
  mockLoggerError.mockClear();
  mockLoggerDebug.mockClear();
  mockEval.mockClear();
  mockOn.mockClear();
});

describe("RateLimitedQueue - local redis backend", () => {
  it("uses lumencache in development when Upstash is not configured", async () => {
    const execute = mock(() => Promise.resolve("ok"));

    const { result, wasQueued } = await aiRequestQueue.enqueue(execute);

    expect(result).toBe("ok");
    expect(wasQueued).toBe(false);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockEval).toHaveBeenCalledTimes(1);
    expect(isUpstashEnabled()).toBe(false);
    expect(getQueueStats().usingUpstash).toBe(false);
  });

  it("does not log the in-memory fallback warning when lumencache is available", async () => {
    await aiRequestQueue.enqueue(() => Promise.resolve("ok"));

    expect(mockLoggerWarn).not.toHaveBeenCalledWith(
      expect.stringContaining("Upstash Redis not configured"),
      expect.anything()
    );
  });
});

afterAll(() => {
  delete process.env.REDIS_URL;
  mock.restore();
});
