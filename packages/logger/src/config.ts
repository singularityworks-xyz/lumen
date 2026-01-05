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
  // OTEL is server-side only
  if (isBrowser()) {
    return {
      enabled: false,
      endpoint: "",
      serviceName: defaultServiceName,
      environment: "browser",
    };
  }

  const env = process.env.NODE_ENV || "development";
  const enabled = process.env.OTEL_ENABLED !== "false";
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    (env === "production" ? "" : "http://localhost:4318");
  const serviceName = process.env.OTEL_SERVICE_NAME || defaultServiceName;

  return {
    enabled: enabled && !!endpoint,
    endpoint,
    serviceName,
    environment: env,
  };
}
