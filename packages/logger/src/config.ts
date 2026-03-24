import { env } from "./env";

export interface OtelConfig {
  enabled: boolean;
  endpoint: string;
  environment: string;
  headers: Record<string, string>;
  serviceName: string;
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
      headers: {},
      serviceName: defaultServiceName,
      environment: "browser",
    };
  }

  const environment = env.NODE_ENV;
  const enabled = env.OTEL_ENABLED;
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT || "";
  const headers = parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS);
  const serviceName = defaultServiceName;

  return {
    enabled: enabled && !!endpoint,
    endpoint,
    headers,
    serviceName,
    environment,
  };
}
