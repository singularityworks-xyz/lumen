defmodule PresenceWeb.Plugs.InternalAuthTest do
  use PresenceWeb.ConnCase, async: false

  alias PresenceWeb.Plugs.InternalAuth

  @api_key "test_internal_key"

  defp call_plug(conn) do
    InternalAuth.call(conn, %{})
  end

  describe "call/2" do
    test "allows requests presenting the configured bearer token", %{conn: conn} do
      Application.put_env(:presence, :internal_api_key, @api_key)
      on_exit(fn -> Application.put_env(:presence, :internal_api_key, nil) end)

      conn =
        conn
        |> put_req_header("authorization", "Bearer #{@api_key}")
        |> call_plug()

      refute conn.halted
      assert conn.status == nil
    end

    test "rejects requests without a token", %{conn: conn} do
      Application.put_env(:presence, :internal_api_key, @api_key)
      on_exit(fn -> Application.put_env(:presence, :internal_api_key, nil) end)

      conn = call_plug(conn)

      assert conn.halted
      assert conn.status == 401
    end

    test "rejects requests with a wrong token", %{conn: conn} do
      Application.put_env(:presence, :internal_api_key, @api_key)
      on_exit(fn -> Application.put_env(:presence, :internal_api_key, nil) end)

      conn =
        conn
        |> put_req_header("authorization", "Bearer wrong-key")
        |> call_plug()

      assert conn.halted
      assert conn.status == 401
    end

    test "rejects requests when no key is configured", %{conn: conn} do
      Application.put_env(:presence, :internal_api_key, nil)

      conn = call_plug(conn)

      assert conn.halted
      assert conn.status == 401
    end

    test "rejects requests when the configured key is empty", %{conn: conn} do
      Application.put_env(:presence, :internal_api_key, "")

      conn = call_plug(conn)

      assert conn.halted
      assert conn.status == 401
    end
  end
end
