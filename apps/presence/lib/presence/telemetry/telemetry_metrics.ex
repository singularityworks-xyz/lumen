defmodule Presence.TelemetryMetrics do
  @moduledoc """
  TelemetryMetrics reporter for the presence service.

  The console reporter is disabled by default so local development logs stay
  readable. Set `PRESENCE_TELEMETRY_CONSOLE_REPORTER=true` to opt in when you
  want to inspect raw telemetry events locally.

  In production: No console output - telemetry events flow to OTel Collector
  via the standard telemetry pipeline (configured separately).

  This module provides the Telemetry.Metrics definitions that describe what
  metrics are available. The actual collection happens through telemetry events
  emitted throughout the codebase.
  """

  use Supervisor

  def start_link(arg) do
    Supervisor.start_link(__MODULE__, arg, name: __MODULE__)
  end

  @impl true
  def init(_arg) do
    children =
      if console_reporter_enabled?() do
        # Opt-in reporter for local telemetry debugging.
        [{Telemetry.Metrics.ConsoleReporter, metrics: metrics(), level: :debug}]
      else
        []
      end

    Supervisor.init(children, strategy: :one_for_one)
  end

  @doc """
  Returns a list of metrics definitions.
  These describe the metrics emitted by the presence service.
  """
  def metrics do
    [
      # Connection metrics
      Telemetry.Metrics.counter("presence.connections.total",
        event_name: [:presence, :connections, :total],
        measurement: :count,
        tags: [:event],
        description: "Total number of presence connections and disconnections"
      ),
      Telemetry.Metrics.distribution("presence.connection.duration",
        event_name: [:presence, :connection, :duration],
        measurement: :duration,
        unit: {:millisecond, :second},
        buckets: [0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0, 1800.0, 3600.0],
        tags: [],
        description: "Presence session duration in seconds"
      ),

      # Status change metrics
      Telemetry.Metrics.counter("presence.status.changes.total",
        event_name: [:presence, :status, :changes],
        measurement: :count,
        tags: [:status],
        description: "Total number of status changes by type"
      ),

      # Track operation metrics
      Telemetry.Metrics.distribution("presence.track.duration",
        event_name: [:presence, :track, :duration],
        measurement: :duration,
        unit: {:millisecond, :second},
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0],
        tags: [],
        description: "Track operation duration in seconds"
      ),

      # Idle detection metrics
      Telemetry.Metrics.counter("presence.idle.checks.total",
        event_name: [:presence, :idle, :checks],
        measurement: :count,
        tags: [],
        description: "Total number of idle detection checks"
      ),
      Telemetry.Metrics.counter("presence.idle.transitions.total",
        event_name: [:presence, :idle, :transitions],
        measurement: :count,
        tags: [],
        description: "Total number of online to idle transitions"
      ),

      # Redis metrics
      Telemetry.Metrics.counter("presence.redis.publish.total",
        event_name: [:presence, :redis, :publish],
        measurement: :count,
        tags: [:event_type],
        description: "Total number of Redis publish operations"
      ),
      Telemetry.Metrics.counter("presence.redis.errors.total",
        event_name: [:presence, :redis, :errors],
        measurement: :count,
        tags: [:error_type],
        description: "Total number of Redis operation failures"
      ),

      # Error metrics
      Telemetry.Metrics.counter("presence.errors.total",
        event_name: [:presence, :errors],
        measurement: :count,
        tags: [:error_type, :operation],
        description: "Total number of errors by type"
      ),

      # HTTP metrics (from plug)
      Telemetry.Metrics.counter("presence.http.requests.total",
        event_name: [:presence, :http, :request],
        measurement: :count,
        tags: [:method, :route, :status],
        description: "Total HTTP requests"
      ),
      Telemetry.Metrics.distribution("presence.http.request.duration",
        event_name: [:presence, :http, :request],
        measurement: :duration,
        unit: {:millisecond, :second},
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0],
        tags: [:method, :route],
        description: "HTTP request duration in seconds"
      ),

      # WebSocket message metrics
      Telemetry.Metrics.counter("presence.websocket.messages.total",
        event_name: [:presence, :websocket, :messages],
        measurement: :count,
        tags: [:type],
        description: "Total WebSocket messages by type"
      ),

      # VM metrics (standard)
      Telemetry.Metrics.last_value("vm.memory.total", unit: {:byte, :kilobyte}),
      Telemetry.Metrics.last_value("vm.total_run_queue_lengths.total"),
      Telemetry.Metrics.last_value("vm.total_run_queue_lengths.cpu"),
      Telemetry.Metrics.last_value("vm.total_run_queue_lengths.io")
    ]
  end

  @doc """
  Attach telemetry handlers for metrics.
  In production, telemetry events flow to OTel Collector.
  When explicitly enabled in development, they also print to console via
  ConsoleReporter.
  """
  def attach_handlers do
    # Telemetry events are already being emitted throughout the app.
    # The ConsoleReporter (when enabled) automatically receives these events.
    # In production, an OTel Collector can be configured to receive them.
    :ok
  end

  defp console_reporter_enabled? do
    Application.get_env(:presence, :telemetry_console_reporter, false)
  end
end
