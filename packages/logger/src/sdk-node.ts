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

export function initOtel(serviceName: string): boolean {
  if (initialized) {
    return true;
  }

  const config = getOtelConfig(serviceName);

  if (!config.enabled) {
    console.log(
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
    "service.version": "1.0.0",
    "deployment.environment": config.environment,
  });

  // Trace Provider
  const traceExporter = new OTLPTraceExporter({
    url: `${config.endpoint}/v1/traces`,
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
  });
  loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor(logExporter)],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  initialized = true;
  console.log(
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
  console.log("[OTEL] Shutdown complete");
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
