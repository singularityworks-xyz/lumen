import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

interface EmitData {
  attributes: Record<string, unknown>;
  body: string;
  severityNumber?: number;
  timestamp?: Date;
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

import {
  createChildLogger,
  createLogger,
  type Logger,
  type LoggerOptions,
  type LogLevel,
  logger,
} from "./logger";

const ISO_TIMESTAMP_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

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

  describe("type exports", () => {
    it("LogLevel type accepts all valid levels", () => {
      const levels: LogLevel[] = [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
      ];
      for (const level of levels) {
        const l = createLogger({ level });
        expect(l).toBeDefined();
      }
    });
  });

  describe("createLogger", () => {
    it("returns a logger with all required methods", () => {
      const l = createLogger();
      expect(typeof l.trace).toBe("function");
      expect(typeof l.debug).toBe("function");
      expect(typeof l.info).toBe("function");
      expect(typeof l.warn).toBe("function");
      expect(typeof l.error).toBe("function");
      expect(typeof l.fatal).toBe("function");
      expect(typeof l.child).toBe("function");
    });

    it("uses 'lumen' as default name", () => {
      createLogger({ level: "info" }).info("test");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("lumen");
    });

    it("uses custom name when provided", () => {
      createLogger({ level: "info", name: "custom-logger-name" }).info("test");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("custom-logger-name");
    });

    it("uses custom base fields", () => {
      createLogger({ level: "info", base: { myKey: "myVal" } }).info("x");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"myKey":"myVal"');
    });

    it("applies default pretty=false in production", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("plain");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).not.toContain("\x1b[");
    });
  });

  describe("default logger export", () => {
    it("is an instance of Logger", () => {
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.child).toBe("function");
    });
  });

  describe("createChildLogger", () => {
    it("creates child from parent", () => {
      const parent = createLogger({
        level: "info",
        pretty: false,
        base: { a: 1 },
      });
      const child = createChildLogger(parent, { b: 2 });
      child.info("from child");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"a":1');
      expect(call).toContain('"b":2');
    });
  });

  describe("level filtering", () => {
    const allLevels: LogLevel[] = [
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ];

    for (const threshold of allLevels) {
      describe(`level=${threshold}`, () => {
        const thresholdIdx = allLevels.indexOf(threshold);
        it("passes only levels >= threshold", () => {
          const l = createLogger({ level: threshold });
          for (const msgLevel of allLevels) {
            consoleLogMock.mockClear();
            (l as unknown as Record<string, (m: string) => void>)[msgLevel]?.(
              "msg"
            );
            const msgIdx = allLevels.indexOf(msgLevel);
            if (msgIdx >= thresholdIdx) {
              expect(consoleLogMock).toHaveBeenCalled();
            } else {
              expect(consoleLogMock).not.toHaveBeenCalled();
            }
          }
        });
      });
    }

    it("filters trace when level is debug", () => {
      const l = createLogger({ level: "debug" });
      l.trace("hidden");
      expect(consoleLogMock).not.toHaveBeenCalled();
      l.debug("visible");
      expect(consoleLogMock).toHaveBeenCalled();
    });

    it("filters debug when level is info", () => {
      const l = createLogger({ level: "info" });
      l.debug("hidden");
      expect(consoleLogMock).not.toHaveBeenCalled();
      l.info("visible");
      expect(consoleLogMock).toHaveBeenCalled();
    });

    it("filters info when level is warn", () => {
      const l = createLogger({ level: "warn" });
      l.info("hidden");
      expect(consoleLogMock).not.toHaveBeenCalled();
      l.warn("visible");
      expect(consoleLogMock).toHaveBeenCalled();
    });

    it("filters warn when level is error", () => {
      const l = createLogger({ level: "error" });
      l.warn("hidden");
      expect(consoleLogMock).not.toHaveBeenCalled();
      l.error("visible");
      expect(consoleLogMock).toHaveBeenCalled();
    });

    it("filters error when level is fatal", () => {
      const l = createLogger({ level: "fatal" });
      l.error("hidden");
      expect(consoleLogMock).not.toHaveBeenCalled();
      l.fatal("visible");
      expect(consoleLogMock).toHaveBeenCalled();
    });

    it("blocks all messages below fatal when level is fatal", () => {
      const l = createLogger({ level: "fatal" });
      l.trace("no");
      l.debug("no");
      l.info("no");
      l.warn("no");
      l.error("no");
      expect(consoleLogMock).not.toHaveBeenCalled();
      l.fatal("yes");
      expect(consoleLogMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("log signature: string msg", () => {
    it("logs a plain string message", () => {
      const l = createLogger({ level: "info", pretty: false });
      const msg = "A very plain message";
      l.info(msg);
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain(msg);
    });

    it("logs string msg with extra object", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("hello", { key: "value" });
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("hello");
      expect(call).toContain('"key":"value"');
    });

    it("ignores second string arg", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("msg", "ignored" as any);
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("msg");
      expect(call).not.toContain("ignored");
    });
  });

  describe("log signature: object msg", () => {
    it("logs object with msg property", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info({ msg: "from obj", extra: 1 });
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("from obj");
      expect(call).toContain('"extra":1');
    });

    it("logs object with second string as message", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info({ extra: 1 }, "override msg");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("override msg");
      expect(call).toContain('"extra":1');
    });

    it("merges two objects when both args are objects", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info({ a: 1 }, { b: 2 });
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"a":1');
      expect(call).toContain('"b":2');
    });

    it("handles empty msg string when object has no msg property", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info({ key: "val" });
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"key":"val"');
    });
  });

  describe("server formatting", () => {
    it("uses pretty ANSI formatting when pretty=true", () => {
      const l = createLogger({ level: "info", pretty: true });
      l.info("pretty msg");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("\x1b["); // ANSI escape
      expect(call).toContain("INFO");
      expect(call).toContain("pretty msg");
    });

    it("uses plain formatting when pretty=false", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("plain msg");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).not.toContain("\x1b[");
      expect(call).toContain("INFO");
      expect(call).toContain("plain msg");
    });

    it("includes ISO timestamp in output", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("ts test");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      // ISO date pattern
      expect(call).toMatch(ISO_TIMESTAMP_REGEX);
    });

    it("includes extra fields as JSON in plain mode", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("msg", { foo: "bar", count: 42 });
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"foo":"bar"');
      expect(call).toContain('"count":42');
    });

    it("includes base env field in output", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("env test");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"env"');
    });

    it("handles all pretty level colors", () => {
      for (const level of [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
      ] as LogLevel[]) {
        consoleLogMock.mockClear();
        const l = createLogger({ level, pretty: true });
        (l as unknown as Record<string, (m: string) => void>)[level]?.(
          "color test"
        );
        expect(consoleLogMock).toHaveBeenCalled();
        const call = consoleLogMock.mock.calls[0]?.[0]! as string;
        expect(call).toContain("\x1b[");
        expect(call).toContain(level.toUpperCase());
      }
    });
  });

  describe("OpenTelemetry emission", () => {
    it("emits otel log with correct severity for info and above", () => {
      const levelToSeverity: Partial<Record<LogLevel, number>> = {
        info: 9,
        warn: 13,
        error: 17,
        fatal: 21,
      };

      for (const [level] of Object.entries(levelToSeverity)) {
        emitMock.mockClear();
        const l = createLogger({ level: level as LogLevel, name: "sev-test" });
        (l as unknown as Record<string, (m: string) => void>)[level]?.("test");
        expect(emitMock).toHaveBeenCalled();
        const data = emitMock.mock.calls[0]?.[0];
        expect(data).toBeDefined();
        expect(data!.attributes["logger.name"]).toBe("sev-test");
        expect(data!.severityNumber).toBe(
          levelToSeverity[level as LogLevel] as number
        );
      }
    });

    it("does NOT emit trace/debug to OTel", () => {
      for (const level of ["trace", "debug"] as const) {
        emitMock.mockClear();
        const l = createLogger({ level, name: "sev-test" });
        (l as unknown as Record<string, (m: string) => void>)[level]?.("test");
        expect(emitMock).not.toHaveBeenCalled();
      }
    });

    it("emits with logger.name attribute", () => {
      const l = createLogger({ level: "info", name: "custom-name" });
      l.info("test");
      const data = emitMock.mock.calls[0]?.[0];
      expect(data).toBeDefined();
      expect(data!.attributes["logger.name"]).toBe("custom-name");
    });

    it("includes string/number/boolean attributes", () => {
      const l = createLogger({ level: "info" });
      l.info("test", {
        strKey: "hello",
        numKey: 42,
        boolKey: true,
      });
      const data = emitMock.mock.calls[0]?.[0];
      expect(data).toBeDefined();
      expect(data!.attributes.strKey).toBe("hello");
      expect(data!.attributes.numKey).toBe(42);
      expect(data!.attributes.boolKey).toBe(true);
    });

    it("serializes non-primitive attributes as JSON", () => {
      const l = createLogger({ level: "info" });
      l.info("test", { nested: { deep: true }, arr: [1, 2, 3] });
      const data = emitMock.mock.calls[0]?.[0];
      expect(data).toBeDefined();
      expect(data!.attributes.nested).toBe('{"deep":true}');
      expect(data!.attributes.arr).toBe("[1,2,3]");
    });

    it("skips null and undefined attributes", () => {
      const l = createLogger({ level: "info" });
      l.info("test", {
        nullField: null,
        undefinedField: undefined,
        okField: "yes",
      });
      const data = emitMock.mock.calls[0]?.[0];
      expect(data).toBeDefined();
      expect(data!.attributes.nullField).toBeUndefined();
      expect(data!.attributes.undefinedField).toBeUndefined();
      expect(data!.attributes.okField).toBe("yes");
    });

    it("prefixes base attributes with base.*", () => {
      const l = createLogger({
        level: "info",
        base: { svc: "api", ver: 3 },
      });
      l.info("test");
      const data = emitMock.mock.calls[0]?.[0];
      expect(data).toBeDefined();
      expect(data!.attributes["base.svc"]).toBe("api");
      expect(data!.attributes["base.ver"]).toBe(3);
    });

    it("skips non-primitive base attributes in otel", () => {
      const l = createLogger({
        level: "info",
        base: { obj: { nested: true } },
      });
      l.info("test");
      const data = emitMock.mock.calls[0]?.[0];
      expect(data).toBeDefined();
      expect(data!.attributes["base.obj"]).toBeUndefined();
    });

    it("emits body as the message string", () => {
      const l = createLogger({ level: "info" });
      const msg = "A very random string to log";
      l.info(msg);
      const data = emitMock.mock.calls[0]?.[0];
      expect(data).toBeDefined();
      expect(data!.body).toBe(msg);
    });

    it("includes timestamp as Date", () => {
      const l = createLogger({ level: "info" });
      l.info("ts");
      const data = emitMock.mock.calls[0]?.[0];
      expect(data).toBeDefined();
      expect(data!.timestamp).toBeInstanceOf(Date);
    });
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

    it("uses groupCollapsed in browser mode (always has env in base)", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("simple browser msg");
      // In browser mode, env is always in base so hasExtra is always true
      expect(consoleGroupCollapsedMock).toHaveBeenCalled();
      expect(consoleGroupEndMock).toHaveBeenCalled();
    });

    it("uses groupCollapsed for messages with extra data", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("grouped msg", { extra: "data" });
      expect(consoleGroupCollapsedMock).toHaveBeenCalled();
      expect(consoleGroupEndMock).toHaveBeenCalled();
    });

    it("does not emit otel logs in browser", () => {
      emitMock.mockClear();
      const l = createLogger({
        level: "info",
        name: "browser-test",
        pretty: false,
      });
      l.info("browser otel");
      expect(emitMock).not.toHaveBeenCalled();
    });

    it("includes level label in browser console styling", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("styled msg");
      const call = consoleGroupCollapsedMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("INFO");
    });

    it("includes logger name in browser output", () => {
      const l = createLogger({
        level: "info",
        name: "mylogger",
        pretty: false,
      });
      l.info("named");
      const call = consoleGroupCollapsedMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("mylogger");
    });

    it("logs all levels correctly in browser mode", () => {
      for (const level of [
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
      ] as LogLevel[]) {
        consoleLogMock.mockClear();
        consoleGroupCollapsedMock.mockClear();
        const l = createLogger({ level, pretty: false });
        (l as unknown as Record<string, (m: string) => void>)[level]?.("msg");
        // In browser mode, groupCollapsed is always used (env in base makes hasExtra true)
        expect(consoleGroupCollapsedMock).toHaveBeenCalled();
      }
    });

    it("filters below-threshold levels in browser mode", () => {
      const l = createLogger({ level: "error", pretty: false });
      l.info("hidden");
      l.warn("hidden");
      expect(consoleLogMock).not.toHaveBeenCalled();
      expect(consoleGroupCollapsedMock).not.toHaveBeenCalled();
    });

    it("handles trace level in browser mode", () => {
      const l = createLogger({ level: "trace", name: "test", pretty: false });
      l.trace("trace in browser", { data: 1 });
      expect(consoleGroupCollapsedMock).toHaveBeenCalled();
    });
  });

  describe("child loggers", () => {
    it("preserves parent name", () => {
      const parent = createLogger({
        level: "info",
        pretty: false,
        name: "parent",
      });
      const child = parent.child({ childKey: true });
      child.info("from child");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("parent");
    });

    it("merges parent and child bindings", () => {
      const parent = createLogger({
        level: "info",
        pretty: false,
        base: { a: 1, b: 2 },
      });
      const child = parent.child({ b: 99, c: 3 });
      child.info("merge");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"a":1');
      expect(call).toContain('"b":99'); // child overrides parent
      expect(call).toContain('"c":3');
    });

    it("child inherits parent level", () => {
      const parent = createLogger({ level: "warn" });
      const child = parent.child({ c: 1 });
      child.info("hidden");
      expect(consoleLogMock).not.toHaveBeenCalled();
      child.warn("visible");
      expect(consoleLogMock).toHaveBeenCalled();
    });

    it("child inherits parent pretty setting", () => {
      const parent = createLogger({ level: "info", pretty: true });
      const child = parent.child({ c: 1 });
      child.info("pretty child");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("\x1b[");
    });

    it("child of child preserves all bindings", () => {
      const grandparent = createLogger({
        level: "info",
        pretty: false,
        base: { gp: "a" },
      });
      const child = grandparent.child({ c: "b" });
      const grandchild = child.child({ gc: "c" });
      grandchild.info("deep");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"gp":"a"');
      expect(call).toContain('"c":"b"');
      expect(call).toContain('"gc":"c"');
    });

    it("createChildLogger delegates to child method", () => {
      const parent = createLogger({
        level: "info",
        pretty: false,
        base: { p: 1 },
      });
      const child = createChildLogger(parent, { ch: 2 });
      child.info("via factory");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"p":1');
      expect(call).toContain('"ch":2');
    });
  });

  describe("edge cases", () => {
    it("handles empty string message", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("");
      expect(consoleLogMock).toHaveBeenCalled();
    });

    it("handles very long messages", () => {
      const l = createLogger({ level: "info", pretty: false });
      const longMsg = "x".repeat(10_000);
      l.info(longMsg);
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain(longMsg);
    });

    it("handles unicode messages", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info("日本語テスト 🎉");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("日本語テスト 🎉");
    });

    it("handles circular-referencing object attributes via JSON stringify", () => {
      const l = createLogger({ level: "info" });
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;
      // JSON.stringify will throw on circular ref, but the otel path
      // uses try/catch-free JSON.stringify — it'll throw
      // The server formatting path also uses JSON.stringify
      expect(() => l.info("circular", obj as any)).toThrow();
    });

    it("handles options with all defaults", () => {
      const l = createLogger({});
      expect(l).toBeDefined();
      // Should be debug level in test env
      l.debug("should log in test env");
      expect(consoleLogMock).toHaveBeenCalled();
    });

    it("handles multiple rapid log calls", () => {
      const l = createLogger({ level: "info", pretty: false });
      for (let i = 0; i < 100; i++) {
        l.info(`msg-${i}`);
      }
      expect(consoleLogMock).toHaveBeenCalledTimes(100);
    });

    it("object without msg field logs empty string as msg", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info({ data: "no msg" });
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"data":"no msg"');
    });

    it("second arg string sets msg when first arg is object without msg", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info({ data: 1 }, "explicit msg");
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain("explicit msg");
      expect(call).toContain('"data":1');
    });

    it("second arg object merges into first object", () => {
      const l = createLogger({ level: "info", pretty: false });
      l.info({ a: 1 }, { b: 2 });
      const call = consoleLogMock.mock.calls[0]?.[0]! as string;
      expect(call).toContain('"a":1');
      expect(call).toContain('"b":2');
    });

    it("empty options object produces valid logger", () => {
      const l = createLogger();
      expect(() => l.info("test")).not.toThrow();
      expect(() => l.debug("test")).not.toThrow();
      expect(() => l.warn("test")).not.toThrow();
      expect(() => l.error("test")).not.toThrow();
      expect(() => l.fatal("test")).not.toThrow();
      expect(() => l.trace("test")).not.toThrow();
    });
  });

  describe("Logger interface compliance", () => {
    it("satisfies the Logger interface type", () => {
      const l: Logger = createLogger();
      expect(l).toBeDefined();
      expect(typeof l.trace).toBe("function");
      expect(typeof l.debug).toBe("function");
      expect(typeof l.info).toBe("function");
      expect(typeof l.warn).toBe("function");
      expect(typeof l.error).toBe("function");
      expect(typeof l.fatal).toBe("function");
      expect(typeof l.child).toBe("function");
    });
  });

  describe("LoggerOptions interface", () => {
    it("accepts partial options", () => {
      const opts: LoggerOptions = { name: "test" };
      const l = createLogger(opts);
      expect(l).toBeDefined();
    });

    it("accepts all options", () => {
      const opts: LoggerOptions = {
        base: { k: "v" },
        level: "warn",
        name: "full",
        pretty: true,
      };
      const l = createLogger(opts);
      expect(l).toBeDefined();
    });
  });
});
