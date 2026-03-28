defmodule PresenceWeb.UserSocketTest do
  use PresenceWeb.ChannelCase, async: false

  import Presence.Test.Fixtures

  alias Presence.Token
  alias PresenceWeb.UserSocket

  @moduletag :capture_log

  setup_all do
    Application.ensure_all_started(:jose)
    Application.put_env(:presence, :better_auth_url, "https://auth.example.com")
    Token.init_cache()
    :ok
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
