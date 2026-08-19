import Config

# Production logging - JSON format for Loki ingestion
# Note: Sensitive identifiers (user_id, workspace_id) and detailed error info
# are excluded from logs to prevent PII/tenant data exposure. Use trace_id
# and request_id for correlation with traces where full context is available.
config :logger, :default_handler,
  level: :info,
  formatter:
    {LoggerJSON.Formatters.Basic,
     metadata: [
       :request_id,
       :trace_id,
       :span_id,
       :status,
       :previous_status,
       :duration_ms,
       :service,
       :method,
       :route
     ]}

# OpenTelemetry Configuration (Production Only)
config :opentelemetry,
  resource: [
    service: %{
      name: "lumen-presence",
      version: "1.0.47",
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
