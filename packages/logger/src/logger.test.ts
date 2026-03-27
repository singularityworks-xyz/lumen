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

import { createChildLogger, createLogger } from "./logger";

describe("Logger", () => {
  let consoleLogMock: ReturnType<typeof mock<Console["log"]>>;
  let consoleGroupCollapsedMock: ReturnType<
    typeof mock<Console["groupCollapsed"]>
  >;
  let consoleGroupEndMock: ReturnType<typeof mock<Console["groupEnd"]>>;
  const originalConsoleLog = globalThis.console.log;
  const originalConsoleGroupCollapsed = globalThis.console.groupCollapsed;
  const originalConsoleGroupEnd = globalThis.console.groupEnd;
  let originalWindow: typeof window | undefined;

  beforeEach(() => {
    emitMock.mockClear();
    consoleLogMock = mock<Console["log"]>(() => undefined);
    consoleGroupCollapsedMock = mock(() => undefined);
    consoleGroupEndMock = mock(() => undefined);
    globalThis.console.log = consoleLogMock;
    globalThis.console.groupCollapsed = consoleGroupCollapsedMock;
    globalThis.console.groupEnd = consoleGroupEndMock;

    // Force server mode for tests
    originalWindow = globalThis.window;
    // @ts-expect-error
    globalThis.window = undefined;
  });

  afterEach(() => {
    globalThis.console.log = originalConsoleLog;
    globalThis.console.groupCollapsed = originalConsoleGroupCollapsed;
    globalThis.console.groupEnd = originalConsoleGroupEnd;
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

  it("filters trace level messages", () => {
    const logger = createLogger({ level: "debug" });

    logger.trace("Should not log");
    expect(consoleLogMock).not.toHaveBeenCalled();

    logger.debug("Should log");
    expect(consoleLogMock).toHaveBeenCalled();
  });

  it("filters debug level messages when level is info", () => {
    const logger = createLogger({ level: "info" });

    logger.debug("Should not log");
    expect(consoleLogMock).not.toHaveBeenCalled();

    logger.info("Should log");
    expect(consoleLogMock).toHaveBeenCalled();
  });

  it("logs error level messages", () => {
    const logger = createLogger({ level: "error" });

    logger.info("Should not log");
    expect(consoleLogMock).not.toHaveBeenCalled();

    logger.error("Should log");
    expect(consoleLogMock).toHaveBeenCalled();
  });

  it("logs fatal level messages", () => {
    const logger = createLogger({ level: "fatal" });

    logger.error("Should not log");
    expect(consoleLogMock).not.toHaveBeenCalled();

    logger.fatal("Should log");
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

  it("merges two objects when both args are objects", () => {
    const logger = createLogger({ level: "info", pretty: false });

    logger.info({ field1: "a" }, { field2: "b" });
    const call = consoleLogMock.mock.calls[0]![0]! as string;
    expect(call).toContain('"field1":"a"');
    expect(call).toContain('"field2":"b"');
  });

  it("uses msg from object when no second arg", () => {
    const logger = createLogger({ level: "info", pretty: false });

    logger.info({ msg: "auto message" });
    const call = consoleLogMock.mock.calls[0]![0]! as string;
    expect(call).toContain("auto message");
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
    expect(callData.attributes.trace_id ?? null).toBeNull();
    expect(callData.attributes.span_id ?? null).toBeNull();
  });

  it("uses pretty formatting when pretty is true", () => {
    const logger = createLogger({ level: "info", pretty: true });

    logger.info("Pretty message");
    expect(consoleLogMock).toHaveBeenCalled();
    const call = consoleLogMock.mock.calls[0]![0]! as string;
    expect(call).toContain("Pretty message");
  });

  it("formats non-string/number/boolean attributes as JSON in otel", () => {
    const logger = createLogger({ level: "info", name: "json-test" });

    logger.info("test", { nested: { key: "value" } });
    expect(emitMock).toHaveBeenCalled();
    const callData = emitMock.mock.calls[0]![0];
    expect(callData.attributes.nested).toBe('{"key":"value"}');
  });

  it("skips null and undefined attributes in otel", () => {
    const logger = createLogger({ level: "info", name: "null-test" });

    logger.info("test", {
      nullField: null,
      undefinedField: undefined,
      okField: "yes",
    });
    expect(emitMock).toHaveBeenCalled();
    const callData = emitMock.mock.calls[0]![0];
    expect(callData.attributes.nullField).toBeUndefined();
    expect(callData.attributes.undefinedField).toBeUndefined();
    expect(callData.attributes.okField).toBe("yes");
  });

  it("includes base attributes as base.* prefix in otel", () => {
    const logger = createLogger({
      level: "info",
      name: "base-test",
      base: { svc: "api" },
    });

    logger.info("test");
    expect(emitMock).toHaveBeenCalled();
    const callData = emitMock.mock.calls[0]![0];
    expect(callData.attributes["base.svc"]).toBe("api");
  });

  it("uses default level based on NODE_ENV", () => {
    // In test env, NODE_ENV is "test" (not "production"), so default level is debug
    const logger = createLogger({});
    logger.debug("debug in non-prod");
    expect(consoleLogMock).toHaveBeenCalled();
  });

  describe("browser mode", () => {
    beforeEach(() => {
      // @ts-expect-error
      globalThis.window = {};
    });

    afterEach(() => {
      // @ts-expect-error
      globalThis.window = undefined;
    });

    it("uses browser formatting for simple messages", () => {
      const logger = createLogger({ level: "info" });

      logger.info("Browser message");
      // Simple message without extra data uses console.log directly
      expect(consoleLogMock).toHaveBeenCalled();
    });

    it("uses groupCollapsed for messages with extra data", () => {
      const logger = createLogger({ level: "info" });

      logger.info("Browser with data", { extra: "field" });
      expect(consoleGroupCollapsedMock).toHaveBeenCalled();
      expect(consoleGroupEndMock).toHaveBeenCalled();
    });

    it("does not emit otel logs in browser", () => {
      emitMock.mockClear();
      const logger = createLogger({ level: "info", name: "browser-test" });

      logger.info("Browser otel");
      expect(emitMock).not.toHaveBeenCalled();
    });
  });
});
