defmodule PresenceWeb.RedirectControllerTest do
  use PresenceWeb.ConnCase, async: true

  describe "index/2" do
    test "redirects to main app URL", %{conn: conn} do
      conn = get(conn, "/")

      assert conn.status == 301
      assert Plug.Conn.get_resp_header(conn, "location") == ["https://lumen.itssingularity.com"]
    end

    test "uses moved_permanently status", %{conn: conn} do
      conn = get(conn, "/")
      assert conn.status == 301
    end

    test "handles multiple requests consistently", %{conn: _conn} do
      tasks =
        for _ <- 1..5 do
          Task.async(fn ->
            conn = Phoenix.ConnTest.build_conn()
            conn = get(conn, "/")
            {conn.status, Plug.Conn.get_resp_header(conn, "location")}
          end)
        end

      results = Task.await_many(tasks, 5000)

      assert Enum.all?(results, fn {status, location} ->
               status == 301 and location == ["https://lumen.itssingularity.com"]
             end)
    end

    test "redirects with single query param", %{conn: conn} do
      conn = get(conn, "/?ref=presence")

      assert conn.status == 301
      assert Plug.Conn.get_resp_header(conn, "location") == ["https://lumen.itssingularity.com"]
    end

    test "redirects with multiple query params", %{conn: conn} do
      conn = get(conn, "/?utm_source=test&utm_medium=email&campaign=launch")

      assert conn.status == 301
      assert Plug.Conn.get_resp_header(conn, "location") == ["https://lumen.itssingularity.com"]
    end

    test "redirects with empty query string", %{conn: conn} do
      conn = get(conn, "/?")

      assert conn.status == 301
      assert Plug.Conn.get_resp_header(conn, "location") == ["https://lumen.itssingularity.com"]
    end

    test "redirects with special characters in query params", %{conn: conn} do
      conn = get(conn, "/?search=hello%20world&filter=a+b")

      assert conn.status == 301
      assert Plug.Conn.get_resp_header(conn, "location") == ["https://lumen.itssingularity.com"]
    end

    test "redirects with very long query string", %{conn: conn} do
      long_value = String.duplicate("a", 1000)
      conn = get(conn, "/?data=#{long_value}")

      assert conn.status == 301
      assert Plug.Conn.get_resp_header(conn, "location") == ["https://lumen.itssingularity.com"]
    end
  end
end
