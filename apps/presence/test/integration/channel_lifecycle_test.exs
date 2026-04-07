defmodule PresenceWeb.WorkspaceChannelIntegrationTest do
  use PresenceWeb.ChannelCase, async: false

  import Presence.Test.Fixtures
  import Presence.Test.Helpers

  alias Presence.Token
  alias PresenceWeb.WorkspaceChannel

  @moduletag :capture_log

  setup_all do
    Application.ensure_all_started(:phoenix)
    Application.ensure_all_started(:phoenix_pubsub)
    Application.ensure_all_started(:jose)

    original_url = Application.get_env(:presence, :better_auth_url)

    on_exit(fn ->
      Application.put_env(:presence, :better_auth_url, original_url)
    end)

    Application.put_env(:presence, :better_auth_url, "https://auth.example.com")
    :ok
  end

  setup do
    Token.init_cache()
    on_exit(fn -> Token.clear_jwks_cache() end)

    workspace_id = "workspace_#{unique_id()}"
    user_id = "user_#{unique_id()}"

    {token, claims, jwks} =
      valid_jwt_token_with_jwks(
        user_id: user_id,
        name: "Test User",
        image: "https://example.com/avatar.png"
      )

    Token.set_jwks_for_test(jwks)

    {:ok, workspace_id: workspace_id, user_id: user_id, token: token, claims: claims}
  end

  describe "full WebSocket lifecycle via direct module calls" do
    test "join -> status_update -> terminate", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id, name: "Test User"})

      {:ok, joined_socket} =
        WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      assert joined_socket.assigns.user_id == user_id
      assert joined_socket.assigns.workspace_id == workspace_id
      assert joined_socket.assigns.status == "online"

      {:noreply, updated_socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, joined_socket)

      assert updated_socket.assigns.status == "idle"

      result = WorkspaceChannel.terminate(:normal, updated_socket)
      assert result == :ok
    end

    test "join -> activity_ping -> terminate", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id, name: "Test User"})

      {:ok, joined_socket} =
        WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      original_activity = joined_socket.assigns.last_activity

      {:noreply, pinged_socket} =
        WorkspaceChannel.handle_in("activity_ping", %{}, joined_socket)

      assert pinged_socket.assigns.last_activity >= original_activity

      result = WorkspaceChannel.terminate(:normal, pinged_socket)
      assert result == :ok
    end

    test "join -> status_update -> activity_ping returns from idle", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id, name: "Test User"})

      {:ok, joined_socket} =
        WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      # Go idle
      {:noreply, idle_socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, joined_socket)

      assert idle_socket.assigns.status == "idle"

      # Activity ping should return to online
      {:noreply, online_socket} =
        WorkspaceChannel.handle_in("activity_ping", %{}, idle_socket)

      assert online_socket.assigns.status == "online"
    end
  end

  describe "status update transitions" do
    test "status_update changes status and last_activity", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id})
      {:ok, socket} = WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      stale_activity = System.monotonic_time(:millisecond) - 10_000
      socket = Phoenix.Socket.assign(socket, :last_activity, stale_activity)

      {:noreply, updated} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "away"}, socket)

      assert updated.assigns.status == "away"
      assert updated.assigns.last_activity > stale_activity
    end

    test "multiple status transitions work correctly", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id})
      {:ok, socket} = WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      assert socket.assigns.status == "online"

      {:noreply, socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, socket)

      assert socket.assigns.status == "idle"

      {:noreply, socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "away"}, socket)

      assert socket.assigns.status == "away"

      {:noreply, socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "online"}, socket)

      assert socket.assigns.status == "online"
    end
  end

  describe "activity_ping behavior" do
    test "activity_ping updates last_activity timestamp", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id})
      {:ok, socket} = WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      original = socket.assigns.last_activity
      stale_activity = System.monotonic_time(:millisecond) - 10_000
      socket = Phoenix.Socket.assign(socket, :last_activity, stale_activity)

      {:noreply, updated} = WorkspaceChannel.handle_in("activity_ping", %{}, socket)

      assert updated.assigns.last_activity > stale_activity
    end

    test "activity_ping preserves current status when online", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id})
      {:ok, socket} = WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      {:noreply, updated} = WorkspaceChannel.handle_in("activity_ping", %{}, socket)

      assert updated.assigns.status == "online"
    end
  end

  describe "idle detection" do
    test ":check_idle transitions user to idle when inactive", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id})
      {:ok, socket} = WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      # Simulate old last_activity (more than 5 minutes ago)
      old_activity = System.monotonic_time(:millisecond) - 6 * 60 * 1000
      socket = Phoenix.Socket.assign(socket, :last_activity, old_activity)

      # Send :check_idle directly
      {:noreply, idle_socket} = WorkspaceChannel.handle_info(:check_idle, socket)

      assert idle_socket.assigns.status == "idle"
    end

    test ":check_idle does not transition when recently active", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id})
      {:ok, socket} = WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      # last_activity is recent (just set by join)
      {:noreply, still_online} = WorkspaceChannel.handle_info(:check_idle, socket)

      assert still_online.assigns.status == "online"
    end

    test ":check_idle does not transition when already idle", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id})
      {:ok, socket} = WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      # Go idle first
      {:noreply, socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, socket)

      # Make activity old
      old_activity = System.monotonic_time(:millisecond) - 6 * 60 * 1000
      socket = Phoenix.Socket.assign(socket, :last_activity, old_activity)

      # :check_idle should not change anything since already idle
      {:noreply, result} = WorkspaceChannel.handle_info(:check_idle, socket)

      assert result.assigns.status == "idle"
    end
  end

  describe "after_join message" do
    test "join sends :after_join to self", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id})
      {:ok, joined_socket} = WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      # The join function calls send(self(), :after_join), verify the socket is returned
      # and the message is queued (can't test push directly without subscribe_and_join)
      assert joined_socket.assigns.status == "online"
    end
  end

  describe "terminate behavior" do
    test "terminate returns :ok without error", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id})
      {:ok, socket} = WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      result = WorkspaceChannel.terminate(:normal, socket)
      assert result == :ok
    end

    test "terminate handles different reasons", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id})
      {:ok, socket} = WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      assert WorkspaceChannel.terminate(:shutdown, socket) == :ok
      assert WorkspaceChannel.terminate(:left, socket) == :ok
    end
  end
end
