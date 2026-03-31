defmodule Presence.RedisPubSubIntegrationTest do
  use ExUnit.Case, async: false

  alias Presence.RedisPubSub

  @moduletag :capture_log

  setup do
    orig_app_url = Application.get_env(:presence, :upstash_redis_rest_url)
    orig_app_token = Application.get_env(:presence, :upstash_redis_rest_token)
    orig_sys_url = System.get_env("UPSTASH_REDIS_REST_URL")
    orig_sys_token = System.get_env("UPSTASH_REDIS_REST_TOKEN")

    on_exit(fn ->
      if orig_app_url != nil do
        Application.put_env(:presence, :upstash_redis_rest_url, orig_app_url)
      else
        Application.delete_env(:presence, :upstash_redis_rest_url)
      end

      if orig_app_token != nil do
        Application.put_env(:presence, :upstash_redis_rest_token, orig_app_token)
      else
        Application.delete_env(:presence, :upstash_redis_rest_token)
      end

      if orig_sys_url != nil do
        System.put_env("UPSTASH_REDIS_REST_URL", orig_sys_url)
      else
        System.delete_env("UPSTASH_REDIS_REST_URL")
      end

      if orig_sys_token != nil do
        System.put_env("UPSTASH_REDIS_REST_TOKEN", orig_sys_token)
      else
        System.delete_env("UPSTASH_REDIS_REST_TOKEN")
      end
    end)

    :ok
  end

  describe "broadcast/2" do
    test "returns not_configured when Redis URL is not set" do
      Application.delete_env(:presence, :upstash_redis_rest_url)
      Application.delete_env(:presence, :upstash_redis_rest_token)
      System.delete_env("UPSTASH_REDIS_REST_URL")
      System.delete_env("UPSTASH_REDIS_REST_TOKEN")

      result =
        RedisPubSub.broadcast("presence:user_joined", %{
          workspace_id: "ws-1",
          user_id: "user-1"
        })

      assert result == {:error, :not_configured}
    end

    test "returns not_configured with empty credentials" do
      Application.put_env(:presence, :upstash_redis_rest_url, "")
      Application.put_env(:presence, :upstash_redis_rest_token, "")

      result =
        RedisPubSub.broadcast("presence:user_joined", %{
          workspace_id: "ws-1",
          user_id: "user-1"
        })

      assert result == {:error, :not_configured}
    end
  end

  describe "subscribe/1" do
    test "returns not_supported for REST API" do
      result = RedisPubSub.subscribe(["presence:user_joined"])
      assert result == {:ok, :not_supported}
    end
  end

  describe "command/1" do
    test "returns not_configured when Redis is not set up" do
      Application.delete_env(:presence, :upstash_redis_rest_url)
      Application.delete_env(:presence, :upstash_redis_rest_token)
      System.delete_env("UPSTASH_REDIS_REST_URL")
      System.delete_env("UPSTASH_REDIS_REST_TOKEN")

      result = RedisPubSub.command(["PING"])
      assert result == {:error, :not_configured}
    end
  end
end
