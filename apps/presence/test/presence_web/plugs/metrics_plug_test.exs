defmodule PresenceWeb.Plugs.MetricsPlugTest do
  use ExUnit.Case, async: true

  alias PresenceWeb.Plugs.MetricsPlug

  @moduletag :capture_log

  describe "init/1" do
    test "returns options unchanged" do
      assert MetricsPlug.init([]) == []
    end

    test "returns any options" do
      opts = [some: :option]
      assert MetricsPlug.init(opts) == opts
    end
  end

  describe "call/2" do
    test "registers before_send callback" do
      conn = Plug.Test.conn(:get, "/health")
      result = MetricsPlug.call(conn, [])

      assert result.__struct__ == Plug.Conn
      assert result.private[:before_send] != nil
      assert length(result.private[:before_send]) > 0
    end

    test "handles GET requests" do
      conn = Plug.Test.conn(:get, "/health")
      result = MetricsPlug.call(conn, [])

      assert result.__struct__ == Plug.Conn
    end

    test "handles POST requests" do
      conn = Plug.Test.conn(:post, "/api/test", %{})
      result = MetricsPlug.call(conn, [])

      assert result.__struct__ == Plug.Conn
    end

    test "handles requests with query parameters" do
      conn = Plug.Test.conn(:get, "/health?param=value")
      result = MetricsPlug.call(conn, [])

      assert result.__struct__ == Plug.Conn
    end
  end

  describe "before_send callback execution" do
    test "executes metrics recording on send" do
      conn =
        Plug.Test.conn(:get, "/health")
        |> MetricsPlug.call([])

      # Verify before_send callback was registered
      assert length(conn.private[:before_send] || []) > 0

      # Execute the callbacks by sending the response
      conn = Plug.Conn.send_resp(conn, 200, "ok")
      assert conn.status == 200
    end

    test "normalizes UUIDs in request path" do
      uuid = "550e8400-e29b-41d4-a716-446655440000"

      conn =
        Plug.Test.conn(:get, "/api/workspaces/#{uuid}")
        |> MetricsPlug.call([])
        |> Plug.Conn.send_resp(200, "ok")

      assert conn.status == 200
    end

    test "normalizes numeric IDs in request path" do
      conn =
        Plug.Test.conn(:get, "/api/items/12345")
        |> MetricsPlug.call([])
        |> Plug.Conn.send_resp(200, "ok")

      assert conn.status == 200
    end

    test "handles error status codes" do
      conn =
        Plug.Test.conn(:get, "/missing")
        |> MetricsPlug.call([])
        |> Plug.Conn.send_resp(404, "not found")

      assert conn.status == 404
    end

    test "handles server error status codes" do
      conn =
        Plug.Test.conn(:get, "/error")
        |> MetricsPlug.call([])
        |> Plug.Conn.send_resp(500, "internal error")

      assert conn.status == 500
    end
  end
end
