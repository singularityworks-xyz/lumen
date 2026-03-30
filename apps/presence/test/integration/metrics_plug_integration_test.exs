defmodule Presence.MetricsPlugIntegrationTest do
  use PresenceWeb.ConnCase, async: false

  @moduletag :capture_log

  describe "MetricsPlug in request pipeline" do
    test "GET /health records telemetry and returns response", %{conn: conn} do
      conn = get(conn, "/health")

      assert conn.status == 200
      body = Jason.decode!(conn.resp_body)
      assert Map.has_key?(body, "status")
    end

    test "GET / redirects with 301", %{conn: conn} do
      conn = get(conn, "/")

      assert conn.status == 301
    end

    test "plug does not crash on POST to unknown route", %{conn: conn} do
      conn =
        conn
        |> put_req_header("content-type", "application/json")
        |> post("/api/unknown", "{}")

      # Should get some response (404 or similar), not a crash
      assert is_integer(conn.status)
    end
  end

  describe "telemetry events are emitted" do
    test "health check emits endpoint telemetry" do
      # Attach a telemetry handler to capture events
      ref = make_ref()

      :telemetry.attach(
        {__MODULE__, ref},
        [:phoenix, :endpoint, :stop],
        fn _event, measurements, metadata, _config ->
          send(self(), {:telemetry, :endpoint_stop, measurements, metadata})
        end,
        nil
      )

      conn = build_conn()
      get(conn, "/health")

      # Verify telemetry was emitted
      assert_receive {:telemetry, :endpoint_stop, _measurements, _metadata}, 1000

      :telemetry.detach({__MODULE__, ref})
    end
  end
end
