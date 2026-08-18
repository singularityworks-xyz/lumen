defmodule PresenceWeb.WorkspacePresenceControllerTest do
  use PresenceWeb.ConnCase, async: false

  alias Presence.Tracker

  describe "show/2" do
    test "returns empty list for workspace with no active users", %{conn: conn} do
      workspace_id = "empty_ws_#{System.unique_integer()}"
      conn = get(conn, "/api/workspaces/#{workspace_id}/presence")

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

      conn = get(conn, "/api/workspaces/#{workspace_id}/presence")

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
