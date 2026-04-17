import Config

# For development, we disable any cache and enable
# debugging and code reloading.
# The watchers configuration can be used to run external
# watchers to your application. For example, we can use it
# to bundle .js and .css sources.
config :presence, PresenceWeb.Endpoint,
  # Binding to loopback ipv4 address prevents access from other machines.
  # Change to `ip: {0, 0, 0, 0}` to allow access from other machines.
  http: [ip: {127, 0, 0, 1}],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "Tz/1hr8XCsaqSQX4G3E06kpUZO3NrJ8i9fNUsrtmIXX4zNS+WKEb0VD76ZETvKSZ",
  watchers: []

config :presence, dev_routes: true
config :presence, env: :dev
config :presence, :allow_e2e_anon_socket, true

# Development logging
config :logger,
  level: :debug,
  format: "[$time] [$level] $message\n",
  colors: [enabled: true]

# Disable OpenTelemetry in development
config :opentelemetry,
  traces_exporter: :none,
  processors: []

# Set a higher stacktrace during development. Avoid configuring such
# in production as building large stacktraces may be expensive.
config :phoenix, :stacktrace_depth, 20

# Initialize plugs at runtime for faster development compilation
config :phoenix, :plug_init_mode, :runtime
