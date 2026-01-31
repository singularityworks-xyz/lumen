defmodule PresenceWeb.Router do
  use PresenceWeb, :router

  pipeline :api do
    plug(:accepts, ["json"])
  end

  scope "/api", PresenceWeb do
    pipe_through(:api)
  end
end
