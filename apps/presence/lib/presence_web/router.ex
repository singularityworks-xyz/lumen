defmodule PresenceWeb.Router do
  use PresenceWeb, :router

  pipeline :api do
    plug(:accepts, ["json"])
  end

  get("/", PresenceWeb.RedirectController, :index)

  get("/health", PresenceWeb.HealthController, :index)

  scope "/api", PresenceWeb do
    pipe_through(:api)
  end
end
