import {
  DiagConsoleLogger,
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
} from "@opentelemetry/sdk-trace-node";
import { getOtelConfig } from "./config";

let tracerProvider: NodeTracerProvider | null = null;
let meterProvider: MeterProvider | null = null;
let loggerProvider: LoggerProvider | null = null;
let initialized = false;

interface InitOtelOptions {
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
  const { serviceVersion = "0.0.0" } = options;

  if (!config.enabled) {
    diag.info(
      `[OTEL] Disabled (endpoint: ${config.endpoint || "not set"}, enabled: ${config.enabled})`
    );
    return false;
  }

  // Enable debug logging in development
  if (config.environment === "development") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  const resource = resourceFromAttributes({
    "service.name": config.serviceName,
    "service.version": serviceVersion,
    "deployment.environment": config.environment,
    "host.name": process.env.HOSTNAME || process.env.HOST || "unknown",
  });

  // Trace Provider
  const traceExporter = new OTLPTraceExporter({
    url: `${config.endpoint}/v1/traces`,
    headers: config.headers,
  });
  tracerProvider = new NodeTracerProvider({
    resource,
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
    url: `${config.endpoint}/v1/metrics`,
    headers: config.headers,
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
    url: `${config.endpoint}/v1/logs`,
    headers: config.headers,
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
    `[OTEL] Initialized for ${config.serviceName} → ${config.endpoint}`
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
