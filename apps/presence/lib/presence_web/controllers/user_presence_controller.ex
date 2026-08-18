defmodule PresenceWeb.UserPresenceController do
  @moduledoc """
  API controller for querying cross-workspace user presence.
  """
  use PresenceWeb, :controller

  alias Presence.Tracker

  @doc """
  Returns all active workspaces for the specified user (cross-workspace presence).
  """
  def show(conn, %{"user_id" => user_id}) do
    workspaces = Tracker.list_user_workspaces(user_id)

    conn
    |> put_status(:ok)
    |> json(%{
      user_id: user_id,
      workspaces: workspaces,
      is_online: workspaces != [],
      count: length(workspaces)
    })
  end
end
