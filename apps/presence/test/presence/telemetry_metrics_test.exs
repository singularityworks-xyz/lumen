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
end
