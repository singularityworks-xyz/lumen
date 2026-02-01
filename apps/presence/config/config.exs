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
    :previous_status,
    :duration_ms,
    :idle_duration_ms,
    :reason,
    :user_name,
    :service,
    :error,
    :stacktrace,
    :method,
    :route,
    :url,
    :body,
    :channel
  ]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
