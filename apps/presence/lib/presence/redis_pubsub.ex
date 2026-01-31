defmodule Presence.RedisPubSub do
  @moduledoc """
  Redis PubSub integration for broadcasting presence events to other services.
  """

  @doc """
  Broadcast a presence event to Redis.
  """
  def broadcast(channel, payload) do
    Redix.command(:redix, ["PUBLISH", channel, Jason.encode!(payload)])
  end

  @doc """
  Subscribe to presence events.
  """
  def subscribe(channels) when is_list(channels) do
    Redix.command(:redix, ["SUBSCRIBE" | channels])
  end

  def subscribe(channel) do
    subscribe([channel])
  end
end
