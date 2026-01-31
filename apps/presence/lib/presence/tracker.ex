defmodule Presence.Tracker do
  @moduledoc """
  Tracks user presence across workspaces with online/idle/away states.
  """
  use Phoenix.Presence,
    otp_app: :presence,
    pubsub_server: Presence.PubSub

  @idle_threshold_ms 5 * 60 * 1000

  @doc """
  Track a user joining a workspace.
  """
  def track_user(socket, user_id, workspace_id, metadata) do
    track(
      socket,
      user_id,
      Map.merge(metadata, %{
        workspace_id: workspace_id,
        joined_at: System.system_time(:second),
        status: "online",
        last_activity: System.monotonic_time(:millisecond)
      })
    )
  end

  @doc """
  Update user status (online/idle/away).
  """
  def update_status(socket, user_id, status) do
    update(socket, user_id, %{
      status: status,
      updated_at: System.system_time(:second),
      last_activity: System.monotonic_time(:millisecond)
    })
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
    list("workspace:#{workspace_id}")
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
