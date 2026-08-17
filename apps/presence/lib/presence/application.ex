defmodule Presence.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application
  require Logger

  @impl true
  def start(_type, _args) do
    Presence.Token.init_cache()

    # OpenTelemetry is mandatory; setup is skipped only when the exporter is
    # not configured (i.e. in the :test environment).
    if otel_enabled?() do
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
      redis_pool_child_spec(),
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

  defp otel_enabled? do
    Application.get_env(:opentelemetry, :traces_exporter) == :otlp
  end

  # credo:disable-for-next-line Credo.Check.Refactor.CyclomaticComplexity
  defp redis_pool_child_spec do
    redis_url = Application.get_env(:presence, :redis_url) || System.get_env("REDIS_URL")

    unless redis_url && redis_url != "" do
      raise "REDIS_URL environment variable is required"
    end

    uri = URI.parse(redis_url)

    # Validate URI scheme
    unless uri.scheme in ["redis", "rediss"] do
      raise "Invalid REDIS_URL scheme: #{uri.scheme}. Only redis:// and rediss:// are supported"
    end

    # Validate host
    unless uri.host do
      raise "Invalid REDIS_URL: missing host"
    end

    # Build Redix options from URI
    host = uri.host
    port = uri.port || 6379
    database = uri.path && String.trim_leading(uri.path, "/")
    password = extract_password_from_userinfo(uri.userinfo)
    ssl = uri.scheme == "rediss"

    redix_opts =
      [name: :redis_pool, host: host, port: port]
      |> then(&if(password, do: Keyword.put(&1, :password, password), else: &1))
      |> then(&if(database && database != "", do: Keyword.put(&1, :database, String.to_integer(database)), else: &1))
      |> then(&if(ssl, do: Keyword.put(&1, :ssl, true), else: &1))

    {Redix, redix_opts}
  end

  defp extract_password_from_userinfo(nil), do: nil

  defp extract_password_from_userinfo(userinfo) do
    case String.split(userinfo, ":", parts: 2) do
      [_username, password] -> password
      [_username] -> nil
    end
  end
end
