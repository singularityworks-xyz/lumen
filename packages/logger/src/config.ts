import { env } from "./env";

export type OtelSignal = "logs" | "metrics" | "traces";

export interface OtelConfig {
  enabled: boolean;
  endpoint: string;
  environment: string;
  headers: Record<string, string>;
  logStream: string;
  metricStream: string;
  org: string;
  serviceName: string;
  traceStream: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function parseHeaders(headersStr: string | undefined): Record<string, string> {
  if (!headersStr) {
    return {};
  }

  const headers: Record<string, string> = {};
  const parts = headersStr.split(",");

  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex > 0) {
      const key = part.slice(0, eqIndex).trim();
      const value = part.slice(eqIndex + 1).trim();
      headers[key] = decodeURIComponent(value);
    }
  }

  return headers;
}

export function getOtelConfig(defaultServiceName: string): OtelConfig {
  if (isBrowser()) {
    return {
      enabled: false,
      endpoint: "",
      org: "default",
      logStream: "",
      metricStream: "",
      traceStream: "",
      headers: {},
      serviceName: defaultServiceName,
      environment: "browser",
    };
  }

  const environment = env.NODE_ENV;
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT || "";
  const headers = parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS);
  const serviceName = defaultServiceName;

  return {
    enabled: !!endpoint,
    endpoint,
    org: env.OPENOBSERVE_ORG,
    logStream: env.OPENOBSERVE_LOG_STREAM,
    metricStream: env.OPENOBSERVE_METRIC_STREAM,
    traceStream: env.OPENOBSERVE_TRACE_STREAM,
    headers,
    serviceName,
    environment,
  };
}

const TRAILING_SLASHES = /\/+$/;

// Build the per-signal OTLP/HTTP endpoint for OpenObserve:
// {endpoint}/api/{org}/v1/{signal}. The endpoint env var holds the host base
// only; the org is appended here so it can be shared across apps.
export function getOtlpSignalEndpoint(
  config: OtelConfig,
  signal: OtelSignal
): string {
  const base = config.endpoint.replace(TRAILING_SLASHES, "");
  return `${base}/api/${config.org}/v1/${signal}`;
}
