import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

interface EmitData {
  attributes: Record<string, unknown>;
  body: string;
}

const emitMock = mock<(data: EmitData) => void>(() => {
  // no-op
});

mock.module("@opentelemetry/api-logs", () => ({
  logs: {
    getLogger: () => ({
      emit: emitMock,
    }),
  },
  SeverityNumber: {
    TRACE: 1,
    DEBUG: 5,
    INFO: 9,
    WARN: 13,
    ERROR: 17,
    FATAL: 21,
  },
}));

mock.module("@opentelemetry/api", () => ({
  trace: {
    getActiveSpan: () => ({
      spanContext: () => ({ traceId: "trace-123", spanId: "span-456" }),
    }),
  },
  context: {
    active: () => ({}),
  },
}));

import { createChildLogger, createLogger } from "../../src/logger";

describe("Logger", () => {
  let consoleLogMock: ReturnType<typeof mock<Console["log"]>>;
  const originalConsoleLog = globalThis.console.log;
  let originalWindow: typeof window | undefined;

  beforeEach(() => {
    emitMock.mockClear();
    consoleLogMock = mock<Console["log"]>(() => undefined);
    globalThis.console.log = consoleLogMock;

    // Force server mode for tests
    originalWindow = globalThis.window;
    // @ts-expect-error
    globalThis.window = undefined;
  });

  afterEach(() => {
    globalThis.console.log = originalConsoleLog;
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    }
  });

  it("respects level filtering", () => {
    const logger = createLogger({ level: "warn" });

    logger.info("This should not log");
    expect(consoleLogMock).not.toHaveBeenCalled();

    logger.warn("This should log");
    expect(consoleLogMock).toHaveBeenCalled();
  });

  it("merges object-first and string-first signatures correctly", () => {
    const logger = createLogger({ level: "info", pretty: false });

    // string first
    logger.info("Message first", { customField: 123 });
    expect(consoleLogMock).toHaveBeenCalled();
    const call1 = consoleLogMock.mock.calls[0]![0]! as string;
    expect(call1).toContain("Message first");
    expect(call1).toContain('"customField":123');

    // object first
    logger.info({ customField: 456 }, "Object first");
    const call2 = consoleLogMock.mock.calls[1]![0]! as string;
    expect(call2).toContain("Object first");
    expect(call2).toContain('"customField":456');

    // object first with msg inside
    logger.info({ msg: "Inner message", customField: 789 });
    const call3 = consoleLogMock.mock.calls[2]![0]! as string;
    expect(call3).toContain("Inner message");
    expect(call3).toContain('"customField":789');
  });

  it("preserves base bindings in child loggers", () => {
    const parent = createLogger({
      level: "info",
      pretty: false,
      base: { parentId: "123" },
    });
    const child = createChildLogger(parent, { childId: "456" });

    child.info("Child log");
    const call = consoleLogMock.mock.calls[0]![0]! as string;

    expect(call).toContain('"parentId":"123"');
    expect(call).toContain('"childId":"456"');
  });

  it("emits OpenTelemetry log records on server", () => {
    const logger = createLogger({ level: "info", name: "test-logger" });

    logger.info("Otel test", { someAttr: "value" });

    expect(emitMock).toHaveBeenCalled();
    const callData = emitMock.mock.calls[0]![0];

    expect(callData).toBeDefined();
    expect(callData.body).toBe("Otel test");
    expect(callData.attributes["logger.name"]).toBe("test-logger");
    expect(callData.attributes.someAttr).toBe("value");
    expect(callData.attributes.trace_id).toBe("trace-123");
    expect(callData.attributes.span_id).toBe("span-456");
  });
});
