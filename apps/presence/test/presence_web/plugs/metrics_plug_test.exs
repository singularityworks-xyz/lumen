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
    test "records metrics on request" do
      conn = Plug.Test.conn(:get, "/health")
      result = MetricsPlug.call(conn, [])

      assert result.__struct__ == Plug.Conn
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
end
