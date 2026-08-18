defmodule PresenceWeb.Plugs.InternalAuth do
  @moduledoc """
  Enforces internal service authentication for presence query routes.

  Callers must present `Authorization: Bearer <token>` matching the
  configured `internal_api_key` (from the `INTERNAL_API_KEY` env var). When
  no key is configured the plug logs a warning and lets the request through,
  so local dev deployments keep working until a key is provisioned.
  """

  import Plug.Conn

  require Logger

  def init(opts), do: opts

  def call(conn, _opts) do
    case Application.get_env(:presence, :internal_api_key) do
      nil ->
        Logger.warning("internal_api_key is not configured; presence query routes are unauthenticated")

        conn

      key when is_binary(key) and key != "" ->
        if bearer_token(conn) == key do
          conn
        else
          unauthorized(conn)
        end
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
