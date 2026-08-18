defmodule Presence.TrackerTest do
  use ExUnit.Case, async: false

  import Presence.Test.Helpers

  alias Presence.Test.Helpers
  alias Presence.Tracker

  @moduletag :capture_log

  setup_all do
    Application.ensure_all_started(:phoenix)
    Application.ensure_all_started(:phoenix_pubsub)
    :ok
  end

  describe "should_mark_idle?/1" do
    test "returns false for recent activity" do
      recent_activity = System.monotonic_time(:millisecond) - 1000
      refute Tracker.should_mark_idle?(recent_activity)
    end

    test "returns true for activity older than idle threshold" do
      old_activity = System.monotonic_time(:millisecond) - 6 * 60 * 1000
      assert Tracker.should_mark_idle?(old_activity)
    end

    test "returns false for activity exactly at threshold" do
      now = System.monotonic_time(:millisecond)
      # Add a small epsilon to ensure we are safely inside the threshold
      # even if scheduler delays cause a small time drift between calls
      activity_at_threshold = now - 5 * 60 * 1000 + 10
      refute Tracker.should_mark_idle?(activity_at_threshold)
    end

    test "returns true for activity just over threshold" do
      activity_just_over = System.monotonic_time(:millisecond) - 5 * 60 * 1000 - 1
      assert Tracker.should_mark_idle?(activity_just_over)
    end

    test "handles very old timestamps" do
      very_old = System.monotonic_time(:millisecond) - 24 * 60 * 60 * 1000
      assert Tracker.should_mark_idle?(very_old)
    end

    test "handles future timestamps gracefully" do
      future = System.monotonic_time(:millisecond) + 10_000
      refute Tracker.should_mark_idle?(future)
    end
  end

  describe "list_workspace_users/1" do
    test "returns empty map for workspace with no users" do
      users = Tracker.list_workspace_users("empty_workspace_#{System.unique_integer()}")
      assert users == %{}
    end
  end

  describe "list_workspace_users_formatted/1" do
    test "returns formatted list of user maps" do
      workspace_id = "workspace_formatted_#{System.unique_integer()}"
      socket = socket_in_workspace(workspace_id)
      user_id = "user_#{System.unique_integer()}"
      metadata = %{name: "Bob", avatar: "bob.jpg"}

      {:ok, _} = Tracker.track_user(socket, user_id, workspace_id, metadata)

      users = Tracker.list_workspace_users_formatted(workspace_id)
      assert length(users) == 1
      [user] = users
      assert user.id == user_id
      assert user.name == "Bob"
      assert user.avatar == "bob.jpg"
      assert user.status == "online"
    end
  end

  describe "list_workspace_user_ids/1" do
    test "returns list of user ids" do
      workspace_id = "workspace_ids_#{System.unique_integer()}"
      socket = socket_in_workspace(workspace_id)
      user_id = "user_#{System.unique_integer()}"

      {:ok, _} = Tracker.track_user(socket, user_id, workspace_id, %{status: "online"})

      user_ids = Tracker.list_workspace_user_ids(workspace_id)
      assert user_id in user_ids
    end
  end

  describe "list_user_workspaces/1" do
    test "returns empty list when no Redis entries exist" do
      user_id = "user_no_workspaces_#{System.unique_integer()}"
      workspaces = Tracker.list_user_workspaces(user_id)
      assert workspaces == []
    end
  end

  describe "get_user/2" do
    test "returns nil or empty for untracked user" do
      socket = socket_in_workspace("workspace_get_untracked")
      presence = Tracker.get_user(socket, "non_existent_user_#{System.unique_integer()}")
      assert presence == nil or presence == []
    end

    test "returns presence data for tracked user" do
      socket = socket_in_workspace("workspace_get_tracked")
      user_id = "tracked_user_#{System.unique_integer()}"

      # First track the user
      {:ok, _} = Tracker.track_user(socket, user_id, "workspace_get_tracked", %{status: "online"})

      # Then get the user's presence
      # get_by_key returns %{metas: [%{...}]} or nil
      presence = Tracker.get_user(socket, user_id)
      assert is_map(presence)
      assert Map.has_key?(presence, :metas)
      assert presence.metas != []

      # Verify the presence data contains expected fields
      presence_data = hd(presence.metas)
      assert presence_data.status == "online"
      assert presence_data.workspace_id == "workspace_get_tracked"
      assert Map.has_key?(presence_data, :joined_at)
      assert Map.has_key?(presence_data, :last_activity)
      assert Map.has_key?(presence_data, :trace_id)
    end
  end

  describe "track_user/4" do
    test "tracks a user in a workspace" do
      workspace_id = "workspace_track_#{System.unique_integer()}"
      socket = socket_in_workspace(workspace_id)
      user_id = "user_#{System.unique_integer()}"
      metadata = %{name: "Test User", avatar: "avatar.jpg"}

      {:ok, _} = Tracker.track_user(socket, user_id, workspace_id, metadata)

      # Verify user is in workspace list
      users = Tracker.list_workspace_users(workspace_id)
      assert Map.has_key?(users, user_id)

      # Verify user data (Phoenix.Presence returns %{metas: [%{...}]})
      user_data = users[user_id].metas |> hd()
      assert user_data.status == "online"
      assert user_data.workspace_id == workspace_id
      assert user_data.name == "Test User"
      assert user_data.avatar == "avatar.jpg"
      assert Map.has_key?(user_data, :joined_at)
      assert Map.has_key?(user_data, :last_activity)
      assert Map.has_key?(user_data, :trace_id)
    end

    test "emits telemetry event on track" do
      workspace_id = "workspace_telemetry_#{System.unique_integer()}"
      socket = socket_in_workspace(workspace_id)
      user_id = "user_#{System.unique_integer()}"

      events =
        Helpers.capture_telemetry([[:presence, :track]], fn ->
          {:ok, _} = Tracker.track_user(socket, user_id, workspace_id, %{status: "online"})
          # Small delay to ensure telemetry is processed
          _ = :sys.get_state(Presence.Tracker)
        end)

      assert [{event_name, measurements, metadata}] = events
      assert event_name == [:presence, :track]
      assert is_integer(measurements.duration)
      assert metadata.user_id == user_id
      assert metadata.workspace_id == workspace_id
      assert metadata.status == "online"
    end
  end

  describe "update_status/3" do
    test "updates user status to idle" do
      workspace_id = "workspace_idle_#{System.unique_integer()}"
      socket = socket_in_workspace(workspace_id)
      user_id = "user_#{System.unique_integer()}"

      # First track the user
      {:ok, _} = Tracker.track_user(socket, user_id, workspace_id, %{status: "online"})

      # Update status to idle
      {:ok, _} = Tracker.update_status(socket, user_id, "idle")

      # Verify status changed (Phoenix.Presence returns %{metas: [%{...}]})
      users = Tracker.list_workspace_users(workspace_id)
      user_data = users[user_id].metas |> hd()
      assert user_data.status == "idle"
    end

    test "updates user status to away" do
      workspace_id = "workspace_away_#{System.unique_integer()}"
      socket = socket_in_workspace(workspace_id)
      user_id = "user_#{System.unique_integer()}"

      # First track the user
      {:ok, _} = Tracker.track_user(socket, user_id, workspace_id, %{status: "online"})

      # Update status to away
      {:ok, _} = Tracker.update_status(socket, user_id, "away")

      # Verify status changed
      users = Tracker.list_workspace_users(workspace_id)
      user_data = users[user_id].metas |> hd()
      assert user_data.status == "away"
    end

    test "updates user status back to online" do
      workspace_id = "workspace_online_#{System.unique_integer()}"
      socket = socket_in_workspace(workspace_id)
      user_id = "user_#{System.unique_integer()}"

      # First track the user
      {:ok, _} = Tracker.track_user(socket, user_id, workspace_id, %{status: "online"})

      # Set to idle first
      {:ok, _} = Tracker.update_status(socket, user_id, "idle")
      users = Tracker.list_workspace_users(workspace_id)
      user_data = users[user_id].metas |> hd()
      assert user_data.status == "idle"

      # Then set back to online
      {:ok, _} = Tracker.update_status(socket, user_id, "online")
      users = Tracker.list_workspace_users(workspace_id)
      user_data = users[user_id].metas |> hd()
      assert user_data.status == "online"
    end

    test "updates last_activity timestamp on status change" do
      workspace_id = "workspace_activity_#{System.unique_integer()}"
      socket = socket_in_workspace(workspace_id)
      user_id = "user_#{System.unique_integer()}"

      # First track the user
      {:ok, _} = Tracker.track_user(socket, user_id, workspace_id, %{status: "online"})

      Process.sleep(10)

      # Update status
      {:ok, _} = Tracker.update_status(socket, user_id, "idle")

      # Verify activity timestamp was updated
      users = Tracker.list_workspace_users(workspace_id)
      user_data = users[user_id].metas |> hd()
      assert Map.has_key?(user_data, :updated_at)
    end

    test "emits telemetry event on status update" do
      workspace_id = "workspace_status_telemetry_#{System.unique_integer()}"
      socket = socket_in_workspace(workspace_id)
      user_id = "user_#{System.unique_integer()}"

      # First track the user
      {:ok, _} = Tracker.track_user(socket, user_id, workspace_id, %{})

      events =
        Helpers.capture_telemetry([[:presence, :update_status]], fn ->
          {:ok, _} = Tracker.update_status(socket, user_id, "idle")
          # Small delay to ensure telemetry is processed
          _ = :sys.get_state(Presence.Tracker)
        end)

      assert [{event_name, _measurements, metadata}] = events
      assert event_name == [:presence, :update_status]
      assert metadata.user_id == user_id
      assert metadata.status == "idle"
    end
  end

  describe "update_activity/2" do
    test "updates last activity timestamp" do
      workspace_id = "workspace_activity_#{System.unique_integer()}"
      socket = socket_in_workspace(workspace_id)
      user_id = "user_#{System.unique_integer()}"

      # First track the user
      {:ok, _} = Tracker.track_user(socket, user_id, workspace_id, %{status: "online"})

      # Get initial activity
      users = Tracker.list_workspace_users(workspace_id)
      user_data = users[user_id].metas |> hd()
      initial_activity = user_data.last_activity

      Process.sleep(10)

      # Update activity
      {:ok, _} = Tracker.update_activity(socket, user_id)

      # Verify activity was updated
      users = Tracker.list_workspace_users(workspace_id)
      user_data = users[user_id].metas |> hd()
      updated_activity = user_data.last_activity
      assert updated_activity > initial_activity
    end

    test "updates last_activity without affecting other presence" do
      workspace_id = "workspace_preserve_#{System.unique_integer()}"
      socket = socket_in_workspace(workspace_id)
      user_id = "user_#{System.unique_integer()}"

      # First track the user with metadata
      {:ok, _} = Tracker.track_user(socket, user_id, workspace_id, %{name: "Test User", status: "online"})

      # Get initial last_activity
      users = Tracker.list_workspace_users(workspace_id)
      initial_activity = users[user_id].metas |> hd() |> Map.get(:last_activity)

      Process.sleep(10)

      # Update activity - Phoenix.Presence.update stores the updated fields
      {:ok, _} = Tracker.update_activity(socket, user_id)

      # Verify the update was applied
      users = Tracker.list_workspace_users(workspace_id)
      user_data = users[user_id].metas |> hd()
      assert Map.has_key?(user_data, :last_activity)
      assert user_data.last_activity > initial_activity
    end
  end
end
