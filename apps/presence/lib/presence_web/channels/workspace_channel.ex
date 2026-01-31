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
      workspace_id: workspace_id,
      trace_id: PresenceTracer.current_trace_id()
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

    broadcast_presence_event("user_joined", socket)
    schedule_idle_check()

    :telemetry.execute(
      [:presence, :user_joined],
      %{duration: 0},
      %{user_id: socket.assigns.user_id, workspace_id: workspace_id}
    )

    {:ok, assign(socket, :status, "online")}
  end

  @impl true
  def handle_info(:check_idle, socket) do
    last_activity = socket.assigns.last_activity

    if Tracker.should_mark_idle?(last_activity) && socket.assigns.status == "online" do
      Logger.info("User marked idle due to inactivity",
        user_id: socket.assigns.user_id,
        workspace_id: socket.assigns.workspace_id,
        idle_duration_ms: System.monotonic_time(:millisecond) - last_activity
      )

      Tracker.update_status(socket, socket.assigns.user_id, "idle")
      {:noreply, assign(socket, :status, "idle")}
    else
      schedule_idle_check()
      {:noreply, socket}
    end
  end

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

  @impl true
  def handle_in("activity_ping", _payload, socket) do
    now = System.monotonic_time(:millisecond)
    Tracker.update_activity(socket, socket.assigns.user_id)

    socket =
      if socket.assigns.status == "idle" do
        Logger.info("User returned from idle",
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

  @impl true
  def terminate(_reason, socket) do
    Logger.info("User disconnected from workspace",
      user_id: socket.assigns.user_id,
      workspace_id: socket.assigns.workspace_id
    )

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
    Presence.RedisPubSub.broadcast("presence:#{event}", %{
      workspace_id: socket.assigns.workspace_id,
      user_id: socket.assigns.user_id,
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end
end
