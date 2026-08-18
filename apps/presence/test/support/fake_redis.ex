defmodule Presence.Test.FakeRedis do
  @moduledoc """
  In-memory fake implementing the subset of Redis semantics used by
  `Presence.PresenceSets` (INCR/DECR/SADD/SREM/DEL) so tests can exercise
  reference counting without a live Redis.

  Register it as the command runner with:

      Application.put_env(:presence, :redis_command_runner, Presence.Test.FakeRedis)
  """

  use Agent

  def start_link(_opts \\ []) do
    Agent.start_link(fn -> new_state() end, name: __MODULE__)
  end

  @doc "Reset all state and the command log."
  def reset do
    Agent.update(__MODULE__, fn _ -> new_state() end)
    :ok
  end

  @doc "Clear only the command log, keeping counters and sets intact."
  def clear_log do
    Agent.update(__MODULE__, fn state -> %{state | log: []} end)
    :ok
  end

  @doc "Implements the Presence.RedisPubSub.command/2 contract."
  def command(cmd, _opts \\ []) do
    Agent.get_and_update(__MODULE__, fn state ->
      {result, state} = execute(cmd, state)
      {result, %{state | log: state.log ++ [cmd]}}
    end)
  end

  @doc "All commands executed since the last reset, in order."
  def log do
    Agent.get(__MODULE__, & &1.log)
  end

  @doc "Current members of a set key."
  def set_members(key) do
    Agent.get(__MODULE__, fn state ->
      state.sets |> Map.get(key, MapSet.new()) |> MapSet.to_list()
    end)
  end

  @doc "Current value of a counter key."
  def counter(key) do
    Agent.get(__MODULE__, fn state -> Map.get(state.counters, key, 0) end)
  end

  defp new_state do
    %{sets: %{}, counters: %{}, log: []}
  end

  defp execute(["INCR", key], state) do
    count = Map.get(state.counters, key, 0) + 1
    {{:ok, count}, %{state | counters: Map.put(state.counters, key, count)}}
  end

  defp execute(["DECR", key], state) do
    count = Map.get(state.counters, key, 0) - 1
    {{:ok, count}, %{state | counters: Map.put(state.counters, key, count)}}
  end

  defp execute(["SADD", key, member], state) do
    set = Map.get(state.sets, key, MapSet.new())
    {{:ok, 1}, %{state | sets: Map.put(state.sets, key, MapSet.put(set, member))}}
  end

  defp execute(["SREM", key, member], state) do
    set = Map.get(state.sets, key, MapSet.new())
    {{:ok, 1}, %{state | sets: Map.put(state.sets, key, MapSet.delete(set, member))}}
  end

  defp execute(["DEL", key], state) do
    {{:ok, 1},
     %{
       state
       | sets: Map.delete(state.sets, key),
         counters: Map.delete(state.counters, key)
     }}
  end

  defp execute(_cmd, state) do
    {{:ok, :ok}, state}
  end
end
