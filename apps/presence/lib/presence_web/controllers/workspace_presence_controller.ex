defmodule PresenceWeb.WorkspacePresenceController do
  @moduledoc """
  API controller for querying canonical workspace presence state.
  Used by workers and other services as the single source of truth.
  """
  use PresenceWeb, :controller

  alias Presence.Tracker

  @doc """
  Returns all online users in the specified workspace with presence details.
  """
  def show(conn, %{"workspace_id" => workspace_id}) do
    users = Tracker.list_workspace_users_formatted(workspace_id)
    user_ids = Enum.map(users, & &1.id)

    conn
    |> put_status(:ok)
    |> json(%{
      workspace_id: workspace_id,
      users: users,
      user_ids: user_ids,
      count: length(users)
    })
  end
end
