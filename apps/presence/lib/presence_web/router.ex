defmodule PresenceWeb.Router do
  use PresenceWeb, :router

  pipeline :api do
    plug(:accepts, ["json"])
  end

  # Internal service authentication for presence query endpoints.
  pipeline :internal_api do
    plug(PresenceWeb.Plugs.InternalAuth)
  end

  get("/", PresenceWeb.RedirectController, :index)

  get("/health", PresenceWeb.HealthController, :index)

  scope "/api", PresenceWeb do
    pipe_through(:api)

    get("/test/token", TestTokenController, :generate)
  end

  scope "/api", PresenceWeb do
    pipe_through(:api)
    pipe_through(:internal_api)

    get("/workspaces/:workspace_id/presence", WorkspacePresenceController, :show)
    get("/users/:user_id/presence", UserPresenceController, :show)
  end
end
