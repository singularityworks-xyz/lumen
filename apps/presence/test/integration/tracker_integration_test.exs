defmodule Presence.TrackerIntegrationTest do
  use PresenceWeb.ChannelCase, async: false

  alias Presence.Tracker

  @moduletag :capture_log

  setup_all do
    Application.ensure_all_started(:phoenix)
    Application.ensure_all_started(:phoenix_pubsub)
    :ok
  end

  describe "should_mark_idle? with various timestamps" do
    test "returns true for activity older than 5 minutes" do
      old_activity = System.monotonic_time(:millisecond) - 6 * 60 * 1000
      assert Tracker.should_mark_idle?(old_activity) == true
    end

    test "returns false for recent activity (30s ago)" do
      recent_activity = System.monotonic_time(:millisecond) - 30_000
      assert Tracker.should_mark_idle?(recent_activity) == false
    end

    test "returns false for current activity" do
      now = System.monotonic_time(:millisecond)
      assert Tracker.should_mark_idle?(now) == false
    end

    test "returns true at exactly threshold + 1s" do
      threshold_activity = System.monotonic_time(:millisecond) - 5 * 60 * 1000 - 1_000
      assert Tracker.should_mark_idle?(threshold_activity) == true
    end

    test "returns false at exactly threshold - 1s" do
      threshold_activity = System.monotonic_time(:millisecond) - 5 * 60 * 1000 + 1_000
      assert Tracker.should_mark_idle?(threshold_activity) == false
    end

    test "returns false for 4 minutes 59 seconds ago" do
      almost_idle = System.monotonic_time(:millisecond) - (4 * 60 + 59) * 1000
      assert Tracker.should_mark_idle?(almost_idle) == false
    end

    test "returns true for 5 minutes 1 second ago" do
      just_idle = System.monotonic_time(:millisecond) - (5 * 60 + 1) * 1000
      assert Tracker.should_mark_idle?(just_idle) == true
    end
  end

  describe "list_workspace_users with no tracked users" do
    test "returns empty map for workspace with no users" do
      presences = Tracker.list("workspace:nonexistent_workspace")
      assert presences == %{}
    end

    test "returns empty map for empty workspace_id" do
      presences = Tracker.list("workspace:")
      assert is_map(presences)
    end
  end

  describe "Tracker module is properly initialized" do
    test "Tracker module is loaded and functional" do
      assert {:module, Presence.Tracker} = Code.ensure_loaded(Presence.Tracker)
    end

    test "list_workspace_users returns a map" do
      result = Tracker.list_workspace_users("workspace:test_init")
      assert is_map(result)
    end
  end
end
