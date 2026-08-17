defmodule Presence.RedisPubSubTest do
  use ExUnit.Case, async: false

  alias Presence.RedisPubSub

  @moduletag :capture_log

  setup do
    original_url = Application.get_env(:presence, :redis_url)

    on_exit(fn ->
      if original_url do
        Application.put_env(:presence, :redis_url, original_url)
      else
        Application.delete_env(:presence, :redis_url)
      end
    end)

    :ok
  end

  describe "broadcast/2 when not configured" do
    @tag skip: "Redis is now mandatory - application will fail to start without it"
    test "returns error when URL is not configured" do
      # Redis is now mandatory, so this test is skipped
    end

    @tag skip: "Redis is now mandatory - application will fail to start without it"
    test "returns error when URL is empty string" do
      # Redis is now mandatory, so this test is skipped
    end
  end

  describe "subscribe/1" do
    test "returns not_supported status" do
      assert {:ok, :not_supported} = RedisPubSub.subscribe(["channel1", "channel2"])
    end

    test "returns not_supported for empty list" do
      assert {:ok, :not_supported} = RedisPubSub.subscribe([])
    end
  end

  describe "command/1 when not configured" do
    @tag skip: "Redis is now mandatory - application will fail to start without it"
    test "returns error when URL is not configured" do
      # Redis is now mandatory, so this test is skipped
    end
  end

  describe "broadcast/2 when configured" do
    @tag skip: "Connection-failure path can't be isolated: the pool binds to the real Redis at boot"
    test "returns error on Redis connection failure" do
      Application.put_env(:presence, :redis_url, "redis://localhost:1")

      assert {:error, :publish_failed} = RedisPubSub.broadcast("test_channel", %{data: "test"})
    end
  end

  describe "command/1 when configured" do
    @tag skip: "Connection-failure path can't be isolated: the pool binds to the real Redis at boot"
    test "returns error on Redis connection failure" do
      Application.put_env(:presence, :redis_url, "redis://localhost:1")

      assert {:error, :command_failed} = RedisPubSub.command(["GET", "key"])
    end
  end

  describe "edge cases" do
    @tag skip: "Redis is now mandatory - application will fail to start without it"
    test "handles empty channel name gracefully when not configured" do
      # Redis is now mandatory, so this test is skipped
    end

    @tag skip: "Redis is now mandatory - application will fail to start without it"
    test "handles empty payload gracefully when not configured" do
      # Redis is now mandatory, so this test is skipped
    end

    @tag skip: "Redis is now mandatory - application will fail to start without it"
    test "handles nested payload gracefully when not configured" do
      # Redis is now mandatory, so this test is skipped
    end

    @tag skip: "Redis is now mandatory - application will fail to start without it"
    test "handles unicode in payload gracefully when not configured" do
      # Redis is now mandatory, so this test is skipped
    end
  end

  describe "env_getter/1" do
    test "delegates to System.get_env/1" do
      # When REDIS_URL is set in .env.test
      assert Presence.RedisPubSub.env_getter("REDIS_URL") ==
               "redis://127.0.0.1:16379"

      # For non-existent variable
      assert Presence.RedisPubSub.env_getter("NON_EXISTENT_VAR_12345") == nil
    end
  end

  describe "broadcast/2 and command/1 with default env_getter" do
    @tag skip: "Connection-failure path can't be isolated: the pool binds to the real Redis at boot"
    test "uses System.get_env when Application env is not set" do
      # When Application env is cleared, it falls back to System env (from .env.test)
      # which causes a connection error since the server isn't running
      Application.delete_env(:presence, :redis_url)

      assert {:error, :publish_failed} = RedisPubSub.broadcast("test_channel", %{data: "test"})
      assert {:error, :command_failed} = RedisPubSub.command(["GET", "key"])
    end
  end
end
