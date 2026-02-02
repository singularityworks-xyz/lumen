defmodule Presence.Telemetry do
  @moduledoc """
  Telemetry handlers for presence operations and OpenTelemetry integration.

  Handles telemetry events and logs them using the Logger module.
  Also emits metrics via Presence.Metrics for collection.
  """

  require Logger

  @doc """
  Attach telemetry handlers for presence events.
  """
  def attach_handlers do
    :telemetry.attach_many(
      "presence-telemetry",
      [
        [:presence, :track],
        [:presence, :update_status],
        [:presence, :user_joined],
        [:presence, :user_left],
        [:presence, :idle, :transition]
      ],
      &__MODULE__.handle_event/4,
      %{}
    )
  end

  @doc """
  Handle presence telemetry events.
  """
  def handle_event([:presence, :track], measurements, metadata, _config) do
    duration_ms = System.convert_time_unit(measurements[:duration], :native, :millisecond)

    Logger.info("User tracked in presence",
      user_id: metadata[:user_id],
      workspace_id: metadata[:workspace_id],
      status: metadata[:status],
      duration_ms: duration_ms
    )

    # Metrics are emitted by Presence.Tracker.track_user to avoid duplication
  end

  def handle_event([:presence, :update_status], measurements, metadata, _config) do
    duration_ms =
      if measurements[:duration] do
        System.convert_time_unit(measurements[:duration], :native, :millisecond)
      else
        0
      end

    Logger.info("User status updated",
      user_id: metadata[:user_id],
      workspace_id: metadata[:workspace_id],
      status: metadata[:status],
      duration_ms: duration_ms
    )

    # Metric is emitted by Presence.Tracker.update_status to avoid duplication
  end

  def handle_event([:presence, :user_joined], measurements, metadata, _config) do
    duration_ms =
      if measurements[:duration] do
        System.convert_time_unit(measurements[:duration], :native, :millisecond)
      else
        0
      end

    Logger.info("User joined workspace",
      user_id: metadata[:user_id],
      workspace_id: metadata[:workspace_id],
      duration_ms: duration_ms
    )

    # Emit connection metrics
    Presence.Metrics.increment_connections(%{
      user_id: metadata[:user_id],
      workspace_id: metadata[:workspace_id],
      event: :join
    })
  end

  def handle_event([:presence, :user_left], measurements, metadata, _config) do
    duration_ms =
      if measurements[:duration] do
        System.convert_time_unit(measurements[:duration], :native, :millisecond)
      else
        0
      end

    Logger.info("User left workspace",
      user_id: metadata[:user_id],
      workspace_id: metadata[:workspace_id],
      duration_ms: duration_ms
    )

    # Decrement connection count
    Presence.Metrics.decrement_connections(%{
      user_id: metadata[:user_id],
      workspace_id: metadata[:workspace_id]
    })

    # Record session duration if available
    if metadata[:session_duration_ms] do
      Presence.Metrics.record_connection_duration(metadata[:session_duration_ms], %{
        user_id: metadata[:user_id],
        workspace_id: metadata[:workspace_id]
      })
    end
  end

  def handle_event([:presence, :idle, :transition], _measurements, metadata, _config) do
    Logger.info("User transitioned to idle",
      user_id: metadata[:user_id],
      workspace_id: metadata[:workspace_id],
      previous_status: metadata[:previous_status]
    )

    # Emit idle transition metric
    Presence.Metrics.increment_idle_transition(%{
      user_id: metadata[:user_id],
      workspace_id: metadata[:workspace_id]
    })
  end
end
