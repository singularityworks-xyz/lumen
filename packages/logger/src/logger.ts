import pino from "pino";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LoggerOptions = {
  name?: string;
  level?: LogLevel;
  base?: Record<string, unknown>;
  pretty?: boolean;
};

export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const {
    name = "lumen",
    level = "info",
    base = {},
    pretty = process.env.NODE_ENV !== "production",
  } = options;

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction || !pretty) {
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
    pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
        singleLine: false,
      },
    })
  );
}

export const logger = createLogger();

export function createChildLogger(
  parent: pino.Logger,
  bindings: Record<string, unknown>
): pino.Logger {
  return parent.child(bindings);
}
