defmodule PresenceWeb.WorkspacePresenceControllerTest do
  use PresenceWeb.ConnCase, async: false

  alias Presence.Tracker

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
      conn = get(conn, "/api/workspaces/ws_unauth/presence")

      assert json_response(conn, 401) == %{"error" => "unauthorized"}
    end

    test "rejects requests with an invalid token", %{conn: conn} do
      conn =
        conn
        |> put_req_header("authorization", "Bearer wrong-key")
        |> get("/api/workspaces/ws_bad_token/presence")

      assert json_response(conn, 401) == %{"error" => "unauthorized"}
    end

    test "returns empty list for workspace with no active users", %{conn: conn} do
      workspace_id = "empty_ws_#{System.unique_integer()}"
      conn = authed_get(conn, "/api/workspaces/#{workspace_id}/presence")

      assert %{
               "workspace_id" => ^workspace_id,
               "users" => [],
               "user_ids" => [],
               "count" => 0
             } = json_response(conn, 200)
    end

    test "returns active users in workspace", %{conn: conn} do
      workspace_id = "ws_with_users_#{System.unique_integer()}"
      user_id = "user_#{System.unique_integer()}"
      socket = socket_in_workspace(workspace_id, %{id: user_id, name: "Alice", avatar: "https://example.com/alice.png"})

      {:ok, _} =
        Tracker.track_user(socket, user_id, workspace_id, %{
          name: "Alice",
          avatar: "https://example.com/alice.png"
        })

      conn = authed_get(conn, "/api/workspaces/#{workspace_id}/presence")

      response = json_response(conn, 200)
      assert response["workspace_id"] == workspace_id
      assert response["count"] == 1
      assert response["user_ids"] == [user_id]

      [user] = response["users"]
      assert user["id"] == user_id
      assert user["name"] == "Alice"
      assert user["avatar"] == "https://example.com/alice.png"
      assert user["status"] == "online"
    end
  end
end
