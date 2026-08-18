defmodule PresenceWeb.WorkspaceChannel do
  @moduledoc """
  Channel for workspace-specific presence tracking.
  Handles join/leave events, status updates, and idle detection.
  Includes OpenTelemetry tracing and structured logging.
  """
  use Phoenix.Channel

  require Logger
  require Presence.Tracer, as: PresenceTracer

  alias Presence.Tracer, as: PresenceTracer
  alias Presence.Tracker

  @idle_check_interval 30_000

  # Intercept presence_diff to broadcast to clients
  intercept(["presence_diff"])

  @impl true
  def join("workspace:" <> workspace_id, _payload, socket) do
    # Set trace context for the channel
    PresenceTracer.set_user_context(socket.assigns.user_id, %{
      name: socket.assigns.user_name,
      workspace_id: workspace_id
    })

    PresenceTracer.set_workspace_context(workspace_id)

    Logger.info("User joining workspace",
      user_id: socket.assigns.user_id,
      workspace_id: workspace_id
    )

    socket =
      socket
      |> assign(:workspace_id, workspace_id)
      |> assign(:last_activity, System.monotonic_time(:millisecond))

    {:ok, _} =
      Tracker.track_user(socket, socket.assigns.user_id, workspace_id, %{
        name: socket.assigns.user_name,
        avatar: socket.assigns.user_avatar,
        status: "online"
      })

    # Synchronize presence sets in Redis for fast canonical querying
    Presence.RedisPubSub.command(["SADD", "presence:workspace:#{workspace_id}:users", socket.assigns.user_id])
    Presence.RedisPubSub.command(["SADD", "presence:user:#{socket.assigns.user_id}:workspaces", workspace_id])

    # Send initial presence state after a short delay to ensure tracking is complete
    send(self(), :after_join)

    broadcast_presence_event("user_joined", socket)
    schedule_idle_check()

    :telemetry.execute(
      [:presence, :user_joined],
      %{duration: 0},
      %{user_id: socket.assigns.user_id, workspace_id: workspace_id}
    )

    {:ok, assign(socket, :status, "online")}
  end

  # Group all handle_info clauses together
  @impl true
  def handle_info(:after_join, socket) do
    # Push the current presence state to the newly joined client
    push(socket, "presence_state", Tracker.list(socket.topic))
    {:noreply, socket}
  end

  def handle_info(:check_idle, socket) do
    last_activity = socket.assigns.last_activity

    # Record idle check metric
    Presence.Metrics.increment_idle_check(%{
      workspace_id: socket.assigns.workspace_id
    })

    socket =
      if Tracker.should_mark_idle?(last_activity) && socket.assigns.status == "online" do
        Logger.debug("User marked idle due to inactivity",
          user_id: socket.assigns.user_id,
          workspace_id: socket.assigns.workspace_id,
          idle_duration_ms: System.monotonic_time(:millisecond) - last_activity
        )

        # Emit idle transition telemetry (metric is handled by telemetry handler)
        :telemetry.execute(
          [:presence, :idle, :transition],
          %{},
          %{
            user_id: socket.assigns.user_id,
            workspace_id: socket.assigns.workspace_id,
            previous_status: "online"
          }
        )

        Tracker.update_status(socket, socket.assigns.user_id, "idle")
        assign(socket, :status, "idle")
      else
        socket
      end

    schedule_idle_check()
    {:noreply, socket}
  end

  @impl true
  def handle_out("presence_diff", diff, socket) do
    # Push presence diffs to all clients
    push(socket, "presence_diff", diff)
    {:noreply, socket}
  end

  # Group all handle_in clauses together
  @impl true
  def handle_in("status_update", %{"status" => status}, socket) do
    Logger.debug("Status update received",
      user_id: socket.assigns.user_id,
      workspace_id: socket.assigns.workspace_id,
      status: status
    )

    Tracker.update_status(socket, socket.assigns.user_id, status)

    socket =
      socket
      |> assign(:status, status)
      |> assign(:last_activity, System.monotonic_time(:millisecond))

    {:noreply, socket}
  end

  def handle_in("activity_ping", _payload, socket) do
    now = System.monotonic_time(:millisecond)
    Tracker.update_activity(socket, socket.assigns.user_id)

    socket =
      if socket.assigns.status == "idle" do
        Logger.debug("User returned from idle",
          user_id: socket.assigns.user_id,
          workspace_id: socket.assigns.workspace_id
        )

        Tracker.update_status(socket, socket.assigns.user_id, "online")
        assign(socket, :status, "online")
      else
        socket
      end

    {:noreply, assign(socket, :last_activity, now)}
  end

  def handle_in("typing", payload, socket) do
    is_typing = Map.get(payload, "is_typing", true)
    task_id = Map.get(payload, "task_id")

    if socket.joined do
      broadcast_from!(socket, "user_typing", %{
        user_id: socket.assigns.user_id,
        name: socket.assigns.user_name,
        is_typing: is_typing,
        task_id: task_id
      })
    end

    {:noreply, socket}
  end

  def handle_in("cursor_position", %{"x" => x, "y" => y} = payload, socket) do
    if socket.joined do
      broadcast_from!(socket, "cursor_moved", %{
        user_id: socket.assigns.user_id,
        name: socket.assigns.user_name,
        x: x,
        y: y,
        selection: Map.get(payload, "selection")
      })
    end

    {:noreply, socket}
  end

  @impl true
  def terminate(_reason, socket) do
    Logger.info("User disconnected from workspace",
      user_id: socket.assigns.user_id,
      workspace_id: socket.assigns.workspace_id
    )

    # Clean up Redis presence sets
    Presence.RedisPubSub.command([
      "SREM",
      "presence:workspace:#{socket.assigns.workspace_id}:users",
      socket.assigns.user_id
    ])

    Presence.RedisPubSub.command([
      "SREM",
      "presence:user:#{socket.assigns.user_id}:workspaces",
      socket.assigns.workspace_id
    ])

    broadcast_presence_event("user_left", socket)

    :telemetry.execute(
      [:presence, :user_left],
      %{duration: 0},
      %{user_id: socket.assigns.user_id, workspace_id: socket.assigns.workspace_id}
    )

    :ok
  end

  defp schedule_idle_check do
    Process.send_after(self(), :check_idle, @idle_check_interval)
  end

  defp broadcast_presence_event(event, socket) do
    # Emit Redis publish metric
    Presence.Metrics.increment_redis_publish(%{
      event_type: event,
      workspace_id: socket.assigns.workspace_id
    })

    Presence.RedisPubSub.broadcast("presence:#{event}", %{
      workspace_id: socket.assigns.workspace_id,
      user_id: socket.assigns.user_id,
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end
end
