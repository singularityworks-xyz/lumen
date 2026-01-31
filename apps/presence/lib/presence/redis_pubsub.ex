defmodule Presence.RedisPubSub do
  @moduledoc """
  Redis PubSub integration using Upstash REST API for broadcasting presence events.
  """

  require Logger

  @doc """
  Broadcast a presence event to Redis using Upstash REST API.
  """
  def broadcast(channel, payload) do
    url = get_redis_url()
    token = get_redis_token()

    # Upstash REST API uses Redis commands in a pipeline format
    # PUBLISH command to broadcast to a channel
    commands = [
      ["PUBLISH", channel, Jason.encode!(payload)]
    ]

    headers = [
      {"Authorization", "Bearer #{token}"},
      {"Content-Type", "application/json"}
    ]

    case HTTPoison.post(url, Jason.encode!(commands), headers) do
      {:ok, %{status_code: 200, body: body}} ->
        Logger.debug("Redis PUBLISH successful", channel: channel)
        {:ok, Jason.decode!(body)}

      {:ok, %{status_code: status, body: body}} ->
        Logger.error("Redis PUBLISH failed", status: status, body: body)
        {:error, :publish_failed}

      {:error, reason} ->
        Logger.error("Redis PUBLISH HTTP error", reason: inspect(reason))
        {:error, :http_error}
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
  def command(commands) when is_list(commands) do
    url = get_redis_url()
    token = get_redis_token()

    headers = [
      {"Authorization", "Bearer #{token}"},
      {"Content-Type", "application/json"}
    ]

    case HTTPoison.post(url, Jason.encode!(commands), headers) do
      {:ok, %{status_code: 200, body: body}} ->
        {:ok, Jason.decode!(body)}

      {:ok, %{status_code: status, body: body}} ->
        Logger.error("Redis command failed", status: status, body: body)
        {:error, :command_failed}

      {:error, reason} ->
        Logger.error("Redis command HTTP error", reason: inspect(reason))
        {:error, :http_error}
    end
  end

  defp get_redis_url do
    Application.get_env(:presence, :upstash_redis_rest_url) ||
      System.get_env("UPSTASH_REDIS_REST_URL") ||
      ""
  end

  defp get_redis_token do
    Application.get_env(:presence, :upstash_redis_rest_token) ||
      System.get_env("UPSTASH_REDIS_REST_TOKEN") ||
      ""
  end
end
