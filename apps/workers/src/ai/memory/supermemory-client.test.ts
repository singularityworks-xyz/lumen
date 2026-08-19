import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const mockLogger = mock(() => {
  // intentionally empty mock
});

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    debug: mockLogger,
    error: mockLogger,
    info: mockLogger,
    warn: mockLogger,
  }),
}));

const mockSupermemoryConstructor = mock(() => ({}));

mock.module("supermemory", () => ({
  default: mockSupermemoryConstructor,
}));

type ClientModule = typeof import("./supermemory-client");

const clientModule = (await import(
  `./supermemory-client?${Date.now()}`
)) as ClientModule;

const {
  __resetSupermemoryClient,
  getSupermemoryBaseUrl,
  getSupermemoryClient,
  isMemoryEnabled,
} = clientModule;

const originalApiUrl = process.env.SUPERMEMORY_API_URL;
const originalApiKey = process.env.SUPERMEMORY_API_KEY;

beforeEach(() => {
  __resetSupermemoryClient();
  mockSupermemoryConstructor.mockClear();
  process.env.SUPERMEMORY_API_URL = "http://localhost:6767";
  process.env.SUPERMEMORY_API_KEY = "sm_test-key";
});

afterEach(() => {
  __resetSupermemoryClient();
  if (originalApiUrl === undefined) {
    delete process.env.SUPERMEMORY_API_URL;
  } else {
    process.env.SUPERMEMORY_API_URL = originalApiUrl;
  }
  if (originalApiKey === undefined) {
    delete process.env.SUPERMEMORY_API_KEY;
  } else {
    process.env.SUPERMEMORY_API_KEY = originalApiKey;
  }
  mock.restore();
});

describe("isMemoryEnabled", () => {
  it("returns true when an API key is set", () => {
    expect(isMemoryEnabled()).toBe(true);
  });

  it("returns false when no API key is set", () => {
    delete process.env.SUPERMEMORY_API_KEY;
    expect(isMemoryEnabled()).toBe(false);
  });

  it("returns false for an empty API key", () => {
    process.env.SUPERMEMORY_API_KEY = "";
    expect(isMemoryEnabled()).toBe(false);
  });
});

describe("getSupermemoryBaseUrl", () => {
  it("uses the configured URL when set", () => {
    process.env.SUPERMEMORY_API_URL = "http://memory.lumen.dev:6767";
    expect(getSupermemoryBaseUrl()).toBe("http://memory.lumen.dev:6767");
  });

  it("defaults to the local server when unset", () => {
    delete process.env.SUPERMEMORY_API_URL;
    expect(getSupermemoryBaseUrl()).toBe("http://localhost:6767");
  });
});

describe("getSupermemoryClient", () => {
  it("returns null when memory is disabled", () => {
    delete process.env.SUPERMEMORY_API_KEY;
    expect(getSupermemoryClient()).toBeNull();
  });

  it("creates a client pointing at the self-hosted server", () => {
    const client = getSupermemoryClient();

    expect(client).not.toBeNull();
    expect(mockSupermemoryConstructor).toHaveBeenCalledWith({
      apiKey: "sm_test-key",
      baseURL: "http://localhost:6767",
    });
  });

  it("caches and reuses the same client instance", () => {
    const first = getSupermemoryClient();
    const second = getSupermemoryClient();

    expect(second).toBe(first);
    expect(mockSupermemoryConstructor).toHaveBeenCalledTimes(1);
  });
});
