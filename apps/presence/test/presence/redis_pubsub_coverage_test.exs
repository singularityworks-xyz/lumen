defmodule Presence.RedisPubSubCoverageTest do
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

  describe "broadcast/2 success path with Bypass" do
    test "returns {:ok, body} on successful PUBLISH (200)" do
      bypass = Bypass.open()

      Bypass.expect(bypass, "POST", "/", fn conn ->
        conn
        |> Plug.Conn.put_resp_content_type("application/json")
        |> Plug.Conn.resp(200, Jason.encode!(["PUBLISH", 1]))
      end)

      Application.put_env(:presence, :upstash_redis_rest_url, "http://localhost:#{bypass.port}")
      Application.put_env(:presence, :upstash_redis_rest_token, "test-token")

      assert {:ok, body} = RedisPubSub.broadcast("presence:user_joined", %{data: "test"})
      assert body == ["PUBLISH", 1]
    end

    test "sends correct Authorization header" do
      bypass = Bypass.open()

      Bypass.expect(bypass, "POST", "/", fn conn ->
        assert ["Bearer test-token-abc"] = Plug.Conn.get_req_header(conn, "authorization")
        assert ["application/json"] = Plug.Conn.get_req_header(conn, "content-type")

        Plug.Conn.resp(conn, 200, Jason.encode!(["PUBLISH", 1]))
      end)

      Application.put_env(:presence, :upstash_redis_rest_url, "http://localhost:#{bypass.port}")
      Application.put_env(:presence, :upstash_redis_rest_token, "test-token-abc")

      assert {:ok, _} = RedisPubSub.broadcast("test_channel", %{data: "test"})
    end

    test "returns {:error, :publish_failed} on non-200 status" do
      bypass = Bypass.open()

      Bypass.expect(bypass, "POST", "/", fn conn ->
        Plug.Conn.resp(conn, 401, "Unauthorized")
      end)

      Application.put_env(:presence, :upstash_redis_rest_url, "http://localhost:#{bypass.port}")
      Application.put_env(:presence, :upstash_redis_rest_token, "test-token")

      assert {:error, :publish_failed} = RedisPubSub.broadcast("test_channel", %{data: "test"})
    end
  end

  describe "command/1 success path with Bypass" do
    test "returns {:ok, body} on successful command (200)" do
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

    test "returns {:error, :command_failed} on non-200 status" do
      bypass = Bypass.open()

      Bypass.expect(bypass, "POST", "/", fn conn ->
        Plug.Conn.resp(conn, 500, "Internal Server Error")
      end)

      Application.put_env(:presence, :upstash_redis_rest_url, "http://localhost:#{bypass.port}")
      Application.put_env(:presence, :upstash_redis_rest_token, "test-token")

      assert {:error, :command_failed} = RedisPubSub.command(["GET", "key"])
    end
  end
end
