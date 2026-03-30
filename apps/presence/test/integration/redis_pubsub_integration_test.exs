defmodule Presence.RedisPubSubIntegrationTest do
  use ExUnit.Case, async: false

  alias Presence.RedisPubSub

  @moduletag :capture_log

  describe "broadcast/2" do
    test "returns not_configured when Redis URL is not set" do
      # Ensure Redis is not configured
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

      # Cleanup
      Application.delete_env(:presence, :upstash_redis_rest_url)
      Application.delete_env(:presence, :upstash_redis_rest_token)
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
