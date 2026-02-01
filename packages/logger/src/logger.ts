import { context, trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { env } from "./env";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LoggerOptions {
  name?: string;
  level?: LogLevel;
  base?: Record<string, unknown>;
  pretty?: boolean;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

const levels: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const ansiColors: Record<string, string> = {
  trace: "\x1b[37m",
  debug: "\x1b[36m",
  info: "\x1b[34m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  fatal: "\x1b[35m",
};

const levelColors: Record<string, { bg: string; text: string }> = {
  trace: { bg: "#6b7280", text: "#fff" },
  debug: { bg: "#9ca3af", text: "#1f2937" },
  info: { bg: "#3b82f6", text: "#fff" },
  warn: { bg: "#f59e0b", text: "#1f2937" },
  error: { bg: "#ef4444", text: "#fff" },
  fatal: { bg: "#7f1d1d", text: "#fff" },
};

const reset = "\x1b[0m";

function formatBrowserLog(
  logObj: object,
  levelLabel: string,
  loggerName: string
): void {
  const defaultColors = { bg: "#3b82f6", text: "#fff" };
  const colors = levelColors[levelLabel] ?? defaultColors;
  const style = `background: ${colors.bg}; color: ${colors.text}; padding: 2px 6px; border-radius: 3px; font-weight: bold;`;
  const nameStyle = "color: #6b7280; font-weight: normal;";
  const msgStyle = "color: inherit; font-weight: normal;";

  const obj = logObj as Record<string, unknown>;
  const msg = obj.msg ?? "";
  const { level: _level, time: _time, msg: _msg, name: _name, ...rest } = obj;

  const hasExtra = Object.keys(rest).length > 0;

  if (hasExtra) {
    console.groupCollapsed(
      `%c${levelLabel.toUpperCase()}%c ${loggerName} %c${msg}`,
      style,
      nameStyle,
      msgStyle
    );
    console.log(rest);
    console.groupEnd();
  } else {
    console.log(
      `%c${levelLabel.toUpperCase()}%c ${loggerName} %c${msg}`,
      style,
      nameStyle,
      msgStyle
    );
  }
}

function formatServerLog(
  logObj: Record<string, unknown>,
  levelLabel: string,
  loggerName: string,
  pretty: boolean
): void {
  const timestamp = logObj.time as string;
  const msg = logObj.msg as string;
  const { time: _, msg: __, ...rest } = logObj;
  const extra = Object.keys(rest).length > 0 ? JSON.stringify(rest) : "";

  if (pretty) {
    const color = ansiColors[levelLabel] || ansiColors.info;
    console.log(
      `${color}${levelLabel.toUpperCase()}${reset} ${timestamp} ${loggerName} ${msg} ${extra}`
    );
  } else {
    console.log(
      `${levelLabel.toUpperCase()} ${timestamp} ${loggerName} ${msg} ${extra}`
    );
  }
}

export interface Logger {
  trace(
    msg: string | Record<string, unknown>,
    obj?: string | Record<string, unknown>
  ): void;
  debug(
    msg: string | Record<string, unknown>,
    obj?: string | Record<string, unknown>
  ): void;
  info(
    msg: string | Record<string, unknown>,
    obj?: string | Record<string, unknown>
  ): void;
  warn(
    msg: string | Record<string, unknown>,
    obj?: string | Record<string, unknown>
  ): void;
  error(
    msg: string | Record<string, unknown>,
    obj?: string | Record<string, unknown>
  ): void;
  fatal(
    msg: string | Record<string, unknown>,
    obj?: string | Record<string, unknown>
  ): void;
  child(bindings: Record<string, unknown>): Logger;
}

class CustomLogger implements Logger {
  name: string;
  level: LogLevel;
  levelNum: number;
  base: Record<string, unknown>;
  pretty: boolean;
  isBrowser: boolean;

  constructor(options: LoggerOptions) {
    this.name = options.name || "lumen";
    this.level =
      options.level || (env.NODE_ENV === "production" ? "info" : "debug");
    this.levelNum = env.NODE_ENV === "production" ? 100 : levels[this.level];
    this.base = { ...options.base, env: env.NODE_ENV };
    this.pretty = options.pretty ?? env.NODE_ENV !== "production";
    this.isBrowser = isBrowser();
  }

  private log(
    level: LogLevel,
    arg1: string | Record<string, unknown>,
    arg2?: string | Record<string, unknown>
  ) {
    let msg = "";
    let obj: Record<string, unknown> = {};

    if (typeof arg1 === "string") {
      msg = arg1;
      if (arg2 && typeof arg2 !== "string") {
        obj = arg2;
      }
    } else {
      obj = arg1;
      if (arg2) {
        if (typeof arg2 === "string") {
          msg = arg2;
        } else {
          obj = { ...obj, ...arg2 };
        }
      } else {
        msg = (obj.msg as string) || "";
      }
    }

    if (levels[level] < this.levelNum) {
      return;
    }

    const logObj = {
      ...this.base,
      msg,
      ...obj,
      time: new Date().toISOString(),
    };

    if (this.isBrowser) {
      formatBrowserLog(logObj, level, this.name);
    } else {
      formatServerLog(logObj, level, this.name, this.pretty);
      this.emitOtelLog(level, msg, obj);
    }
  }

  private emitOtelLog(
    level: LogLevel,
    msg: string,
    attributes: Record<string, unknown>
  ): void {
    const severityMap: Record<LogLevel, SeverityNumber> = {
      trace: SeverityNumber.TRACE,
      debug: SeverityNumber.DEBUG,
      info: SeverityNumber.INFO,
      warn: SeverityNumber.WARN,
      error: SeverityNumber.ERROR,
      fatal: SeverityNumber.FATAL,
    };

    const otelAttrs: Record<string, string | number | boolean> = {
      "logger.name": this.name,
    };

    // Add trace context for correlation
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      otelAttrs.trace_id = spanContext.traceId;
      otelAttrs.span_id = spanContext.spanId;
    }

    for (const [key, value] of Object.entries(attributes)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        otelAttrs[key] = value;
      } else if (value !== null && value !== undefined) {
        otelAttrs[key] = JSON.stringify(value);
      }
    }

    for (const [key, value] of Object.entries(this.base)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        otelAttrs[`base.${key}`] = value;
      }
    }

    // Get logger lazily to ensure it picks up the registered provider after initOtel()
    const otelLogger = logs.getLogger(this.name);

    // Explicitly pass context (though Logs SDK likely picks it up automatically)
    // Using context.active() is the correct way
    otelLogger.emit({
      severityNumber: severityMap[level],
      severityText: level.toUpperCase(),
      body: msg,
      attributes: otelAttrs,
      timestamp: new Date(),
      context: context.active(),
    });
  }

  trace(
    arg1: string | Record<string, unknown>,
    arg2?: string | Record<string, unknown>
  ) {
    this.log("trace", arg1, arg2);
  }

  debug(
    arg1: string | Record<string, unknown>,
    arg2?: string | Record<string, unknown>
  ) {
    this.log("debug", arg1, arg2);
  }

  info(
    arg1: string | Record<string, unknown>,
    arg2?: string | Record<string, unknown>
  ) {
    this.log("info", arg1, arg2);
  }

  warn(
    arg1: string | Record<string, unknown>,
    arg2?: string | Record<string, unknown>
  ) {
    this.log("warn", arg1, arg2);
  }

  error(
    arg1: string | Record<string, unknown>,
    arg2?: string | Record<string, unknown>
  ) {
    this.log("error", arg1, arg2);
  }

  fatal(
    arg1: string | Record<string, unknown>,
    arg2?: string | Record<string, unknown>
  ) {
    this.log("fatal", arg1, arg2);
  }

  child(bindings: Record<string, unknown>): Logger {
    return new CustomLogger({
      name: this.name,
      level: this.level,
      base: { ...this.base, ...bindings },
      pretty: this.pretty,
    });
  }
}

export function createLogger(options: LoggerOptions = {}): Logger {
  return new CustomLogger(options);
}

export const logger = createLogger();

export function createChildLogger(
  parent: Logger,
  bindings: Record<string, unknown>
): Logger {
  return parent.child(bindings);
}
