import Config

# Force using SSL in production. This also sets the "strict-security-transport" header,
# known as HSTS. If you have a health check endpoint, you may want to exclude it below.
# Note `:force_ssl` is required to be set at compile-time.
config :presence, PresenceWeb.Endpoint,
  force_ssl: [
    rewrite_on: [:x_forwarded_proto],
    exclude: [hosts: ["localhost", "127.0.0.1"]]
  ]

# Do not print debug messages in production
config :logger, level: :info

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
