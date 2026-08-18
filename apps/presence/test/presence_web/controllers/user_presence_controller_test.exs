defmodule PresenceWeb.UserPresenceControllerTest do
  use PresenceWeb.ConnCase, async: false

  @api_key "test_internal_key"

  setup do
    Application.put_env(:presence, :internal_api_key, @api_key)
    on_exit(fn -> Application.put_env(:presence, :internal_api_key, nil) end)
    :ok
  end

  defp authed_get(conn, path) do
    conn
    |> put_req_header("authorization", "Bearer #{@api_key}")
    |> get(path)
  end

  describe "show/2" do
    test "rejects requests without an authorization header", %{conn: conn} do
      conn = get(conn, "/api/users/unauth_user/presence")

      assert json_response(conn, 401) == %{"error" => "unauthorized"}
    end

    test "returns offline status for untracked user", %{conn: conn} do
      user_id = "untracked_user_#{System.unique_integer()}"
      conn = authed_get(conn, "/api/users/#{user_id}/presence")

      assert %{
               "user_id" => ^user_id,
               "workspaces" => [],
               "is_online" => false,
               "count" => 0
             } = json_response(conn, 200)
    end
  end
end
