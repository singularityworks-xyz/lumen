defmodule PresenceWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :presence

  # The session will be stored in the cookie and signed,
  # this means its contents can be read but not tampered with.
  # Set :encryption_salt if you would also like to encrypt it.
  @session_options [
    store: :cookie,
    key: "_presence_key",
    signing_salt: "u4hvoFnq",
    same_site: "Lax"
  ]

  socket("/socket", PresenceWeb.UserSocket,
    websocket: [
      connect_info: [:peer_data, :x_headers],
      check_origin: {__MODULE__, :check_websocket_origin, []}
    ],
    longpoll: false
  )

  # Code reloading can be explicitly enabled under the
  # :code_reloader configuration of your endpoint.
  if code_reloading? do
    plug(Phoenix.CodeReloader)
  end

  plug(Plug.RequestId)

  plug(Plug.Telemetry,
    event_prefix: [:phoenix, :endpoint],
    log: {__MODULE__, :log_level, []}
  )

  plug(Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()
  )

  alias PresenceWeb.Plugs.OriginGuard

  plug(Plug.MethodOverride)
  plug(Plug.Head)
  plug(Plug.Session, @session_options)
  plug(OriginGuard)
  plug(PresenceWeb.Router)

  def check_websocket_origin(%URI{} = uri) do
    OriginGuard.allowed_origin?(URI.to_string(uri))
  end

  def check_websocket_origin(_), do: false

  # Health probes (Dokploy polls every ~30s) are not request traffic —
  # silence their request logs while keeping everything else at info.
  def log_level(%{path_info: ["health" | _]}), do: false
  def log_level(_), do: :info
end
