defmodule PresenceWeb.HealthController do
  use PresenceWeb, :controller

  @doc """
  Health check endpoint for Docker/Kubernetes/Dokploy.
  Returns 200 OK if the service is healthy.
  """
  def index(conn, _params) do
    conn
    |> put_status(:ok)
    |> json(%{
      status: "healthy",
      service: "presence",
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end
end
