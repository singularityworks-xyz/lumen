defmodule Presence.Metrics do
  @moduledoc """
  Telemetry-based metrics for the presence service.

  Provides comprehensive metrics emitted as Telemetry events,
  which are then converted to Prometheus metrics via TelemetryMetrics.

  Metrics tracked:
  - Connection lifecycle (joins, leaves, duration)
  - Status changes (online, idle, away)
  - Operation latencies (track, status update)
  - Idle detection events
  - Redis pubsub operations
  - Error rates
  """

  require Logger

  require Logger

  @doc """
  Record a user connection (track event).
  """
  def increment_connections(metadata \\ %{}) do
    :telemetry.execute([:presence, :connections, :total], %{count: 1}, metadata)
  end

  @doc """
  Record a user disconnection.
  """
  def decrement_connections(metadata \\ %{}) do
    :telemetry.execute(
      [:presence, :connections, :total],
      %{count: 1},
      Map.put(metadata, :event, :disconnect)
    )
  end

  @doc """
  Record connection duration in milliseconds.
  """
  def record_connection_duration(duration_ms, metadata \\ %{}) when is_number(duration_ms) do
    :telemetry.execute([:presence, :connection, :duration], %{duration: duration_ms}, metadata)
  end

  @doc """
  Record a status change event.
  """
  def increment_status_change(status, metadata \\ %{}) do
    :telemetry.execute(
      [:presence, :status, :changes],
      %{count: 1},
      Map.put(metadata, :status, status)
    )
  end

  @doc """
  Record track operation duration in milliseconds.
  """
  def record_track_duration(duration_ms, metadata \\ %{}) when is_number(duration_ms) do
    :telemetry.execute([:presence, :track, :duration], %{duration: duration_ms}, metadata)
  end

  @doc """
  Record an idle check occurrence.
  """
  def increment_idle_check(metadata \\ %{}) do
    :telemetry.execute([:presence, :idle, :checks], %{count: 1}, metadata)
  end

  @doc """
  Record an idle transition (online → idle).
  """
  def increment_idle_transition(metadata \\ %{}) do
    :telemetry.execute([:presence, :idle, :transitions], %{count: 1}, metadata)
  end

  @doc """
  Record a Redis publish operation.
  """
  def increment_redis_publish(metadata \\ %{}) do
    :telemetry.execute([:presence, :redis, :publish], %{count: 1}, metadata)
  end

  @doc """
  Record a Redis error.
  """
  def increment_redis_error(error_type, metadata \\ %{}) do
    :telemetry.execute(
      [:presence, :redis, :errors],
      %{count: 1},
      Map.put(metadata, :error_type, error_type)
    )
  end

  @doc """
  Record a general error.
  """
  def increment_error(error_type, metadata \\ %{}) do
    :telemetry.execute(
      [:presence, :errors],
      %{count: 1},
      Map.put(metadata, :error_type, error_type)
    )
  end

  @doc """
  Record HTTP request metrics.
  """
  def record_http_request(duration_ms, metadata \\ %{}) when is_number(duration_ms) do
    :telemetry.execute([:presence, :http, :request], %{duration: duration_ms}, metadata)
  end

  @doc """
  Record WebSocket message metrics.
  """
  def record_ws_message(message_type, metadata \\ %{}) do
    :telemetry.execute(
      [:presence, :websocket, :messages],
      %{count: 1},
      Map.put(metadata, :type, message_type)
    )
  end

  @doc """
  Get current active user count.
  Returns 0 if tracker not available.
  """
  def get_active_user_count do
    Presence.Tracker.list("*")
    |> Enum.map(fn {_topic, presences} -> map_size(presences) end)
    |> Enum.sum()
  rescue
    e ->
      Logger.error("Failed to get active user count",
        error: inspect(e),
        stacktrace: __STACKTRACE__
      )

      0
  end
end
