import pino from "pino";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LoggerOptions = {
  name?: string;
  level?: LogLevel;
  base?: Record<string, unknown>;
  pretty?: boolean;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

const levelColors: Record<string, { bg: string; text: string }> = {
  trace: { bg: "#6b7280", text: "#fff" },
  debug: { bg: "#9ca3af", text: "#1f2937" },
  info: { bg: "#3b82f6", text: "#fff" },
  warn: { bg: "#f59e0b", text: "#1f2937" },
  error: { bg: "#ef4444", text: "#fff" },
  fatal: { bg: "#7f1d1d", text: "#fff" },
};

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

function createBrowserWrite(loggerName: string) {
  return {
    trace: (o: object) => formatBrowserLog(o, "trace", loggerName),
    debug: (o: object) => formatBrowserLog(o, "debug", loggerName),
    info: (o: object) => formatBrowserLog(o, "info", loggerName),
    warn: (o: object) => formatBrowserLog(o, "warn", loggerName),
    error: (o: object) => formatBrowserLog(o, "error", loggerName),
    fatal: (o: object) => formatBrowserLog(o, "fatal", loggerName),
  };
}

export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const {
    name = "lumen",
    level = process.env.NODE_ENV === "production" ? "info" : "debug",
    base = {},
    pretty: usePretty = process.env.NODE_ENV !== "production",
  } = options;

  const isProduction = process.env.NODE_ENV === "production";

  if (isBrowser()) {
    return pino({
      name,
      level,
      base: {
        ...base,
        env: process.env.NODE_ENV,
      },
      browser: {
        asObject: true,
        write: createBrowserWrite(name),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  if (isProduction || !usePretty) {
    return pino({
      name,
      level,
      base: {
        ...base,
        env: process.env.NODE_ENV,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
      },
    });
  }

  const buildPrettyStream = require("pino-pretty") as (
    opts: object
  ) => pino.DestinationStream;
  const prettyStream = buildPrettyStream({
    colorize: true,
    translateTime: "HH:MM:ss.l",
    ignore: "pid,hostname,env",
    singleLine: false,
  });

  return pino(
    {
      name,
      level,
      base: {
        ...base,
        env: process.env.NODE_ENV,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    prettyStream
  );
}

export const logger = createLogger();

export function createChildLogger(
  parent: pino.Logger,
  bindings: Record<string, unknown>
): pino.Logger {
  return parent.child(bindings);
}
