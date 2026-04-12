defmodule PresenceWeb.HealthController do
  use PresenceWeb, :controller

  @doc """
  Health check endpoint for Docker/Kubernetes/Dokploy.
  Returns 200 OK if the service is healthy.
  """
  def index(conn, _params) do
    instance_id =
      case Application.get_env(:presence, :port) do
        nil -> "presence-4001"
        port -> "presence-#{port}"
      end

    conn
    |> put_status(:ok)
    |> json(%{
      status: "healthy",
      service: "presence",
      instance_id: instance_id,
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end
end
