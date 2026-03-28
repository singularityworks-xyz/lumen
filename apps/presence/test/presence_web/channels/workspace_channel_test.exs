defmodule PresenceWeb.WorkspaceChannelTest do
  use ExUnit.Case, async: false

  import Presence.Test.Helpers

  alias PresenceWeb.WorkspaceChannel

  @moduletag :capture_log

  setup_all do
    Application.ensure_all_started(:phoenix)
    Application.ensure_all_started(:phoenix_pubsub)
    :ok
  end

  describe "join/3" do
    test "accepts join with valid workspace_id" do
      socket = socket_in_workspace("workspace_test")

      result = WorkspaceChannel.join("workspace:workspace_test", %{}, socket)

      assert match?({:ok, _socket}, result)
    end

    test "assigns workspace_id after join" do
      socket = socket_in_workspace("workspace_assign_test")

      {:ok, joined_socket} = WorkspaceChannel.join("workspace:workspace_assign_test", %{}, socket)

      assert joined_socket.assigns.workspace_id == "workspace_assign_test"
    end

    test "sets initial status to online" do
      socket = socket_in_workspace("workspace_status_test")

      {:ok, joined_socket} = WorkspaceChannel.join("workspace:workspace_status_test", %{}, socket)

      assert joined_socket.assigns.status == "online"
    end

    test "assigns last_activity timestamp" do
      socket = socket_in_workspace("workspace_activity_test")

      before_join = System.monotonic_time(:millisecond)

      {:ok, joined_socket} =
        WorkspaceChannel.join("workspace:workspace_activity_test", %{}, socket)

      after_join = System.monotonic_time(:millisecond)

      assert joined_socket.assigns.last_activity >= before_join
      assert joined_socket.assigns.last_activity <= after_join
    end

    test "assigns user_id from socket" do
      socket = socket_in_workspace("workspace_user_test", %{id: "user_123"})

      {:ok, joined_socket} = WorkspaceChannel.join("workspace:workspace_user_test", %{}, socket)

      assert joined_socket.assigns.user_id == "user_123"
    end
  end

  describe "handle_in status_update" do
    test "handles status_update to idle" do
      socket = socket_in_workspace("workspace_status_update")
      {:ok, socket} = WorkspaceChannel.join("workspace:workspace_status_update", %{}, socket)

      result = WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, socket)

      assert match?({:noreply, _socket}, result)
    end

    test "handles status_update to away" do
      socket = socket_in_workspace("workspace_away_test")
      {:ok, socket} = WorkspaceChannel.join("workspace:workspace_away_test", %{}, socket)

      result = WorkspaceChannel.handle_in("status_update", %{"status" => "away"}, socket)

      assert match?({:noreply, _socket}, result)
    end

    test "handles status_update back to online" do
      socket = socket_in_workspace("workspace_online_test")
      {:ok, socket} = WorkspaceChannel.join("workspace:workspace_online_test", %{}, socket)

      {:noreply, socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, socket)

      result = WorkspaceChannel.handle_in("status_update", %{"status" => "online"}, socket)

      assert match?({:noreply, _socket}, result)
    end

    test "updates socket status after status_update" do
      socket = socket_in_workspace("workspace_status_check")
      {:ok, socket} = WorkspaceChannel.join("workspace:workspace_status_check", %{}, socket)

      {:noreply, updated_socket} =
        WorkspaceChannel.handle_in("status_update", %{"status" => "idle"}, socket)

      assert updated_socket.assigns.status == "idle"
    end
  end

  describe "handle_in activity_ping" do
    test "handles activity_ping" do
      socket = socket_in_workspace("workspace_ping_test")
      {:ok, socket} = WorkspaceChannel.join("workspace:workspace_ping_test", %{}, socket)

      result = WorkspaceChannel.handle_in("activity_ping", %{}, socket)

      assert match?({:noreply, _socket}, result)
    end

    test "handles activity_ping with payload" do
      socket = socket_in_workspace("workspace_ping_payload_test")
      {:ok, socket} = WorkspaceChannel.join("workspace:workspace_ping_payload_test", %{}, socket)

      result =
        WorkspaceChannel.handle_in(
          "activity_ping",
          %{"timestamp" => System.system_time(:second)},
          socket
        )

      assert match?({:noreply, _socket}, result)
    end

    test "updates last_activity on activity_ping" do
      socket = socket_in_workspace("workspace_activity_ping_test")
      {:ok, socket} = WorkspaceChannel.join("workspace:workspace_activity_ping_test", %{}, socket)

      original_activity = socket.assigns.last_activity
      Process.sleep(10)

      {:noreply, updated_socket} = WorkspaceChannel.handle_in("activity_ping", %{}, socket)

      assert updated_socket.assigns.last_activity > original_activity
    end
  end

  describe "terminate/2" do
    test "handles terminate without error" do
      socket = socket_in_workspace("workspace_terminate_test")
      {:ok, socket} = WorkspaceChannel.join("workspace:workspace_terminate_test", %{}, socket)

      result = WorkspaceChannel.terminate(:normal, socket)

      assert result == :ok
    end
  end
end
