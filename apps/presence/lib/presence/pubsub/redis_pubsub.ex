defmodule Presence.RedisPubSub do
  @moduledoc """
  Redis PubSub integration using standard Redis protocol for broadcasting presence events.
  """

  require Logger

  @pool_name :redis_pool

  # Allow dependency injection for testing
  @default_opts [env_getter: &__MODULE__.env_getter/1]

  @doc """
  Broadcast a presence event to Redis using standard Redis protocol.
  """
  def broadcast(channel, payload, opts \\ []) do
    env_getter = Keyword.get(opts, :env_getter, @default_opts[:env_getter])
    redis_url = get_redis_url(env_getter)

    cond do
      redis_url == "" ->
        Logger.warning("Redis not configured, skipping broadcast", channel: channel)
        {:error, :not_configured}

      is_nil(Process.whereis(@pool_name)) ->
        {:error, :not_started}

      true ->
        do_broadcast(channel, payload)
    end
  end

  defp do_broadcast(channel, payload) do
    command = ["PUBLISH", channel, Jason.encode!(payload)]

    case Redix.command(@pool_name, command) do
      {:ok, _result} ->
        Logger.debug("Redis PUBLISH successful", channel: channel)
        {:ok, :published}

      {:error, reason} ->
        Logger.error("Redis PUBLISH failed", reason: inspect(reason))
        {:error, :publish_failed}
    end
  end

  @doc """
  Subscribe to presence events.
  Note: For Phoenix, subscriptions are handled via pubsub adapters.
  This is a placeholder for compatibility.
  """
  def subscribe(_channels) do
    # Phoenix handles subscriptions via pubsub adapters
    Logger.warning("Redis SUBSCRIBE should be handled via Phoenix pubsub adapter")
    {:ok, :not_supported}
  end

  @doc """
  Execute a Redis command via standard Redis protocol.

  Accepts the same options as `Redix.command/3` (e.g. `:timeout`), forwarded
  as-is when no special handling is required.
  """
  def command(cmd, opts \\ []) when is_list(cmd) do
    env_getter = Keyword.get(opts, :env_getter, @default_opts[:env_getter])
    redix_opts = Keyword.drop(opts, [:env_getter])
    redis_url = get_redis_url(env_getter)

    cond do
      redis_url == "" ->
        Logger.warning("Redis not configured, skipping command")
        {:error, :not_configured}

      is_nil(Process.whereis(@pool_name)) ->
        {:error, :not_started}

      true ->
        do_command(cmd, redix_opts)
    end
  end

  defp do_command(cmd, redix_opts) do
    case Redix.command(@pool_name, cmd, redix_opts) do
      {:ok, result} ->
        {:ok, result}

      {:error, reason} ->
        Logger.error("Redis command failed", reason: inspect(reason))
        {:error, :command_failed}
    end
  end

  defp get_redis_url(env_getter) do
    Application.get_env(:presence, :redis_url) ||
      env_getter.("REDIS_URL") ||
      ""
  end

  # Default environment getter - reads from System environment
  def env_getter(key) do
    System.get_env(key)
  end
end
