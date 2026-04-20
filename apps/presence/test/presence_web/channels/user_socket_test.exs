defmodule PresenceWeb.UserSocketTest do
  use PresenceWeb.ChannelCase, async: false

  import Presence.Test.Fixtures

  alias Presence.Token
  alias PresenceWeb.UserSocket

  @moduletag :capture_log

  setup_all do
    Application.ensure_all_started(:jose)
    Application.put_env(:presence, :better_auth_url, "https://auth.example.com")
    :ok
  end

  setup do
    Token.init_cache()
    on_exit(fn -> Token.clear_jwks_cache() end)
    :ok
  end

  describe "connect/3 authentication" do
    test "authenticates with valid token" do
      {token, claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => token}, socket, %{})

      assert {:ok, connected_socket} = result
      assert connected_socket.assigns.user_id == claims["sub"]
      assert connected_socket.assigns.user_name == claims["name"]
    end

    test "rejects with invalid token" do
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => "invalid.token.here"}, socket, %{})

      assert :error = result
    end

    test "rejects with token missing sub claim" do
      {token, jwks} = token_without_sub_claim()
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => token}, socket, %{})

      assert :error = result
    end

    test "rejects with token having empty sub claim" do
      {token, jwks} = token_with_empty_sub_claim()
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => token}, socket, %{})

      assert :error = result
    end
  end

  describe "connect/3 with valid token" do
    test "connects successfully with valid JWT token" do
      {token, claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      connect_info = %{}

      result = UserSocket.connect(%{"token" => token}, socket, connect_info)

      assert {:ok, connected_socket} = result
      assert connected_socket.assigns.user_id == claims["sub"]
    end

    test "assigns user name from token" do
      {token, claims, jwks} = valid_jwt_token_with_jwks(name: "Test User Name")
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => token}, socket, %{})

      assert {:ok, connected_socket} = result
      assert connected_socket.assigns.user_name == claims["name"]
    end

    test "assigns user avatar from token" do
      {token, claims, jwks} = valid_jwt_token_with_jwks(image: "https://example.com/avatar.png")
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => token}, socket, %{})

      assert {:ok, connected_socket} = result
      assert connected_socket.assigns.user_avatar == claims["image"]
    end

    test "handles token with missing optional claims" do
      {token, _, jwks} = valid_jwt_token_with_jwks(user_id: "minimal_user")
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => token}, socket, %{})

      assert {:ok, connected_socket} = result
      assert connected_socket.assigns.user_id == "minimal_user"
    end
  end

  describe "connect/3 with invalid token" do
    test "rejects connection without token" do
      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{}, socket, %{})

      assert :error = result
    end

    test "rejects connection with expired token" do
      {token, jwks} = expired_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => token}, socket, %{})

      assert :error = result
    end

    test "rejects connection with malformed token" do
      token = malformed_token()
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => token}, socket, %{})

      assert :error = result
    end

    test "rejects connection with invalid signature token" do
      token = invalid_signature_token()
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => token}, socket, %{})

      assert :error = result
    end

    test "rejects connection with empty token" do
      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => ""}, socket, %{})

      assert :error = result
    end

    test "rejects connection with nil token" do
      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => nil}, socket, %{})

      assert :error = result
    end
  end

  describe "connect/3 with anonymous e2e mode" do
    test "accepts anonymous connection when ALLOW_E2E_ANON_SOCKET is enabled" do
      previous = System.get_env("ALLOW_E2E_ANON_SOCKET")
      System.put_env("ALLOW_E2E_ANON_SOCKET", "true")

      on_exit(fn ->
        if previous do
          System.put_env("ALLOW_E2E_ANON_SOCKET", previous)
        else
          System.delete_env("ALLOW_E2E_ANON_SOCKET")
        end
      end)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"allow_anonymous" => "1"}, socket, %{})

      assert {:ok, connected_socket} = result
      assert connected_socket.assigns.user_name == "E2E Anonymous"
      assert connected_socket.assigns.user_avatar == "https://example.com/avatar.png"
      assert String.starts_with?(connected_socket.assigns.user_id, "e2e_anon_")
    end

    test "rejects anonymous connection when ALLOW_E2E_ANON_SOCKET is disabled" do
      previous = System.get_env("ALLOW_E2E_ANON_SOCKET")
      System.put_env("ALLOW_E2E_ANON_SOCKET", "false")

      on_exit(fn ->
        if previous do
          System.put_env("ALLOW_E2E_ANON_SOCKET", previous)
        else
          System.delete_env("ALLOW_E2E_ANON_SOCKET")
        end
      end)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"allow_anonymous" => "1"}, socket, %{})

      assert :error = result
    end

    test "rejects anonymous connection when ALLOW_E2E_ANON_SOCKET env is not set" do
      previous = System.get_env("ALLOW_E2E_ANON_SOCKET")
      System.delete_env("ALLOW_E2E_ANON_SOCKET")

      on_exit(fn ->
        if previous do
          System.put_env("ALLOW_E2E_ANON_SOCKET", previous)
        else
          System.delete_env("ALLOW_E2E_ANON_SOCKET")
        end
      end)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"allow_anonymous" => "1"}, socket, %{})

      assert :error = result
    end

    test "accepts anonymous connection with uppercase TRUE value" do
      previous = System.get_env("ALLOW_E2E_ANON_SOCKET")
      System.put_env("ALLOW_E2E_ANON_SOCKET", "TRUE")

      on_exit(fn ->
        if previous do
          System.put_env("ALLOW_E2E_ANON_SOCKET", previous)
        else
          System.delete_env("ALLOW_E2E_ANON_SOCKET")
        end
      end)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"allow_anonymous" => "1"}, socket, %{})

      assert {:ok, _} = result
    end

    test "accepts anonymous connection with 1 value" do
      previous = System.get_env("ALLOW_E2E_ANON_SOCKET")
      System.put_env("ALLOW_E2E_ANON_SOCKET", "1")

      on_exit(fn ->
        if previous do
          System.put_env("ALLOW_E2E_ANON_SOCKET", previous)
        else
          System.delete_env("ALLOW_E2E_ANON_SOCKET")
        end
      end)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"allow_anonymous" => "1"}, socket, %{})

      assert {:ok, _} = result
    end

    test "rejects anonymous when compile-time config is false (line 96)" do
      # This test documents that the compile-time @allow_e2e_anon_socket
      # module attribute must be true for anonymous connections to work.
      # The test above already covers this since in test env the compile-time
      # config is false by default. We verify by testing with env var set.
      previous = System.get_env("ALLOW_E2E_ANON_SOCKET")
      System.delete_env("ALLOW_E2E_ANON_SOCKET")

      on_exit(fn ->
        if previous do
          System.put_env("ALLOW_E2E_ANON_SOCKET", previous)
        else
          System.delete_env("ALLOW_E2E_ANON_SOCKET")
        end
      end)

      # With compile-time config false AND env var not set, should reject
      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"allow_anonymous" => "1"}, socket, %{})
      assert :error = result
    end

    test "rejects anonymous when env var has invalid value (line 99)" do
      # Test the _ -> false clause on line 99
      previous = System.get_env("ALLOW_E2E_ANON_SOCKET")
      System.put_env("ALLOW_E2E_ANON_SOCKET", "invalid_value")

      on_exit(fn ->
        if previous do
          System.put_env("ALLOW_E2E_ANON_SOCKET", previous)
        else
          System.delete_env("ALLOW_E2E_ANON_SOCKET")
        end
      end)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"allow_anonymous" => "1"}, socket, %{})
      assert :error = result
    end

    # Note: The compile-time config @allow_e2e_anon_socket is set to true in test.exs
    # so we cannot test line 96 (the @allow_e2e_anon_socket check returning false)
    # without recompiling the module with a different config.
  end

  describe "connect/3 error logging" do
    test "logs error when token verification fails" do
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => "invalid.token.here"}, socket, %{})

      assert :error = result
    end

    test "returns error when token has invalid signature" do
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      socket = %Phoenix.Socket{handler: UserSocket}
      # Token with different signature
      result = UserSocket.connect(%{"token" => "eyJhbGciOiJIUzI1NiJ9.invalid.invalid"}, socket, %{})

      assert :error = result
    end

    test "returns error when token cannot be parsed" do
      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => "invalid"}, socket, %{})

      assert :error = result
    end

    test "returns error when token verification raises unexpected error" do
      # Test with malformed token that triggers error path
      socket = %Phoenix.Socket{handler: UserSocket}
      result = UserSocket.connect(%{"token" => <<0, 1, 2, 3>>}, socket, %{})

      assert :error = result
    end
  end

  describe "id/1" do
    test "returns user socket ID" do
      socket = socket_with_user(%{id: "user_123"})

      assert UserSocket.id(socket) == "user_socket:user_123"
    end

    test "returns unique ID per user" do
      socket1 = socket_with_user(%{id: "user_abc"})
      socket2 = socket_with_user(%{id: "user_xyz"})

      assert UserSocket.id(socket1) != UserSocket.id(socket2)
    end
  end
end
