defmodule PresenceWeb.UserSocket do
  @moduledoc """
  Handles WebSocket connections and authentication for presence tracking.
  """
  use Phoenix.Socket

  channel("workspace:*", PresenceWeb.WorkspaceChannel)

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case verify_token(token) do
      {:ok, user} ->
        socket =
          socket
          |> assign(:user_id, user.id)
          |> assign(:user_name, user.name)
          |> assign(:user_avatar, user.avatar)

        {:ok, socket}

      {:error, _reason} ->
        :error
    end
  end

  def connect(_params, _socket, _connect_info) do
    :error
  end

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}"

  defp verify_token(token) do
    secret = Application.get_env(:presence, :jwt_secret)

    case Presence.Token.verify(token, secret) do
      {:ok, claims} ->
        {:ok,
         %{
           id: claims["sub"],
           name: claims["name"],
           avatar: claims["avatar"]
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end
end
