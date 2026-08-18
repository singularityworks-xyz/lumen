defmodule Presence.PresenceSets do
  @moduledoc """
  Maintains the canonical Redis presence sets with per-connection reference
  counting.

  A user may hold several live channels for the same workspace (multiple
  tabs). Each join increments a per-user-per-workspace counter and each
  terminate decrements it; set membership is only removed when the final
  channel terminates, so closing one tab never drops the user from
  workspace or cross-workspace presence while another tab is still open.
  """

  alias Presence.RedisPubSub

  # Bound synchronous Redis calls so channel join/terminate can never block
  # beyond this limit.
  @command_timeout_ms 2_000

  @doc "Key counting live channels for a user in a workspace."
  def channel_count_key(user_id, workspace_id) do
    "presence:channels:#{user_id}:#{workspace_id}"
  end

  @doc "Redis set key: user ids online in a workspace."
  def workspace_users_key(workspace_id) do
    "presence:workspace:#{workspace_id}:users"
  end

  @doc "Redis set key: workspace ids a user is active in."
  def user_workspaces_key(user_id) do
    "presence:user:#{user_id}:workspaces"
  end

  @doc """
  Register a new live channel for a user in a workspace.

  SADD is idempotent, so opening additional tabs (or rejoining after a
  stale cleanup) self-heals set membership.
  """
  def user_joined(user_id, workspace_id) do
    with {:ok, _} <- command(["INCR", channel_count_key(user_id, workspace_id)]),
         {:ok, _} <- command(["SADD", workspace_users_key(workspace_id), user_id]),
         {:ok, _} <- command(["SADD", user_workspaces_key(user_id), workspace_id]) do
      :ok
    else
      _ -> :ok
    end
  end

  @doc """
  Unregister a live channel for a user in a workspace.

  Returns `:removed` when this was the final channel and Redis membership
  was cleaned up, or `:retained` when other channels for the same
  user/workspace are still connected (or Redis is unavailable).
  """
  def user_left(user_id, workspace_id) do
    case command(["DECR", channel_count_key(user_id, workspace_id)]) do
      {:ok, count} when is_integer(count) and count <= 0 ->
        command(["DEL", channel_count_key(user_id, workspace_id)])
        command(["SREM", workspace_users_key(workspace_id), user_id])
        command(["SREM", user_workspaces_key(user_id), workspace_id])
        :removed

      _ ->
        :retained
    end
  end

  defp command(cmd) do
    runner = Application.get_env(:presence, :redis_command_runner, RedisPubSub)
    runner.command(cmd, timeout: @command_timeout_ms)
  end
end
