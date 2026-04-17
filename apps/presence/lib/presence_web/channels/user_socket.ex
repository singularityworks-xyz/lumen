defmodule PresenceWeb.UserSocket do
  @moduledoc """
  Handles WebSocket connections and authentication for presence tracking.
  Includes OpenTelemetry tracing and structured logging.
  """
  use Phoenix.Socket

  require Logger
  require OpenTelemetry.Tracer
  require Presence.Tracer, as: PresenceTracer

  @allow_e2e_anon_socket Application.compile_env(:presence, :allow_e2e_anon_socket, false)

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

  def connect(%{"allow_anonymous" => "1"}, socket, _connect_info) do
    if allow_e2e_anonymous_socket?() do
      anonymous_user_id = "e2e_anon_#{System.unique_integer([:positive])}"

      socket =
        socket
        |> assign(:user_id, anonymous_user_id)
        |> assign(:user_name, "E2E Anonymous")
        |> assign(:user_avatar, "https://example.com/avatar.png")

      {:ok, socket}
    else
      Logger.warning("WebSocket anonymous connection denied")
      :error
    end
  end

  def connect(_params, _socket, _connect_info) do
    Logger.warning("WebSocket connection attempt without token")
    :error
  end

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}"

  defp verify_token(token) do
    with {:ok, claims} <- Presence.Token.verify(token),
         %{"sub" => user_id} <- claims,
         true <- is_binary(user_id) and user_id != "" do
      {:ok,
       %{
         id: user_id,
         name: claims["name"],
         avatar: claims["image"]
       }}
    else
      _ -> {:error, :invalid_claims}
    end
  end

  defp allow_e2e_anonymous_socket? do
    @allow_e2e_anon_socket and
      case System.get_env("ALLOW_E2E_ANON_SOCKET") do
        value when value in ["1", "true", "TRUE"] -> true
        _ -> false
      end
  end
end
