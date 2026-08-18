defmodule Presence.Test.FailingRedisRunner do
  @moduledoc """
  Test double implementing the `Presence.RedisPubSub.command/2` contract and
  always failing, simulating an unavailable Redis.
  """

  def command(_cmd, _opts \\ []), do: {:error, :not_started}
end
