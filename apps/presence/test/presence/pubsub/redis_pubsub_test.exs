defmodule Presence.RedisPubSubTest do
  use ExUnit.Case, async: false

  alias Presence.RedisPubSub

  @moduletag :capture_log

  setup do
    original_url = Application.get_env(:presence, :upstash_redis_rest_url)
    original_token = Application.get_env(:presence, :upstash_redis_rest_token)

    on_exit(fn ->
      if original_url do
        Application.put_env(:presence, :upstash_redis_rest_url, original_url)
      else
        Application.delete_env(:presence, :upstash_redis_rest_url)
      end

      if original_token do
        Application.put_env(:presence, :upstash_redis_rest_token, original_token)
      else
        Application.delete_env(:presence, :upstash_redis_rest_token)
      end
    end)

    :ok
  end

  describe "broadcast/2 when not configured" do
    test "returns error when URL is not configured" do
      Application.delete_env(:presence, :upstash_redis_rest_url)
      Application.delete_env(:presence, :upstash_redis_rest_token)

      assert {:error, :not_configured} = RedisPubSub.broadcast("test_channel", %{data: "test"})
    end

    test "returns error when URL is empty string" do
      Application.put_env(:presence, :upstash_redis_rest_url, "")
      Application.put_env(:presence, :upstash_redis_rest_token, "valid_token")

      assert {:error, :not_configured} = RedisPubSub.broadcast("test_channel", %{data: "test"})
    end

    test "returns error when token is empty string" do
      Application.put_env(:presence, :upstash_redis_rest_url, "https://example.com")
      Application.put_env(:presence, :upstash_redis_rest_token, "")

      assert {:error, :not_configured} = RedisPubSub.broadcast("test_channel", %{data: "test"})
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
    test "returns error when URL is not configured" do
      Application.delete_env(:presence, :upstash_redis_rest_url)
      Application.delete_env(:presence, :upstash_redis_rest_token)

      assert {:error, :not_configured} = RedisPubSub.command(["GET", "key"])
    end
  end

  describe "broadcast/2 when configured" do
    test "returns error on HTTP connection failure" do
      Application.put_env(:presence, :upstash_redis_rest_url, "http://localhost:1")
      Application.put_env(:presence, :upstash_redis_rest_token, "test-token")

      assert {:error, :http_error} = RedisPubSub.broadcast("test_channel", %{data: "test"})
    end
  end

  describe "command/1 when configured" do
    test "returns error on HTTP connection failure" do
      Application.put_env(:presence, :upstash_redis_rest_url, "http://localhost:1")
      Application.put_env(:presence, :upstash_redis_rest_token, "test-token")

      assert {:error, :http_error} = RedisPubSub.command(["GET", "key"])
    end
  end

  describe "broadcast/2 with Bypass" do
    test "successful broadcast with mock HTTP server" do
      bypass = Bypass.open()

      Bypass.expect(bypass, "POST", "/", fn conn ->
        conn
        |> Plug.Conn.put_resp_content_type("application/json")
        |> Plug.Conn.resp(200, Jason.encode!(["PUBLISH", 1]))
      end)

      Application.put_env(:presence, :upstash_redis_rest_url, "http://localhost:#{bypass.port}")
      Application.put_env(:presence, :upstash_redis_rest_token, "test-token")

      assert {:ok, body} = RedisPubSub.broadcast("test_channel", %{data: "test"})
      assert body == ["PUBLISH", 1]
    end

    test "handles Redis publish failure (non-200 status)" do
      bypass = Bypass.open()

      Bypass.expect(bypass, "POST", "/", fn conn ->
        Plug.Conn.resp(conn, 401, "Unauthorized")
      end)

      Application.put_env(:presence, :upstash_redis_rest_url, "http://localhost:#{bypass.port}")
      Application.put_env(:presence, :upstash_redis_rest_token, "test-token")

      assert {:error, :publish_failed} = RedisPubSub.broadcast("test_channel", %{data: "test"})
    end
  end

  describe "command/1 with Bypass" do
    test "successful command execution with mock HTTP server" do
      bypass = Bypass.open()

      Bypass.expect(bypass, "POST", "/", fn conn ->
        conn
        |> Plug.Conn.put_resp_content_type("application/json")
        |> Plug.Conn.resp(200, Jason.encode!(["GET", "value"]))
      end)

      Application.put_env(:presence, :upstash_redis_rest_url, "http://localhost:#{bypass.port}")
      Application.put_env(:presence, :upstash_redis_rest_token, "test-token")

      assert {:ok, body} = RedisPubSub.command(["GET", "key"])
      assert body == ["GET", "value"]
    end

    test "handles command failure (non-200 status)" do
      bypass = Bypass.open()

      Bypass.expect(bypass, "POST", "/", fn conn ->
        Plug.Conn.resp(conn, 500, "Internal Server Error")
      end)

      Application.put_env(:presence, :upstash_redis_rest_url, "http://localhost:#{bypass.port}")
      Application.put_env(:presence, :upstash_redis_rest_token, "test-token")

      assert {:error, :command_failed} = RedisPubSub.command(["GET", "key"])
    end
  end

  describe "edge cases" do
    test "handles empty channel name gracefully when not configured" do
      Application.delete_env(:presence, :upstash_redis_rest_url)
      Application.delete_env(:presence, :upstash_redis_rest_token)

      assert {:error, :not_configured} = RedisPubSub.broadcast("", %{data: "test"})
    end

    test "handles empty payload gracefully when not configured" do
      Application.delete_env(:presence, :upstash_redis_rest_url)
      Application.delete_env(:presence, :upstash_redis_rest_token)

      assert {:error, :not_configured} = RedisPubSub.broadcast("test_channel", %{})
    end

    test "handles nested payload gracefully when not configured" do
      Application.delete_env(:presence, :upstash_redis_rest_url)
      Application.delete_env(:presence, :upstash_redis_rest_token)

      payload = %{
        user: %{
          id: "user_123",
          profile: %{name: "Test User"}
        }
      }

      assert {:error, :not_configured} = RedisPubSub.broadcast("test_channel", payload)
    end

    test "handles unicode in payload gracefully when not configured" do
      Application.delete_env(:presence, :upstash_redis_rest_url)
      Application.delete_env(:presence, :upstash_redis_rest_token)

      payload = %{message: "Hello 世界 🌍", user: "用户名"}
      assert {:error, :not_configured} = RedisPubSub.broadcast("test_channel", payload)
    end
  end
end
