defmodule Presence.RedisPubSub do
  @moduledoc """
  Redis PubSub integration using Upstash REST API for broadcasting presence events.
  """

  require Logger

  # Allow dependency injection for testing
  @default_opts [env_getter: &__MODULE__.env_getter/1]

  @doc """
  Broadcast a presence event to Redis using Upstash REST API.
  """
  def broadcast(channel, payload, opts \\ []) do
    env_getter = Keyword.get(opts, :env_getter, @default_opts[:env_getter])
    url = get_redis_url(env_getter)
    token = get_redis_token(env_getter)

    if url == "" or token == "" do
      Logger.warning("Redis not configured, skipping broadcast", channel: channel)
      {:error, :not_configured}
    else
      # Upstash REST API: POST to base URL with flat array for single command
      command = ["PUBLISH", channel, Jason.encode!(payload)]

      headers = [
        {"Authorization", "Bearer #{token}"},
        {"Content-Type", "application/json"}
      ]

      case Req.post(url, json: command, headers: headers) do
        {:ok, %{status: 200, body: body}} ->
          Logger.debug("Redis PUBLISH successful", channel: channel)
          {:ok, body}

        {:ok, %{status: status, body: body}} ->
          Logger.error("Redis PUBLISH failed", status: status, body: inspect(body))
          {:error, :publish_failed}

        {:error, reason} ->
          Logger.error("Redis PUBLISH HTTP error", reason: inspect(reason))
          {:error, :http_error}
      end
    end
  end

  @doc """
  Subscribe to presence events.
  Note: For REST API, subscriptions are typically done via webhooks or polling.
  This is a placeholder for compatibility.
  """
  def subscribe(_channels) do
    # REST API doesn't support real-time subscriptions like Redis protocol
    # Elysia workers should poll or use webhooks instead
    Logger.warning("Redis SUBSCRIBE not supported via REST API - use polling instead")
    {:ok, :not_supported}
  end

  @doc """
  Execute a Redis command via Upstash REST API.
  """
  def command(cmd, opts \\ []) when is_list(cmd) do
    env_getter = Keyword.get(opts, :env_getter, @default_opts[:env_getter])
    url = get_redis_url(env_getter)
    token = get_redis_token(env_getter)

    if url == "" or token == "" do
      Logger.warning("Redis not configured, skipping command")
      {:error, :not_configured}
    else
      headers = [
        {"Authorization", "Bearer #{token}"},
        {"Content-Type", "application/json"}
      ]

      case Req.post(url, json: cmd, headers: headers) do
        {:ok, %{status: 200, body: body}} ->
          {:ok, body}

        {:ok, %{status: status, body: body}} ->
          Logger.error("Redis command failed", status: status, body: inspect(body))
          {:error, :command_failed}

        {:error, reason} ->
          Logger.error("Redis command HTTP error", reason: inspect(reason))
          {:error, :http_error}
      end
    end
  end

  defp get_redis_url(env_getter) do
    Application.get_env(:presence, :upstash_redis_rest_url) ||
      env_getter.("UPSTASH_REDIS_REST_URL") ||
      ""
  end

  defp get_redis_token(env_getter) do
    Application.get_env(:presence, :upstash_redis_rest_token) ||
      env_getter.("UPSTASH_REDIS_REST_TOKEN") ||
      ""
  end

  # Default environment getter - reads from System environment
  def env_getter(key) do
    System.get_env(key)
  end
end
