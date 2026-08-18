defmodule PresenceWeb.WorkspacePresenceController do
  @moduledoc """
  API controller for querying canonical workspace presence state.
  Used by workers and other services as the single source of truth.
  """
  use PresenceWeb, :controller

  require Logger
  require Presence.Tracer, as: PresenceTracer

  alias Presence.Tracker

  @doc """
  Returns all online users in the specified workspace with presence details.
  """
  def show(conn, %{"workspace_id" => workspace_id}) do
    PresenceTracer.trace "controller.workspace_presence.show", [{"workspace.id", workspace_id}] do
      users = Tracker.list_workspace_users_formatted(workspace_id)
      user_ids = Enum.map(users, & &1.id)
      count = length(users)

      PresenceTracer.set_workspace_context(workspace_id)

      PresenceTracer.add_event("workspace_presence.queried", [
        {"workspace.id", workspace_id},
        {"presence.online_count", count}
      ])

      Logger.debug("Workspace presence queried (count: #{count})",
        workspace_id: workspace_id
      )

      conn
      |> put_status(:ok)
      |> json(%{
        workspace_id: workspace_id,
        users: users,
        user_ids: user_ids,
        count: count
      })
    end
  end
end
