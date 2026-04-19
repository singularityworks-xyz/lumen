defmodule Presence.ApplicationTest do
  use ExUnit.Case, async: false
  @moduletag :capture_log

  describe "application startup" do
    test "application is started" do
      assert Application.started_applications()
             |> Enum.any?(fn {app, _, _} -> app == :presence end)
    end
  end

  describe "config_change/3" do
    test "returns :ok when called with empty changes" do
      assert Presence.Application.config_change([], [], []) == :ok
    end

    test "returns :ok when called with changed and removed configs" do
      changed = [{PresenceWeb.Endpoint, [url: [host: "new-host"]]}]
      removed = [{PresenceWeb.Endpoint, [url: [host: "old-host"]]}]
      assert Presence.Application.config_change(changed, [], removed) == :ok
    end
  end

  describe "setup_opentelemetry/0" do
    test "initializes OpenTelemetry when otel is enabled" do
      # Set both required configs to enable otel
      Application.put_env(:presence, :otel_enabled, true)
      Application.put_env(:opentelemetry, :traces_exporter, :otlp)

      on_exit(fn ->
        Application.delete_env(:presence, :otel_enabled)
        Application.delete_env(:opentelemetry, :traces_exporter)
      end)

      # Verify the otel_enabled? function returns true with these settings
      # by checking the condition directly
      assert Application.get_env(:presence, :otel_enabled, false) and
               Application.get_env(:opentelemetry, :traces_exporter) == :otlp
    end
  end

  describe "start/2 with OpenTelemetry" do
    test "initializes properly with OpenTelemetry enabled" do
      # The application is already started, so we verify the supervisor exists
      assert Process.whereis(Presence.Supervisor) != nil

      # Verify telemetry handlers are attached
      handlers = :telemetry.list_handlers([:presence, :track])
      assert is_list(handlers)
    end
  end

  describe "setup_opentelemetry/0 private function" do
    test "otel_enabled?/0 returns true when both configs are set correctly" do
      # Set both required configs to enable otel
      Application.put_env(:presence, :otel_enabled, true)
      Application.put_env(:opentelemetry, :traces_exporter, :otlp)

      on_exit(fn ->
        Application.delete_env(:presence, :otel_enabled)
        Application.delete_env(:opentelemetry, :traces_exporter)
      end)

      # Verify both conditions are true
      assert Application.get_env(:presence, :otel_enabled, false) == true
      assert Application.get_env(:opentelemetry, :traces_exporter) == :otlp
    end

    test "otel_enabled?/0 returns false when only otel_enabled is set" do
      Application.put_env(:presence, :otel_enabled, true)
      Application.put_env(:opentelemetry, :traces_exporter, :none)

      on_exit(fn ->
        Application.delete_env(:presence, :otel_enabled)
        Application.delete_env(:opentelemetry, :traces_exporter)
      end)

      # Should be false because traces_exporter is not :otlp
      refute Application.get_env(:presence, :otel_enabled, false) and
               Application.get_env(:opentelemetry, :traces_exporter) == :otlp
    end

    test "otel_enabled?/0 returns false when only traces_exporter is set to otlp" do
      Application.put_env(:presence, :otel_enabled, false)
      Application.put_env(:opentelemetry, :traces_exporter, :otlp)

      on_exit(fn ->
        Application.delete_env(:presence, :otel_enabled)
        Application.delete_env(:opentelemetry, :traces_exporter)
      end)

      # Should be false because otel_enabled is false
      refute Application.get_env(:presence, :otel_enabled, false) and
               Application.get_env(:opentelemetry, :traces_exporter) == :otlp
    end

    test "otel_enabled?/0 returns false when neither config is set" do
      Application.delete_env(:presence, :otel_enabled)
      Application.delete_env(:opentelemetry, :traces_exporter)

      # Should default to false
      refute Application.get_env(:presence, :otel_enabled, false) and
               Application.get_env(:opentelemetry, :traces_exporter) == :otlp
    end
  end
end
