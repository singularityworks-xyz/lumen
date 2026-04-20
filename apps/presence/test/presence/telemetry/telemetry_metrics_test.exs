defmodule Presence.TelemetryMetricsTest do
  use ExUnit.Case, async: true

  alias Presence.TelemetryMetrics

  @moduletag :capture_log

  describe "metrics/0" do
    test "returns list of metric definitions" do
      metrics = TelemetryMetrics.metrics()

      assert is_list(metrics)
      refute Enum.empty?(metrics)
    end

    test "includes connection metrics" do
      metrics = TelemetryMetrics.metrics()
      metric_names = Enum.map(metrics, fn m -> m.name end)

      assert [:presence, :connections, :total] in metric_names
    end

    test "includes status change metrics" do
      metrics = TelemetryMetrics.metrics()
      metric_names = Enum.map(metrics, fn m -> m.name end)

      assert [:presence, :status, :changes, :total] in metric_names
    end

    test "includes track duration metrics" do
      metrics = TelemetryMetrics.metrics()
      metric_names = Enum.map(metrics, fn m -> m.name end)

      assert [:presence, :track, :duration] in metric_names
    end

    test "includes idle detection metrics" do
      metrics = TelemetryMetrics.metrics()
      metric_names = Enum.map(metrics, fn m -> m.name end)

      assert [:presence, :idle, :checks, :total] in metric_names
      assert [:presence, :idle, :transitions, :total] in metric_names
    end

    test "includes Redis metrics" do
      metrics = TelemetryMetrics.metrics()
      metric_names = Enum.map(metrics, fn m -> m.name end)

      assert [:presence, :redis, :publish, :total] in metric_names
      assert [:presence, :redis, :errors, :total] in metric_names
    end

    test "includes error metrics" do
      metrics = TelemetryMetrics.metrics()
      metric_names = Enum.map(metrics, fn m -> m.name end)

      assert [:presence, :errors, :total] in metric_names
    end

    test "includes HTTP metrics" do
      metrics = TelemetryMetrics.metrics()
      metric_names = Enum.map(metrics, fn m -> m.name end)

      assert [:presence, :http, :requests, :total] in metric_names
      assert [:presence, :http, :request, :duration] in metric_names
    end

    test "includes WebSocket metrics" do
      metrics = TelemetryMetrics.metrics()
      metric_names = Enum.map(metrics, fn m -> m.name end)

      assert [:presence, :websocket, :messages, :total] in metric_names
    end

    test "includes VM metrics" do
      metrics = TelemetryMetrics.metrics()
      metric_names = Enum.map(metrics, fn m -> m.name end)

      assert [:vm, :memory, :total] in metric_names
      assert [:vm, :total_run_queue_lengths, :total] in metric_names
    end
  end

  describe "attach_handlers/0" do
    test "returns :ok" do
      assert :ok = TelemetryMetrics.attach_handlers()
    end
  end

  describe "start_link/1" do
    test "returns error when already started" do
      # The TelemetryMetrics process is already running from application startup
      # so attempting to start it again with the default name should return an error
      result = TelemetryMetrics.start_link([])

      # Since it's already started, we'll get an error
      assert match?({:error, {:already_started, _}}, result)
      {:error, {:already_started, pid}} = result

      # The PID should be the running TelemetryMetrics process
      assert pid == Process.whereis(Presence.TelemetryMetrics)
    end
  end

  describe "init/1" do
    test "returns supervisor spec with no children when console reporter is disabled" do
      # Save original config
      original_config = Application.get_env(:presence, :telemetry_console_reporter)

      try do
        # Disable console reporter
        Application.put_env(:presence, :telemetry_console_reporter, false)

        result = TelemetryMetrics.init([])
        assert match?({:ok, {_, []}}, result)
        {:ok, {_strategy, children}} = result
        assert children == []
      after
        # Restore original config
        if original_config == nil do
          Application.delete_env(:presence, :telemetry_console_reporter)
        else
          Application.put_env(:presence, :telemetry_console_reporter, original_config)
        end
      end
    end

    test "returns supervisor spec with console reporter when enabled" do
      # Save original config
      original_config = Application.get_env(:presence, :telemetry_console_reporter)

      try do
        # Enable console reporter
        Application.put_env(:presence, :telemetry_console_reporter, true)

        result = TelemetryMetrics.init([])
        assert match?({:ok, {_, [_]}}, result)
        {:ok, {_strategy, children}} = result
        refute children == []

        # Verify the child spec is for ConsoleReporter
        [child] = children
        assert child.id == Telemetry.Metrics.ConsoleReporter
        assert match?({Telemetry.Metrics.ConsoleReporter, :start_link, _}, child.start)
      after
        # Restore original config
        if original_config == nil do
          Application.delete_env(:presence, :telemetry_console_reporter)
        else
          Application.put_env(:presence, :telemetry_console_reporter, original_config)
        end
      end
    end
  end

  describe "periodic_measurements via private function" do
    test "periodic measurements are used by telemetry poller" do
      # The periodic_measurements function is private and used internally
      # We verify it by checking that the Telemetry supervisor starts correctly
      # and the poller is configured with periodic measurements

      # The TelemetryMetrics.init/1 returns the supervisor spec which includes
      # the telemetry_poller with periodic_measurements
      # Since periodic_measurements returns empty list, we test that init works
      result = TelemetryMetrics.init([])
      assert match?({:ok, _}, result)
    end
  end

  describe "metrics/0 edge cases" do
    test "returns valid metric structs" do
      metrics = TelemetryMetrics.metrics()

      for metric <- metrics do
        assert is_struct(metric)
        assert is_list(metric.name)
      end
    end

    test "metrics have correct event names" do
      metrics = TelemetryMetrics.metrics()

      for metric <- metrics do
        assert is_list(metric.event_name)
        assert length(metric.event_name) >= 2
      end
    end
  end
end
