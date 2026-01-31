# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :presence,
  generators: [timestamp_type: :utc_datetime]

# Configure the endpoint
config :presence, PresenceWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: PresenceWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Presence.PubSub

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [
    :request_id,
    :trace_id,
    :span_id,
    :user_id,
    :workspace_id,
    :status,
    :duration_ms,
    :idle_duration_ms,
    :reason,
    :user_name,
    :service
  ]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# OpenTelemetry Configuration
config :opentelemetry,
  resource: [
    service: %{
      name: "presence-service",
      version: "0.1.0",
      namespace: "lumen"
    },
    deployment: %{
      environment: config_env()
    }
  ],
  span_processor: :batch,
  traces_exporter: :otlp

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
