import Config

# Production logging - JSON format for Loki ingestion
config :logger,
  level: :info,
  format: :json,
  metadata: [
    :request_id,
    :trace_id,
    :span_id,
    :user_id,
    :workspace_id,
    :status,
    :duration_ms,
    :service,
    :error,
    :error_type,
    :operation
  ]

# OpenTelemetry Configuration (Production Only)
config :opentelemetry,
  resource: [
    service: %{
      name: "presence-service",
      version: "1.0.0",
      namespace: "lumen"
    },
    deployment: %{
      environment: :prod
    }
  ],
  span_processor: :batch,
  traces_exporter: :otlp

# Runtime production configuration, including reading
# of environment variables, is done on config/runtime.exs.
