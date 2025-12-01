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

const levels: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const levelColors: Record<string, { bg: string; text: string }> = {
  trace: { bg: "#6b7280", text: "#fff" },
  debug: { bg: "#9ca3af", text: "#1f2937" },
  info: { bg: "#3b82f6", text: "#fff" },
  warn: { bg: "#f59e0b", text: "#1f2937" },
  error: { bg: "#ef4444", text: "#fff" },
  fatal: { bg: "#7f1d1d", text: "#fff" },
};

const ansiColors: Record<string, string> = {
  trace: "\x1b[37m", // white
  debug: "\x1b[36m", // cyan
  info: "\x1b[34m", // blue
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  fatal: "\x1b[35m", // magenta
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

export type Logger = {
  trace(
    msg: string | Record<string, unknown>,
    obj?: Record<string, unknown>
  ): void;
  debug(
    msg: string | Record<string, unknown>,
    obj?: Record<string, unknown>
  ): void;
  info(
    msg: string | Record<string, unknown>,
    obj?: Record<string, unknown>
  ): void;
  warn(
    msg: string | Record<string, unknown>,
    obj?: Record<string, unknown>
  ): void;
  error(
    msg: string | Record<string, unknown>,
    obj?: Record<string, unknown>
  ): void;
  fatal(
    msg: string | Record<string, unknown>,
    obj?: Record<string, unknown>
  ): void;
  child(bindings: Record<string, unknown>): Logger;
};

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
      options.level ||
      (process.env.NODE_ENV === "production" ? "info" : "debug");
    this.levelNum = levels[this.level];
    this.base = { ...options.base, env: process.env.NODE_ENV };
    this.pretty = options.pretty ?? process.env.NODE_ENV !== "production";
    this.isBrowser = isBrowser();
  }

  private log(
    level: LogLevel,
    arg1: string | Record<string, unknown>,
    arg2?: Record<string, unknown>
  ) {
    let msg: string;
    let obj: Record<string, unknown> | undefined;

    if (typeof arg1 === "string") {
      msg = arg1;
      obj = arg2;
    } else {
      obj = arg1;
      msg = (obj?.msg as string) || "";
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
    }
  }

  trace(
    arg1: string | Record<string, unknown>,
    arg2?: Record<string, unknown>
  ) {
    this.log("trace", arg1, arg2);
  }

  debug(
    arg1: string | Record<string, unknown>,
    arg2?: Record<string, unknown>
  ) {
    this.log("debug", arg1, arg2);
  }

  info(arg1: string | Record<string, unknown>, arg2?: Record<string, unknown>) {
    this.log("info", arg1, arg2);
  }

  warn(arg1: string | Record<string, unknown>, arg2?: Record<string, unknown>) {
    this.log("warn", arg1, arg2);
  }

  error(
    arg1: string | Record<string, unknown>,
    arg2?: Record<string, unknown>
  ) {
    this.log("error", arg1, arg2);
  }

  fatal(
    arg1: string | Record<string, unknown>,
    arg2?: Record<string, unknown>
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
