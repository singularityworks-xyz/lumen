defmodule PresenceWeb.Plugs.InternalAuth do
  @moduledoc """
  Enforces internal service authentication for presence query routes.

  Callers must present `Authorization: Bearer <token>` matching the
  configured `internal_api_key` (from the `INTERNAL_API_KEY` env var). The
  plug fails closed: a missing or empty key configuration rejects every
  request, so an unconfigured deployment can never expose presence data.
  """

  import Plug.Conn

  require Logger

  def init(opts), do: opts

  def call(conn, _opts) do
    case configured_key() do
      nil ->
        Logger.warning("internal_api_key is not configured; rejecting presence query route")

        unauthorized(conn)

      key ->
        if bearer_token(conn) == key do
          conn
        else
          unauthorized(conn)
        end
    end
  end

  defp configured_key do
    case Application.get_env(:presence, :internal_api_key) do
      key when is_binary(key) and key != "" -> key
      _ -> nil
    end
  end

  defp bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> token
      _ -> nil
    end
  end

  defp unauthorized(conn) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(401, Jason.encode!(%{error: "unauthorized"}))
    |> halt()
  end
end
