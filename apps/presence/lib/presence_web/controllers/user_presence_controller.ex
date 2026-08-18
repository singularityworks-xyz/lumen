defmodule PresenceWeb.UserPresenceController do
  @moduledoc """
  API controller for querying cross-workspace user presence.
  """
  use PresenceWeb, :controller

  require Logger
  require Presence.Tracer, as: PresenceTracer

  alias Presence.Tracker

  @doc """
  Returns all active workspaces for the specified user (cross-workspace presence).
  """
  def show(conn, %{"user_id" => user_id}) do
    PresenceTracer.trace "controller.user_presence.show", [{"user.id", user_id}] do
      workspaces = Tracker.list_user_workspaces(user_id)
      is_online = workspaces != []
      count = length(workspaces)

      PresenceTracer.set_user_context(user_id, %{is_online: is_online, workspace_count: count})

      PresenceTracer.add_event("user_presence.queried", [
        {"user.id", user_id},
        {"presence.is_online", is_online},
        {"presence.workspace_count", count}
      ])

      Logger.debug("User presence queried (online: #{is_online}, count: #{count})",
        user_id: user_id
      )

      conn
      |> put_status(:ok)
      |> json(%{
        user_id: user_id,
        workspaces: workspaces,
        is_online: is_online,
        count: count
      })
    end
  end
end
