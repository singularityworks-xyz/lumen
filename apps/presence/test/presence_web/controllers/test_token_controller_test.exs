defmodule PresenceWeb.TestTokenControllerTest do
  use PresenceWeb.ConnCase, async: false

  alias Presence.Token

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

        Token.clear_jwks_cache()
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

    test "returns generated token is valid", %{conn: conn} do
      previous_better_auth_url = Application.get_env(:presence, :better_auth_url)
      Application.put_env(:presence, :better_auth_url, "http://localhost:3002")

      on_exit(fn ->
        if is_nil(previous_better_auth_url) do
          Application.delete_env(:presence, :better_auth_url)
        else
          Application.put_env(:presence, :better_auth_url, previous_better_auth_url)
        end

        Token.clear_jwks_cache()
      end)

      conn = get(conn, "/api/test/token")
      assert conn.status == 200

      %{"token" => token, "user_id" => user_id} = json_response(conn, 200)

      # Verify the token can be verified
      assert {:ok, claims} = Token.verify(token)
      assert claims["sub"] == user_id
    end

    test "sets JWKS for test correctly", %{conn: conn} do
      previous_better_auth_url = Application.get_env(:presence, :better_auth_url)
      Application.put_env(:presence, :better_auth_url, "http://localhost:3002")

      on_exit(fn ->
        if is_nil(previous_better_auth_url) do
          Application.delete_env(:presence, :better_auth_url)
        else
          Application.put_env(:presence, :better_auth_url, previous_better_auth_url)
        end

        Token.clear_jwks_cache()
      end)

      conn = get(conn, "/api/test/token")
      assert conn.status == 200

      %{"token" => token} = json_response(conn, 200)

      # The JWKS should be set so the token can be verified
      assert {:ok, _claims} = Token.verify(token)
    end
  end
end
