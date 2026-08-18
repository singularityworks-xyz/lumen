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

  # Atomic Lua scripts: each transition is a single EVAL so the counter and
  # both membership sets can never be observed (or crash) in a partial state.
  @joined_script """
  local count = redis.call('INCR', KEYS[1])
  redis.call('SADD', KEYS[2], ARGV[1])
  redis.call('SADD', KEYS[3], ARGV[2])
  return count
  """

  @left_script """
  local count = redis.call('DECR', KEYS[1])
  if count <= 0 then
    redis.call('DEL', KEYS[1])
    redis.call('SREM', KEYS[2], ARGV[1])
    redis.call('SREM', KEYS[3], ARGV[2])
    return 0
  end
  return count
  """

  @doc "The Lua script executed by user_joined/2."
  def joined_script, do: @joined_script

  @doc "The Lua script executed by user_left/2."
  def left_script, do: @left_script

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
  Register a new live channel for a user in a workspace, atomically.

  Runs a single Lua script that increments the channel counter and adds the
  user to both membership sets. SADD is idempotent, so opening additional
  tabs (or rejoining after a stale cleanup) self-heals set membership.
  """
  def user_joined(user_id, workspace_id) do
    case command([
           "EVAL",
           @joined_script,
           3,
           channel_count_key(user_id, workspace_id),
           workspace_users_key(workspace_id),
           user_workspaces_key(user_id),
           user_id,
           workspace_id
         ]) do
      {:ok, _count} -> :ok
      _ -> :ok
    end
  end

  @doc """
  Unregister a live channel for a user in a workspace, atomically.

  Returns `:removed` when this was the final channel and Redis membership
  was cleaned up, or `:retained` when other channels for the same
  user/workspace are still connected (or Redis is unavailable).
  """
  def user_left(user_id, workspace_id) do
    case command([
           "EVAL",
           @left_script,
           3,
           channel_count_key(user_id, workspace_id),
           workspace_users_key(workspace_id),
           user_workspaces_key(user_id),
           user_id,
           workspace_id
         ]) do
      {:ok, 0} -> :removed
      {:ok, count} when is_integer(count) -> :retained
      _ -> :retained
    end
  end

  defp command(cmd) do
    runner = Application.get_env(:presence, :redis_command_runner, RedisPubSub)
    runner.command(cmd, timeout: @command_timeout_ms)
  end
end
