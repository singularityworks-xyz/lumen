defmodule PresenceWeb.Plugs.OriginGuard do
  @moduledoc """
  Blocks direct browser access and requests from untrusted origins for the presence service.
  """

  import Plug.Conn

  require Logger

  @default_allowed_origins [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:1420",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost"
  ]

  @loopback_hosts ["localhost", "127.0.0.1", "0.0.0.0", "::1"]

  def init(opts), do: opts

  def call(conn, _opts) do
    # Allow OPTIONS requests (CORS preflight)
    if conn.method == "OPTIONS" do
      conn
    else
      check_access(conn)
    end
  end

  defp check_access(conn) do
    # Allow internal service authentication via internal_api_key
    if internal_key_valid?(conn) do
      conn
    else
      # Block direct browser navigation (sec-fetch-dest: document / sec-fetch-mode: navigate)
      if direct_browser_navigation?(conn) do
        forbidden(conn, "Direct browser access is blocked")
      else
        # Allow test environment bypass if in :test and no invalid origin is explicitly provided
        if test_env?() and not invalid_origin_supplied?(conn) do
          conn
        else
          # Validate Origin or Referer header against allowed origins
          origin = get_first_req_header(conn, "origin")
          referer = get_first_req_header(conn, "referer")

          cond do
            origin != nil and allowed_origin?(origin) ->
              conn

            referer != nil and allowed_origin?(referer) ->
              conn

            true ->
              forbidden(conn, "Direct access or untrusted origin is blocked")
          end
        end
      end
    end
  end

  defp internal_key_valid?(conn) do
    case Application.get_env(:presence, :internal_api_key) do
      key when is_binary(key) and key != "" ->
        auth_header = get_first_req_header(conn, "authorization")
        internal_key = get_first_req_header(conn, "x-internal-key")

        auth_header == "Bearer " <> key or internal_key == key

      _ ->
        false
    end
  end

  defp test_env? do
    try do
      Mix.env() == :test
    rescue
      _ -> Application.get_env(:presence, :env) == :test
    end
  end

  defp invalid_origin_supplied?(conn) do
    case get_first_req_header(conn, "origin") do
      nil -> false
      origin -> not allowed_origin?(origin)
    end
  end

  defp direct_browser_navigation?(conn) do
    sec_dest = get_first_req_header(conn, "sec-fetch-dest")
    sec_mode = get_first_req_header(conn, "sec-fetch-mode")

    sec_dest in ["document", "nested-document"] or sec_mode == "navigate"
  end

  def allowed_origin?(origin_or_referer) when is_binary(origin_or_referer) do
    uri = URI.parse(origin_or_referer)
    allowed_list = get_allowed_origins()

    raw_origin =
      case uri.scheme do
        scheme when scheme in ["http", "https"] ->
          port_str = if uri.port && uri.port not in [80, 443], do: ":#{uri.port}", else: ""
          "#{scheme}://#{uri.host}#{port_str}"

        "tauri" ->
          "tauri://#{uri.host}"

        _ ->
          origin_or_referer
      end

    if raw_origin in allowed_list do
      true
    else
      # Check loopback host aliases
      Enum.any?(allowed_list, fn allowed ->
        allowed_uri = URI.parse(allowed)

        allowed_uri.scheme == uri.scheme and
          allowed_uri.port == uri.port and
          allowed_uri.host in @loopback_hosts and
          uri.host in @loopback_hosts
      end)
    end
  end

  def allowed_origin?(_), do: false

  defp get_allowed_origins do
    case Application.get_env(:presence, :allowed_origins) do
      origins when is_list(origins) ->
        origins ++ @default_allowed_origins

      origins when is_binary(origins) and origins != "" ->
        (String.split(origins, ",") |> Enum.map(&String.trim/1)) ++ @default_allowed_origins

      _ ->
        @default_allowed_origins
    end
  end

  defp get_first_req_header(conn, header) do
    case get_req_header(conn, header) do
      [val | _] -> val
      [] -> nil
    end
  end

  defp forbidden(conn, message) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(403, Jason.encode!(%{error: "forbidden", message: message}))
    |> halt()
  end
end
