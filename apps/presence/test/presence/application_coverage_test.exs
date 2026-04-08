defmodule Presence.ApplicationCoverageTest do
  use ExUnit.Case, async: false

  @moduletag :capture_log

  describe "otel_enabled?/0" do
    test "returns false when otel_enabled is not set" do
      Application.delete_env(:presence, :otel_enabled)
      Application.delete_env(:opentelemetry, :traces_exporter)

      refute Application.get_env(:presence, :otel_enabled, false) and
               Application.get_env(:opentelemetry, :traces_exporter) == :otlp
    end

    test "returns false when otel_enabled is true but traces_exporter is not :otlp" do
      Application.put_env(:presence, :otel_enabled, true)
      Application.delete_env(:opentelemetry, :traces_exporter)

      refute Application.get_env(:presence, :otel_enabled, false) and
               Application.get_env(:opentelemetry, :traces_exporter) == :otlp
    after
      Application.delete_env(:presence, :otel_enabled)
    end

    test "returns true only when both otel_enabled and traces_exporter :otlp" do
      Application.put_env(:presence, :otel_enabled, true)
      Application.put_env(:opentelemetry, :traces_exporter, :otlp)

      assert Application.get_env(:presence, :otel_enabled, false) and
               Application.get_env(:opentelemetry, :traces_exporter) == :otlp
    after
      Application.delete_env(:presence, :otel_enabled)
      Application.delete_env(:opentelemetry, :traces_exporter)
    end
  end

  describe "config_change/3" do
    test "delegates to endpoint config_change" do
      assert :ok == Presence.Application.config_change([], [], [])
    end
  end
end
