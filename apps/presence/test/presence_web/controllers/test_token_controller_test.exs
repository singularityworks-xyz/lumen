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

    test "returns forbidden when env is not test", %{conn: conn} do
      # Temporarily change the env to something other than :test
      original_env = Application.get_env(:presence, :env)
      Application.put_env(:presence, :env, :production)

      on_exit(fn ->
        Application.put_env(:presence, :env, original_env)
      end)

      conn = get(conn, "/api/test/token")

      assert conn.status == 403
      assert %{"error" => "Test endpoint not available in this environment"} = json_response(conn, 403)
    end

    test "returns forbidden in dev environment", %{conn: conn} do
      original_env = Application.get_env(:presence, :env)
      Application.put_env(:presence, :env, :dev)

      on_exit(fn ->
        Application.put_env(:presence, :env, original_env)
      end)

      conn = get(conn, "/api/test/token")

      assert conn.status == 403
    end

    test "returns forbidden when env is nil", %{conn: conn} do
      original_env = Application.get_env(:presence, :env)
      Application.delete_env(:presence, :env)

      on_exit(fn ->
        if original_env do
          Application.put_env(:presence, :env, original_env)
        end
      end)

      conn = get(conn, "/api/test/token")

      assert conn.status == 403
    end
  end
end
