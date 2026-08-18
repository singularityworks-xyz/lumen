defmodule Presence.Test.FakeRedis do
  @moduledoc """
  In-memory fake implementing the subset of Redis semantics used by
  `Presence.PresenceSets` (its Lua scripts, plus INCR/DECR/SADD/SREM/DEL) so
  tests can exercise reference counting without a live Redis.

  Register it as the command runner with:

      Application.put_env(:presence, :redis_command_runner, Presence.Test.FakeRedis)
  """

  use Agent

  alias Presence.PresenceSets

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

  defp execute(
         ["EVAL", script, 3, count_key, ws_key, user_key, user_id, workspace_id],
         state
       ) do
    cond do
      script == PresenceSets.joined_script() ->
        joined(state, count_key, ws_key, user_key, user_id, workspace_id)

      script == PresenceSets.left_script() ->
        left(state, count_key, ws_key, user_key, user_id, workspace_id)

      true ->
        {{:ok, :ok}, state}
    end
  end

  defp joined(state, count_key, ws_key, user_key, user_id, workspace_id) do
    count = Map.get(state.counters, count_key, 0) + 1

    state =
      state
      |> put_counter(count_key, count)
      |> add_member(ws_key, user_id)
      |> add_member(user_key, workspace_id)

    {{:ok, count}, state}
  end

  defp left(state, count_key, ws_key, user_key, user_id, workspace_id) do
    count = Map.get(state.counters, count_key, 0) - 1

    if count <= 0 do
      state =
        state
        |> then(fn s -> %{s | counters: Map.delete(s.counters, count_key)} end)
        |> remove_member(ws_key, user_id)
        |> remove_member(user_key, workspace_id)

      {{:ok, 0}, state}
    else
      {{:ok, count}, put_counter(state, count_key, count)}
    end
  end

  defp put_counter(state, key, count) do
    %{state | counters: Map.put(state.counters, key, count)}
  end

  defp add_member(state, key, member) do
    set = Map.get(state.sets, key, MapSet.new())
    %{state | sets: Map.put(state.sets, key, MapSet.put(set, member))}
  end

  defp remove_member(state, key, member) do
    set = Map.get(state.sets, key, MapSet.new())
    %{state | sets: Map.put(state.sets, key, MapSet.delete(set, member))}
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
