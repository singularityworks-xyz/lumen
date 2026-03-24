import Config

# Load .env file in dev/test environments
if config_env() in [:dev, :test] do
  Dotenvy.source([".env", ".env.#{config_env()}", ".env.local"])
end

# Parse OTEL headers from comma-separated key=value format
parse_otel_headers = fn headers_str ->
  if headers_str == "" do
    []
  else
    headers_str
    |> String.split(",")
    |> Enum.map(fn part ->
      case String.split(part, "=", parts: 2) do
        [key, value] -> {String.trim(key), URI.decode(String.trim(value))}
        _ -> nil
      end
    end)
    |> Enum.reject(&is_nil/1)
  end
end

parse_boolean_env = fn name, default ->
  case System.get_env(name, default) do
    value when value in ["1", "true", "TRUE"] -> true
    _ -> false
  end
end

otel_enabled = parse_boolean_env.("OTEL_ENABLED", "false")

telemetry_console_reporter_enabled =
  parse_boolean_env.("PRESENCE_TELEMETRY_CONSOLE_REPORTER", "false")

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.
# ## Using releases
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#     PHX_SERVER=true bin/presence start
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :presence, PresenceWeb.Endpoint, server: true
end

config :presence, PresenceWeb.Endpoint, http: [port: String.to_integer(System.get_env("PORT", "4000"))]

# Redis configuration (Upstash REST API)
config :presence,
  upstash_redis_rest_url: System.get_env("UPSTASH_REDIS_REST_URL"),
  upstash_redis_rest_token: System.get_env("UPSTASH_REDIS_REST_TOKEN"),
  better_auth_url: System.get_env("BETTER_AUTH_URL") || "http://localhost:3002",
  # Workers API URL for fetching workspace members (Phase 1)
  workers_api_url: System.get_env("WORKERS_API_URL") || "http://localhost:3002",
  # Internal API key for webhook authentication (Phase 2)
  internal_api_key: System.get_env("INTERNAL_API_KEY"),
  telemetry_console_reporter: telemetry_console_reporter_enabled,
  otel_enabled: otel_enabled

# OpenTelemetry OTLP Configuration (Production Only, opt-in via OTEL_ENABLED)
if config_env() == :prod and otel_enabled do
  config :presence, env: :prod

  # Configure OTLP exporter for traces
  # Note: OTLP logs export is NOT supported in Erlang/Elixir OpenTelemetry SDK yet.
  # Logs are output as JSON to stdout with trace_id/span_id for correlation.
  config :opentelemetry_exporter,
    otlp_protocol: :http_protobuf,
    otlp_endpoint: System.get_env("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318"),
    otlp_headers: parse_otel_headers.(System.get_env("OTEL_EXPORTER_OTLP_HEADERS", ""))

  # Configure OpenTelemetry with batch processor and OTLP exporter
  config :opentelemetry,
    span_processor: :batch,
    traces_exporter: :otlp,
    sampler:
      {:parent_based,
       %{
         root: {:trace_id_ratio_based, 0.10},
         remote_parent_sampled: :always_on,
         remote_parent_not_sampled: :always_off,
         local_parent_sampled: :always_on,
         local_parent_not_sampled: :always_off
       }},
    resource_detectors: [:otel_resource_env_var, :otel_resource_app_env]

  # Configure metrics using experimental API (only when OTel is configured)
  if System.get_env("OTEL_EXPORTER_OTLP_ENDPOINT") do
    config :opentelemetry_experimental,
      metrics_exporter: :otlp,
      otlp_metrics_endpoint: System.get_env("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318") <> "/v1/metrics"
  end
else
  config :opentelemetry,
    traces_exporter: :none,
    processors: []
end

if config_env() == :prod do
  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "example.com"

  config :presence, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  config :presence, PresenceWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      # Set it to  {0, 0, 0, 0, 0, 0, 0, 1} for local network only access.
      # See the documentation on https://hexdocs.pm/bandit/Bandit.html#t:options/0
      # for details about using IPv6 vs IPv4 and loopback vs public addresses.
      ip: {0, 0, 0, 0, 0, 0, 0, 0}
    ],
    secret_key_base: secret_key_base
end
