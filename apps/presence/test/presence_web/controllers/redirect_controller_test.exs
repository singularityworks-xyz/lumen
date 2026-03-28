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
  end
end
