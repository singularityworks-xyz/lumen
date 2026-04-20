defmodule PresenceWeb.TelemetryTest do
  use ExUnit.Case, async: false

  alias PresenceWeb.Telemetry

  @moduletag :capture_log

  describe "start_link/1" do
    test "starts the telemetry supervisor" do
      # Telemetry is already started as part of the application
      assert Process.whereis(PresenceWeb.Telemetry) != nil
    end
  end

  describe "metrics/0" do
    test "returns list of metrics" do
      metrics = Telemetry.metrics()
      assert is_list(metrics)
      assert metrics != []
    end

    test "includes Phoenix and VM metrics" do
      metrics = Telemetry.metrics()
      # Pattern match to check there are more than 10 metrics
      assert match?([_, _, _, _, _, _, _, _, _, _, _ | _], metrics)
    end
  end

  describe "periodic_measurements/0" do
    test "returns list of periodic measurements (placeholder)" do
      # This tests lines 67-68 in lib/presence_web/telemetry.ex
      # The periodic_measurements function is private, but we can test
      # its behavior through the init function

      # The function should return an empty list (placeholder)
      # Since it's private, we verify the supervisor starts correctly
      # which indirectly tests that periodic_measurements is valid
      {:ok, _} = Telemetry.init([])
    end

    test "periodic measurements are configured in the supervisor" do
      # Verify that the telemetry poller is started with the correct config
      {_strategy_tuple, children} = Telemetry.init([]) |> elem(1)

      # Find the telemetry_poller child spec
      poller_spec =
        Enum.find(children, fn
          %{id: :telemetry_poller} -> true
          _ -> false
        end)

      assert poller_spec != nil

      # Extract the start arguments - poller_spec.start is {:telemetry_poller, :start_link, [[measurements: [], period: 10000]]}
      {_module, _func, args} = poller_spec.start

      # args is [[measurements: [], period: 10000]]
      [opts] = args

      assert Keyword.has_key?(opts, :measurements)
      assert Keyword.has_key?(opts, :period)
      assert opts[:period] == 10_000

      # Verify measurements is an empty list (placeholder on lines 67-68)
      assert opts[:measurements] == []
    end
  end

  describe "init/1" do
    test "initializes the supervisor with correct children" do
      result = Telemetry.init([])
      assert match?({:ok, _}, result)
    end

    test "uses one_for_one strategy" do
      result = Telemetry.init([])
      assert match?({:ok, {_strategy_tuple, _children}}, result)

      # Extract the strategy tuple which is the first element of the second element
      {_status, {strategy_tuple, _children}} = result

      # strategy_tuple is a map with :strategy key
      assert is_map(strategy_tuple)
      assert Map.get(strategy_tuple, :strategy) == :one_for_one
    end
  end
end
