import {
  DiagConsoleLogger,
  type DiagLogger,
  DiagLogLevel,
  diag,
  metrics,
} from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HostMetrics } from "@opentelemetry/host-metrics";
import {
  type Instrumentation,
  registerInstrumentations,
} from "@opentelemetry/instrumentation";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-node";
import { getOtelConfig, getOtlpSignalEndpoint } from "./config";

export class FilteredDiagLogger implements DiagLogger {
  private readonly logger: DiagLogger;

  constructor(logger: DiagLogger = new DiagConsoleLogger()) {
    this.logger = logger;
  }

  error(message: string, ...args: unknown[]): void {
    if (
      typeof message === "string" &&
      (message.includes("Inconsistent start and end time") ||
        message.includes("Export failed with non-retryable error") ||
        message.includes("OTLPExporterError"))
    ) {
      return;
    }
    this.logger.error(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    if (
      typeof message === "string" &&
      (message.includes("Inconsistent start and end time") ||
        message.includes("[OTEL] Trace export error") ||
        message.includes("OTLPExporterError"))
    ) {
      return;
    }
    this.logger.warn(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.logger.info(message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.logger.debug(message, ...args);
  }

  verbose(message: string, ...args: unknown[]): void {
    this.logger.verbose(message, ...args);
  }
}

let tracerProvider: NodeTracerProvider | null = null;
let meterProvider: MeterProvider | null = null;
let loggerProvider: LoggerProvider | null = null;
let initialized = false;

interface InitOtelOptions {
  samplingRatio?: number;
  serviceVersion?: string;
}

export function initOtel(
  serviceName: string,
  instrumentations: Instrumentation[] = [],
  options: InitOtelOptions = {}
): boolean {
  if (initialized) {
    return true;
  }

  const config = getOtelConfig(serviceName);
  const { serviceVersion = "0.0.0", samplingRatio } = options;
  const effectiveRatio =
    samplingRatio ?? (config.environment === "production" ? 0.2 : 1.0);

  if (!config.enabled) {
    diag.info(
      "[OTEL] Skipping initialization (no OTEL_EXPORTER_OTLP_ENDPOINT configured)"
    );
    return false;
  }

  // Enable debug logging in development
  if (config.environment === "development") {
    diag.setLogger(new FilteredDiagLogger(), DiagLogLevel.INFO);
  }

  const resource = resourceFromAttributes({
    "service.name": config.serviceName,
    "service.version": serviceVersion,
    "deployment.environment": config.environment,
    "host.name": process.env.HOSTNAME || process.env.HOST || "unknown",
  });

  // Trace Provider
  const traceExporter = new OTLPTraceExporter({
    url: getOtlpSignalEndpoint(config, "traces"),
    headers: { ...config.headers, "stream-name": config.traceStream },
  });

  // Wrap exporter to suppress connection errors in development
  const originalExport = traceExporter.export.bind(traceExporter);
  traceExporter.export = (spans, resultCallback) => {
    originalExport(spans, (result) => {
      // Suppress ECONNREFUSED errors - collector may not be running
      if (result.error && !result.error.message?.includes("ECONNREFUSED")) {
        diag.warn("[OTEL] Trace export error:", result.error);
      }
      resultCallback(result);
    });
  };

  tracerProvider = new NodeTracerProvider({
    resource,
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(effectiveRatio),
    }),
    spanProcessors: [
      new BatchSpanProcessor(traceExporter, {
        maxQueueSize: 1000,
        scheduledDelayMillis: 5000,
      }),
    ],
  });
  tracerProvider.register();

  // Metric Provider
  const metricExporter = new OTLPMetricExporter({
    url: getOtlpSignalEndpoint(config, "metrics"),
    headers: { ...config.headers, "stream-name": config.metricStream },
  });
  meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 30_000,
      }),
    ],
  });
  metrics.setGlobalMeterProvider(meterProvider);

  // Log Provider
  const logExporter = new OTLPLogExporter({
    url: getOtlpSignalEndpoint(config, "logs"),
    headers: { ...config.headers, "stream-name": config.logStream },
  });
  loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor(logExporter)],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  // Register Instrumentations
  try {
    if (instrumentations.length > 0) {
      registerInstrumentations({
        tracerProvider,
        meterProvider,
        loggerProvider,
        instrumentations,
      });
      diag.info(
        `[OTEL] Registered ${instrumentations.length} instrumentations`
      );
    }
  } catch (error) {
    diag.warn("[OTEL] Failed to register instrumentations", error);
  }

  // Initialize Host Metrics
  try {
    const hostMetrics = new HostMetrics({
      meterProvider,
      name: "host-metrics",
    });
    hostMetrics.start();
    diag.info("[OTEL] Host metrics started");
  } catch (error) {
    diag.warn("[OTEL] HostMetrics not available", error);
  }

  initialized = true;
  diag.info(
    `[OTEL] Initialized for ${config.serviceName} → org=${config.org} streams=(logs:${config.logStream}, metrics:${config.metricStream}, traces:${config.traceStream})`
  );

  return true;
}

export async function shutdownOtel(): Promise<void> {
  if (!initialized) {
    return;
  }

  const shutdownPromises: Promise<void>[] = [];

  if (tracerProvider) {
    shutdownPromises.push(tracerProvider.shutdown());
  }
  if (meterProvider) {
    shutdownPromises.push(meterProvider.shutdown());
  }
  if (loggerProvider) {
    shutdownPromises.push(loggerProvider.shutdown());
  }

  await Promise.all(shutdownPromises);
  initialized = false;
  diag.info("[OTEL] Shutdown complete");
}

export function getTracerProvider(): NodeTracerProvider | null {
  return tracerProvider;
}

export function getMeterProvider(): MeterProvider | null {
  return meterProvider;
}

export function getLoggerProvider(): LoggerProvider | null {
  return loggerProvider;
}

export function isOtelInitialized(): boolean {
  return initialized;
}
