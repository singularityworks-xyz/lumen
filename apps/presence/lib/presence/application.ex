defmodule Presence.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application
  require Logger

  @impl true
  def start(_type, _args) do
    # Initialize OpenTelemetry instrumentation
    setup_opentelemetry()

    # Attach telemetry handlers
    Presence.Telemetry.attach_handlers()

    children = [
      PresenceWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:presence, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Presence.PubSub},
      {Redix, name: :redix, host: redis_host(), port: redis_port(), password: redis_password(), ssl: true},
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

  defp redis_host do
    Application.get_env(:presence, :redis_host) || "localhost"
  end

  defp redis_port do
    Application.get_env(:presence, :redis_port) || 6379
  end

  defp redis_password do
    Application.get_env(:presence, :redis_password)
  end

  defp setup_opentelemetry do
    # Setup Bandit HTTP server instrumentation
    OpentelemetryBandit.setup()

    # Setup Phoenix instrumentation
    OpentelemetryPhoenix.setup(adapter: :bandit)

    Logger.info("OpenTelemetry instrumentation initialized",
      service: "presence-service"
    )
  end
end
