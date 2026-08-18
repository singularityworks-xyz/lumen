defmodule Presence.PresenceSetsTest do
  use ExUnit.Case, async: false

  alias Presence.PresenceSets
  alias Presence.Test.FailingRedisRunner
  alias Presence.Test.FakeRedis

  setup do
    start_supervised!(FakeRedis)
    Application.put_env(:presence, :redis_command_runner, FakeRedis)

    on_exit(fn ->
      Application.delete_env(:presence, :redis_command_runner)
    end)

    :ok
  end

  describe "user_joined/2" do
    test "increments the channel counter and adds both set memberships" do
      user_id = "user_joined_#{System.unique_integer()}"
      workspace_id = "ws_joined_#{System.unique_integer()}"
      count_key = PresenceSets.channel_count_key(user_id, workspace_id)

      assert PresenceSets.user_joined(user_id, workspace_id) == :ok
      assert FakeRedis.counter(count_key) == 1
      assert user_id in FakeRedis.set_members(PresenceSets.workspace_users_key(workspace_id))
      assert workspace_id in FakeRedis.set_members(PresenceSets.user_workspaces_key(user_id))

      # A second channel for the same user/workspace bumps the counter but
      # keeps set membership idempotent.
      assert PresenceSets.user_joined(user_id, workspace_id) == :ok
      assert FakeRedis.counter(count_key) == 2
    end
  end

  describe "user_left/2" do
    test "retains membership until the final channel terminates" do
      user_id = "user_left_#{System.unique_integer()}"
      workspace_id = "ws_left_#{System.unique_integer()}"
      count_key = PresenceSets.channel_count_key(user_id, workspace_id)

      PresenceSets.user_joined(user_id, workspace_id)
      PresenceSets.user_joined(user_id, workspace_id)

      assert PresenceSets.user_left(user_id, workspace_id) == :retained
      assert FakeRedis.counter(count_key) == 1
      assert user_id in FakeRedis.set_members(PresenceSets.workspace_users_key(workspace_id))
      assert workspace_id in FakeRedis.set_members(PresenceSets.user_workspaces_key(user_id))

      assert PresenceSets.user_left(user_id, workspace_id) == :removed
      assert FakeRedis.counter(count_key) == 0
      refute user_id in FakeRedis.set_members(PresenceSets.workspace_users_key(workspace_id))
      refute workspace_id in FakeRedis.set_members(PresenceSets.user_workspaces_key(user_id))
    end

    test "treats a stale counter as the final channel and cleans up" do
      user_id = "user_stale_#{System.unique_integer()}"
      workspace_id = "ws_stale_#{System.unique_integer()}"

      PresenceSets.user_joined(user_id, workspace_id)

      # Simulate a counter that drifted out of sync (e.g. a crashed process
      # that skipped terminate): the DECR goes non-positive and the set
      # memberships are cleaned up.
      FakeRedis.clear_log()
      assert PresenceSets.user_left(user_id, workspace_id) == :removed
      refute user_id in FakeRedis.set_members(PresenceSets.workspace_users_key(workspace_id))
      refute workspace_id in FakeRedis.set_members(PresenceSets.user_workspaces_key(user_id))
    end
  end

  describe "when Redis is unavailable" do
    setup do
      Application.put_env(:presence, :redis_command_runner, FailingRedisRunner)

      on_exit(fn ->
        Application.put_env(:presence, :redis_command_runner, FakeRedis)
      end)

      :ok
    end

    test "join and leave degrade gracefully" do
      user_id = "user_no_redis_#{System.unique_integer()}"
      workspace_id = "ws_no_redis_#{System.unique_integer()}"

      assert PresenceSets.user_joined(user_id, workspace_id) == :ok
      assert PresenceSets.user_left(user_id, workspace_id) == :retained
    end
  end
end
