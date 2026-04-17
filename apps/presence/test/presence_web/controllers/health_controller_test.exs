defmodule PresenceWeb.HealthControllerTest do
  use PresenceWeb.ConnCase, async: true

  describe "index/2" do
    test "returns healthy status", %{conn: conn} do
      conn = get(conn, "/health")

      assert %{
               "status" => "healthy",
               "service" => "presence",
               "timestamp" => timestamp
             } = json_response(conn, 200)

      assert is_binary(timestamp)
    end

    test "returns 200 status code", %{conn: conn} do
      conn = get(conn, "/health")
      assert conn.status == 200
    end

    test "returns JSON content type", %{conn: conn} do
      conn = get(conn, "/health")
      assert Plug.Conn.get_resp_header(conn, "content-type") |> hd() =~ "application/json"
    end

    test "timestamp is valid ISO8601 format", %{conn: conn} do
      conn = get(conn, "/health")
      %{"timestamp" => timestamp} = json_response(conn, 200)

      assert {:ok, _datetime, _offset} = DateTime.from_iso8601(timestamp)
    end

    test "includes instance id with presence prefix", %{conn: conn} do
      conn = get(conn, "/health")
      %{"instance_id" => instance_id} = json_response(conn, 200)

      assert String.starts_with?(instance_id, "presence-")
    end

    test "handles multiple concurrent requests", %{conn: _conn} do
      tasks =
        for _ <- 1..10 do
          Task.async(fn ->
            conn = Phoenix.ConnTest.build_conn()
            conn = get(conn, "/health")
            {conn.status, json_response(conn, 200)["status"]}
          end)
        end

      results = Task.await_many(tasks, 5000)

      assert Enum.all?(results, fn {status, status_text} ->
               status == 200 and status_text == "healthy"
             end)
    end
  end
end
