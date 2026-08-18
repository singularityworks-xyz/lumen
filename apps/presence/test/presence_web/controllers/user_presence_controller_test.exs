defmodule PresenceWeb.UserPresenceControllerTest do
  use PresenceWeb.ConnCase, async: false

  describe "show/2" do
    test "returns offline status for untracked user", %{conn: conn} do
      user_id = "untracked_user_#{System.unique_integer()}"
      conn = get(conn, "/api/users/#{user_id}/presence")

      assert %{
               "user_id" => ^user_id,
               "workspaces" => [],
               "is_online" => false,
               "count" => 0
             } = json_response(conn, 200)
    end
  end
end
