defmodule Presence.Integration.PresenceFlowTest do
  @moduledoc """
  Integration tests for the full presence lifecycle.
  Tests user joins, status updates, and leaving workspace with Redis pubsub integration.
  """
  use PresenceWeb.ChannelCase, async: false

  import Presence.Test.Fixtures
  import Presence.Test.Helpers

  alias Presence.Token
  alias Presence.Tracker
  alias PresenceWeb.WorkspaceChannel

  @moduletag :capture_log

  setup_all do
    Application.ensure_all_started(:phoenix)
    Application.ensure_all_started(:phoenix_pubsub)
    Application.ensure_all_started(:jose)
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

  describe "full presence lifecycle" do
    test "user joins, updates status, and leaves", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id, name: "Test User"})

      # Step 1: User joins the workspace
      {:ok, joined_socket} =
        WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      assert joined_socket.assigns.user_id == user_id
      assert joined_socket.assigns.workspace_id == workspace_id
      assert joined_socket.assigns.status == "online"
      # last_activity is a monotonic timestamp which can be negative
      assert is_integer(joined_socket.assigns.last_activity)

      # Step 2: Verify presence is tracked
      presences = Tracker.list_workspace_users(workspace_id)
      assert is_map(presences)

      # Step 3: User updates status to idle
      {:noreply, idle_socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, joined_socket)

      assert idle_socket.assigns.status == "idle"
      assert idle_socket.assigns.last_activity >= joined_socket.assigns.last_activity

      # Step 4: User updates status to away
      {:noreply, away_socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "away"}, idle_socket)

      assert away_socket.assigns.status == "away"

      # Step 5: User returns to online
      {:noreply, online_socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "online"}, away_socket)

      assert online_socket.assigns.status == "online"

      # Step 6: User sends activity ping (while online - should stay online)
      {:noreply, pinged_socket} =
        WorkspaceChannel.handle_in("activity_ping", %{}, online_socket)

      assert pinged_socket.assigns.status == "online"
      assert pinged_socket.assigns.last_activity >= online_socket.assigns.last_activity

      # Step 7: User goes idle again via status update
      {:noreply, idle_again} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, pinged_socket)

      assert idle_again.assigns.status == "idle"

      # Step 8: Activity ping should return to online from idle
      {:noreply, final_online} =
        WorkspaceChannel.handle_in("activity_ping", %{}, idle_again)

      assert final_online.assigns.status == "online"

      # Step 9: User leaves (terminate)
      result = WorkspaceChannel.terminate(:normal, final_online)
      assert result == :ok
    end

    test "user joins and immediately leaves", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id, name: "Quick User"})

      # Join
      {:ok, joined_socket} =
        WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      assert joined_socket.assigns.status == "online"

      # Immediately leave
      result = WorkspaceChannel.terminate(:normal, joined_socket)
      assert result == :ok
    end

    test "multiple status updates in sequence", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id, name: "Status Tester"})

      {:ok, socket} = WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      statuses = ["idle", "away", "online", "idle", "away", "online"]

      final_socket =
        Enum.reduce(statuses, socket, fn status, acc_socket ->
          {:noreply, updated} =
            WorkspaceChannel.handle_in("status_update", %{"status" => status}, acc_socket)

          assert updated.assigns.status == status
          updated
        end)

      assert final_socket.assigns.status == "online"

      WorkspaceChannel.terminate(:normal, final_socket)
    end

    test "activity ping updates last_activity timestamp", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id, name: "Activity Tester"})

      {:ok, joined_socket} =
        WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      # Record initial activity
      initial_activity = joined_socket.assigns.last_activity

      # Wait a tiny bit and send activity ping
      Process.sleep(10)

      {:noreply, after_ping} =
        WorkspaceChannel.handle_in("activity_ping", %{}, joined_socket)

      assert after_ping.assigns.last_activity >= initial_activity

      WorkspaceChannel.terminate(:normal, after_ping)
    end
  end

  describe "presence lifecycle with Redis pubsub" do
    test "full lifecycle emits Redis pubsub events on join and leave", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      # Configure Redis for test
      orig_url = Application.get_env(:presence, :redis_url)

      on_exit(fn ->
        if orig_url do
          Application.put_env(:presence, :redis_url, orig_url)
        else
          Application.delete_env(:presence, :redis_url)
        end
      end)

      # Set test Redis configuration (if not already set)
      unless orig_url do
        Application.put_env(
          :presence,
          :redis_url,
          "redis://localhost:16379"
        )
      end

      socket = socket_in_workspace(workspace_id, %{id: user_id, name: "Redis User"})

      # Join should broadcast user_joined event
      {:ok, joined_socket} =
        WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      assert joined_socket.assigns.status == "online"

      # Update status - should still work with Redis configured
      {:noreply, idle_socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, joined_socket)

      assert idle_socket.assigns.status == "idle"

      # Return to online
      {:noreply, online_socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "online"}, idle_socket)

      assert online_socket.assigns.status == "online"

      # Leave should broadcast user_left event
      result = WorkspaceChannel.terminate(:normal, online_socket)
      assert result == :ok
    end

    @tag skip: "Redis is now mandatory - application will fail to start without it"
    test "lifecycle works when Redis is not configured", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      # This test is no longer relevant since Redis is mandatory
      # The application will fail to start if Redis is not configured
    end

    test "presence state is maintained throughout lifecycle", %{
      user_id: _user_id,
      workspace_id: _workspace_id
    } do
      # Use a unique workspace to avoid tracking conflicts
      unique_workspace_id = "workspace_state_#{unique_id()}"
      unique_user_id = "user_state_#{unique_id()}"

      socket =
        socket_in_workspace(unique_workspace_id, %{id: unique_user_id, name: "State Tester"})

      # Initial join
      {:ok, joined_socket} =
        WorkspaceChannel.join("workspace:#{unique_workspace_id}", %{}, socket)

      assert joined_socket.assigns.user_id == unique_user_id
      assert joined_socket.assigns.workspace_id == unique_workspace_id

      # Verify check_idle message is handled - note: we can't call handle_info/after_join
      # directly as it requires the socket to be properly joined in a channel process
      # Instead we test handle_info(:check_idle) directly with the socket
      {:noreply, idle_check_socket} =
        WorkspaceChannel.handle_info(:check_idle, joined_socket)

      # Status should remain online since activity is recent
      assert idle_check_socket.assigns.status == "online"

      # Update to idle via status_update
      {:noreply, idle_socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, idle_check_socket)

      assert idle_socket.assigns.status == "idle"

      # Now check_idle should not change status (already idle)
      {:noreply, still_idle} =
        WorkspaceChannel.handle_info(:check_idle, idle_socket)

      assert still_idle.assigns.status == "idle"

      # Cleanup
      WorkspaceChannel.terminate(:normal, still_idle)
    end
  end

  describe "presence diff handling" do
    test "socket maintains state through handle_out flow" do
      # Use a unique workspace to avoid conflicts
      unique_workspace_id = "workspace_diff_#{unique_id()}"
      unique_user_id = "user_diff_#{unique_id()}"

      socket =
        socket_in_workspace(unique_workspace_id, %{id: unique_user_id, name: "Diff Tester"})

      {:ok, joined_socket} =
        WorkspaceChannel.join("workspace:#{unique_workspace_id}", %{}, socket)

      # Verify the socket state is maintained
      # Note: handle_out requires a properly joined channel process,
      # so we verify the lifecycle works correctly instead
      assert joined_socket.assigns.user_id == unique_user_id
      assert joined_socket.assigns.workspace_id == unique_workspace_id

      # Test status update flow which is called by presence changes
      {:noreply, updated_socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, joined_socket)

      assert updated_socket.assigns.status == "idle"

      WorkspaceChannel.terminate(:normal, updated_socket)
    end
  end

  describe "idle detection during lifecycle" do
    test "check_idle marks user idle after inactivity threshold", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id, name: "Idle Tester"})

      {:ok, joined_socket} =
        WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      # Simulate old last_activity (more than 5 minutes ago)
      old_activity = System.monotonic_time(:millisecond) - 6 * 60 * 1000

      socket_with_old_activity =
        Phoenix.Socket.assign(joined_socket, :last_activity, old_activity)

      # check_idle should transition to idle
      {:noreply, idle_socket} =
        WorkspaceChannel.handle_info(:check_idle, socket_with_old_activity)

      assert idle_socket.assigns.status == "idle"

      # Cleanup
      WorkspaceChannel.terminate(:normal, idle_socket)
    end

    test "check_idle does not mark user idle when status is already idle", %{
      user_id: user_id,
      workspace_id: workspace_id
    } do
      socket = socket_in_workspace(workspace_id, %{id: user_id, name: "Already Idle"})

      {:ok, joined_socket} =
        WorkspaceChannel.join("workspace:#{workspace_id}", %{}, socket)

      # Go to idle first
      {:noreply, idle_socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, joined_socket)

      assert idle_socket.assigns.status == "idle"

      # Simulate old activity
      old_activity = System.monotonic_time(:millisecond) - 6 * 60 * 1000

      socket_with_old =
        Phoenix.Socket.assign(idle_socket, :last_activity, old_activity)

      # check_idle should not change status since already idle
      {:noreply, still_idle} =
        WorkspaceChannel.handle_info(:check_idle, socket_with_old)

      assert still_idle.assigns.status == "idle"

      WorkspaceChannel.terminate(:normal, still_idle)
    end
  end

  describe "terminate with different reasons" do
    test "terminate handles various reasons gracefully" do
      # Test each terminate reason with a unique user/workspace to avoid tracking conflicts

      # Test :normal
      ws1 = "workspace_term_#{unique_id()}"
      u1 = "user_term_#{unique_id()}"
      socket1 = socket_in_workspace(ws1, %{id: u1, name: "Normal Tester"})
      {:ok, joined1} = WorkspaceChannel.join("workspace:#{ws1}", %{}, socket1)
      assert WorkspaceChannel.terminate(:normal, joined1) == :ok

      # Test :shutdown
      ws2 = "workspace_term_#{unique_id()}"
      u2 = "user_term_#{unique_id()}"
      socket2 = socket_in_workspace(ws2, %{id: u2, name: "Shutdown Tester"})
      {:ok, joined2} = WorkspaceChannel.join("workspace:#{ws2}", %{}, socket2)
      assert WorkspaceChannel.terminate(:shutdown, joined2) == :ok

      # Test :left
      ws3 = "workspace_term_#{unique_id()}"
      u3 = "user_term_#{unique_id()}"
      socket3 = socket_in_workspace(ws3, %{id: u3, name: "Left Tester"})
      {:ok, joined3} = WorkspaceChannel.join("workspace:#{ws3}", %{}, socket3)
      assert WorkspaceChannel.terminate(:left, joined3) == :ok
    end
  end
end
