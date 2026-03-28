defmodule Presence.TrackerTest do
  use ExUnit.Case, async: false

  import Presence.Test.Helpers

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
      activity_at_threshold = System.monotonic_time(:millisecond) - 5 * 60 * 1000
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

  describe "get_user/2" do
    test "returns nil or empty for untracked user" do
      socket = socket_in_workspace("workspace_get_untracked")
      presence = Tracker.get_user(socket, "non_existent_user_#{System.unique_integer()}")
      assert presence == nil or presence == []
    end
  end
end
