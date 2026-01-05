import { env } from "./env";

export type OtelConfig = {
  enabled: boolean;
  endpoint: string;
  serviceName: string;
  environment: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getOtelConfig(defaultServiceName: string): OtelConfig {
  if (isBrowser()) {
    return {
      enabled: false,
      endpoint: "",
      serviceName: defaultServiceName,
      environment: "browser",
    };
  }

  const environment = env.NODE_ENV;
  const enabled = env.OTEL_ENABLED;
  const endpoint =
    env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    (environment === "production" ? "" : "http://localhost:4318");
  const serviceName = env.OTEL_SERVICE_NAME || defaultServiceName;

  return {
    enabled: enabled && !!endpoint,
    endpoint,
    serviceName,
    environment,
  };
}
