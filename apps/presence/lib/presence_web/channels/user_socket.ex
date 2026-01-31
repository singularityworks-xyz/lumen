defmodule PresenceWeb.UserSocket do
  @moduledoc """
  Handles WebSocket connections and authentication for presence tracking.
  Includes OpenTelemetry tracing and structured logging.
  """
  use Phoenix.Socket

  require Logger
  require OpenTelemetry.Tracer
  require Presence.Tracer, as: PresenceTracer

  alias Presence.Tracer, as: PresenceTracer

  channel("workspace:*", PresenceWeb.WorkspaceChannel)

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    PresenceTracer.trace "websocket.connect", [{"transport", "websocket"}] do
      case verify_token(token) do
        {:ok, user} ->
          # Set trace context
          PresenceTracer.set_user_context(user.id, %{
            name: user.name
          })

          Logger.info("WebSocket connection established",
            user_id: user.id,
            user_name: user.name,
            trace_id: PresenceTracer.current_trace_id()
          )

          socket =
            socket
            |> assign(:user_id, user.id)
            |> assign(:user_name, user.name)
            |> assign(:user_avatar, user.avatar)

          PresenceTracer.add_event("websocket.authenticated", [
            {"user.id", user.id}
          ])

          {:ok, socket}

        {:error, reason} ->
          Logger.warning("WebSocket authentication failed",
            reason: inspect(reason),
            trace_id: PresenceTracer.current_trace_id()
          )

          :error
      end
    end
  end

  def connect(_params, _socket, _connect_info) do
    Logger.warning("WebSocket connection attempt without token")
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
