defmodule PresenceWeb.RedirectController do
  use PresenceWeb, :controller

  @main_app_url "https://lumen.itssingularity.com"

  def index(conn, _params) do
    conn
    |> put_status(:moved_permanently)
    |> redirect(external: @main_app_url)
  end
end
