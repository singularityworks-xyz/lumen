defmodule Presence.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application
  require Logger

  @impl true
  def start(_type, _args) do
    Presence.Token.init_cache()

    # Initialize OpenTelemetry instrumentation (production only)
    if Application.get_env(:opentelemetry, :traces_exporter) == :otlp do
      setup_opentelemetry()
    end

    # Attach telemetry handlers
    Presence.Telemetry.attach_handlers()
    Presence.TelemetryMetrics.attach_handlers()

    children = [
      PresenceWeb.Telemetry,
      Presence.TelemetryMetrics,
      {DNSCluster, query: Application.get_env(:presence, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Presence.PubSub},
      Presence.Tracker,
      PresenceWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Presence.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    PresenceWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp setup_opentelemetry do
    OpentelemetryBandit.setup()
    OpentelemetryPhoenix.setup(adapter: :bandit)
    Logger.info("OpenTelemetry tracing initialized", service: "lumen-presence")
  end
end
