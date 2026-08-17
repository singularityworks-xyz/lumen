defmodule Presence.RedisPubSubIntegrationTest do
  use ExUnit.Case, async: false

  alias Presence.RedisPubSub

  @moduletag :capture_log

  setup do
    orig_app_url = Application.get_env(:presence, :redis_url)
    orig_sys_url = System.get_env("REDIS_URL")

    on_exit(fn ->
      if orig_app_url != nil do
        Application.put_env(:presence, :redis_url, orig_app_url)
      else
        Application.delete_env(:presence, :redis_url)
      end

      if orig_sys_url != nil do
        System.put_env("REDIS_URL", orig_sys_url)
      else
        System.delete_env("REDIS_URL")
      end
    end)

    :ok
  end

  describe "broadcast/2" do
    @tag skip: "Redis is now mandatory - application will fail to start without it"
    test "returns not_configured when Redis URL is not set" do
      # Redis is now mandatory, so this test is skipped
    end

    @tag skip: "Redis is now mandatory - application will fail to start without it"
    test "returns not_configured with empty credentials" do
      # Redis is now mandatory, so this test is skipped
    end
  end

  describe "subscribe/1" do
    test "returns not_supported for REST API" do
      result = RedisPubSub.subscribe(["presence:user_joined"])
      assert result == {:ok, :not_supported}
    end
  end

  describe "command/1" do
    @tag skip: "Redis is now mandatory - application will fail to start without it"
    test "returns not_configured when Redis is not set up" do
      # Redis is now mandatory, so this test is skipped
    end
  end
end
