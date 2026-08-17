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

function base64Encode(value: string): string {
  // Node.js runtime (the only place this code path runs)
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value).toString("base64");
  }
  // Browser fallback keeps bundlers happy; never executed in practice.
  return btoa(value);
}

// OpenObserve's OTLP endpoints require Basic auth; derive it from
// OPENOBSERVE_USER / OPENOBSERVE_PASSWORD like the other apps using
// OpenObserve directly.
function buildBasicAuthHeader(
  user: string | undefined,
  password: string | undefined
): Record<string, string> {
  if (!(user && password)) {
    return {};
  }
  return { Authorization: `Basic ${base64Encode(`${user}:${password}`)}` };
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
  // Basic auth derived from OPENOBSERVE_USER/PASSWORD
  const headers = buildBasicAuthHeader(
    env.OPENOBSERVE_USER,
    env.OPENOBSERVE_PASSWORD
  );
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
