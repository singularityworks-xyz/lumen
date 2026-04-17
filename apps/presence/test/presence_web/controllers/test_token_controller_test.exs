defmodule PresenceWeb.TestTokenControllerTest do
  use PresenceWeb.ConnCase, async: false

  describe "generate/2" do
    test "returns token with better auth issuer/audience in test env", %{conn: conn} do
      previous_better_auth_url = Application.get_env(:presence, :better_auth_url)
      Application.put_env(:presence, :better_auth_url, "http://localhost:3002")

      on_exit(fn ->
        if is_nil(previous_better_auth_url) do
          Application.delete_env(:presence, :better_auth_url)
        else
          Application.put_env(:presence, :better_auth_url, previous_better_auth_url)
        end

        Presence.Token.clear_jwks_cache()
      end)

      conn = get(conn, "/api/test/token")

      assert conn.status == 200

      assert %{
               "token" => token,
               "claims" => %{
                 "iss" => "http://localhost:3002",
                 "aud" => "http://localhost:3002"
               }
             } = json_response(conn, 200)

      assert is_binary(token)
    end
  end
end
