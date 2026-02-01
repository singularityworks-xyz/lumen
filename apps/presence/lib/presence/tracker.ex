defmodule Presence.Tracker do
  @moduledoc """
  Tracks user presence across workspaces with online/idle/away states.
  Includes OpenTelemetry tracing and structured logging.
  """
  use Phoenix.Presence,
    otp_app: :presence,
    pubsub_server: Presence.PubSub

  require Logger
  require OpenTelemetry.Tracer
  require Presence.Tracer, as: PresenceTracer

  alias Presence.Tracer, as: PresenceTracer

  @idle_threshold_ms 5 * 60 * 1000

  @doc """
  Track a user joining a workspace.
  """
  def track_user(socket, user_id, workspace_id, metadata) do
    start_time = System.monotonic_time(:millisecond)

    PresenceTracer.trace "presence.track_user",
                         [
                           {"user.id", user_id},
                           {"workspace.id", workspace_id},
                           {"channel.topic", socket.topic}
                         ] do
      # Set context for logging
      PresenceTracer.set_user_context(user_id, %{workspace_id: workspace_id})
      PresenceTracer.set_workspace_context(workspace_id)

      # Add trace IDs to metadata for correlation
      trace_id = PresenceTracer.current_trace_id()
      span_id = PresenceTracer.current_span_id()

      Logger.metadata(trace_id: trace_id, span_id: span_id)

      result =
        track(
          socket,
          user_id,
          Map.merge(metadata, %{
            workspace_id: workspace_id,
            joined_at: System.system_time(:second),
            status: "online",
            last_activity: System.monotonic_time(:millisecond),
            trace_id: trace_id
          })
        )

      duration_ms = System.monotonic_time(:millisecond) - start_time

      # Emit telemetry event with actual duration
      :telemetry.execute(
        [:presence, :track],
        %{duration: System.convert_time_unit(duration_ms, :millisecond, :native)},
        %{user_id: user_id, workspace_id: workspace_id, status: "online"}
      )

      # Emit metrics
      Presence.Metrics.record_track_duration(duration_ms, %{
        user_id: user_id,
        workspace_id: workspace_id
      })

      Logger.info("User tracked in presence",
        user_id: user_id,
        workspace_id: workspace_id,
        status: "online",
        duration_ms: duration_ms
      )

      result
    end
  end

  @doc """
  Update user status (online/idle/away).
  """
  def update_status(socket, user_id, status) do
    start_time = System.monotonic_time(:millisecond)

    PresenceTracer.trace "presence.update_status",
                         [
                           {"user.id", user_id},
                           {"status", status}
                         ] do
      result =
        update(socket, user_id, %{
          status: status,
          updated_at: System.system_time(:second),
          last_activity: System.monotonic_time(:millisecond)
        })

      duration_ms = System.monotonic_time(:millisecond) - start_time

      :telemetry.execute(
        [:presence, :update_status],
        %{duration: System.convert_time_unit(duration_ms, :millisecond, :native)},
        %{user_id: user_id, status: status}
      )

      # Emit status change metric
      Presence.Metrics.increment_status_change(status, %{
        user_id: user_id
      })

      Logger.info("User status updated",
        user_id: user_id,
        status: status,
        duration_ms: duration_ms
      )

      result
    end
  end

  @doc """
  Update last activity timestamp.
  """
  def update_activity(socket, user_id) do
    update(socket, user_id, %{
      last_activity: System.monotonic_time(:millisecond)
    })
  end

  @doc """
  List all users in a workspace with their presence data.
  """
  def list_workspace_users(workspace_id) do
    PresenceTracer.trace "presence.list_workspace_users",
                         [{"workspace.id", workspace_id}] do
      presences = list("workspace:#{workspace_id}")

      PresenceTracer.add_event("presence.listed", [
        {"workspace.id", workspace_id},
        {"user.count", map_size(presences)}
      ])

      presences
    end
  end

  @doc """
  Get a specific user's presence data.
  """
  def get_user(socket, user_id) do
    get_by_key(socket, user_id)
  end

  @doc """
  Check if user should be marked idle based on inactivity.
  """
  def should_mark_idle?(last_activity) do
    now = System.monotonic_time(:millisecond)
    elapsed = now - last_activity
    elapsed > @idle_threshold_ms
  end
end
