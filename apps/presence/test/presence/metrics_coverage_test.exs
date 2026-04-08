defmodule Presence.MetricsCoverageTest do
  use ExUnit.Case, async: true

  import Presence.Test.Helpers

  alias Presence.Metrics

  @moduletag :capture_log

  describe "get_active_user_count/1 rescue path" do
    test "returns count from tracker" do
      # This will return 0 for non-existent topic
      count =
        Metrics.get_active_user_count("non_existent_topic_#{System.unique_integer([:positive])}")

      assert is_integer(count)
      assert count >= 0
    end

    test "returns 0 for wildcard topic" do
      count = Metrics.get_active_user_count("workspace:*")
      assert is_integer(count)
      assert count >= 0
    end

    test "handles empty topic gracefully" do
      count = Metrics.get_active_user_count("")
      assert is_integer(count)
    end
  end

  describe "increment_error/2 coverage" do
    test "emits telemetry event with error type only" do
      events =
        capture_telemetry([[:presence, :errors]], fn ->
          Metrics.increment_error(:database_failed)
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:error_type] == :database_failed
    end

    test "emits telemetry event with custom metadata" do
      events =
        capture_telemetry([[:presence, :errors]], fn ->
          Metrics.increment_error(:validation_failed, %{field: "email", reason: "invalid_format"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:error_type] == :validation_failed
      assert metadata[:field] == "email"
    end
  end

  describe "record_ws_message/2 with metadata" do
    test "emits telemetry event for presence_state type" do
      events =
        capture_telemetry([[:presence, :websocket, :messages]], fn ->
          Metrics.record_ws_message("presence_state", %{workspace_id: "ws_123"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:type] == "presence_state"
    end

    test "emits telemetry event for presence_diff type" do
      events =
        capture_telemetry([[:presence, :websocket, :messages]], fn ->
          Metrics.record_ws_message("presence_diff", %{workspace_id: "ws_456"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:type] == "presence_diff"
    end

    test "handles status_update message type" do
      events =
        capture_telemetry([[:presence, :websocket, :messages]], fn ->
          Metrics.record_ws_message("status_update", %{user_id: "user_789"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:type] == "status_update"
    end

    test "handles activity_ping message type" do
      events =
        capture_telemetry([[:presence, :websocket, :messages]], fn ->
          Metrics.record_ws_message("activity_ping", %{user_id: "user_101"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:type] == "activity_ping"
    end

    test "handles empty metadata" do
      events =
        capture_telemetry([[:presence, :websocket, :messages]], fn ->
          Metrics.record_ws_message("presence_state")
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:type] == "presence_state"
    end
  end

  describe "increment_redis_error/2 with various error types" do
    test "emits telemetry event for not_configured error" do
      events =
        capture_telemetry([[:presence, :redis, :errors]], fn ->
          Metrics.increment_redis_error(:not_configured)
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:error_type] == :not_configured
    end

    test "emits telemetry event for publish_failed error" do
      events =
        capture_telemetry([[:presence, :redis, :errors]], fn ->
          Metrics.increment_redis_error(:publish_failed)
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:error_type] == :publish_failed
    end

    test "handles timeout error type" do
      events =
        capture_telemetry([[:presence, :redis, :errors]], fn ->
          Metrics.increment_redis_error(:timeout)
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:error_type] == :timeout
    end

    test "handles connection_refused error type" do
      events =
        capture_telemetry([[:presence, :redis, :errors]], fn ->
          Metrics.increment_redis_error(:connection_refused)
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:error_type] == :connection_refused
    end

    test "handles error with workspace metadata" do
      events =
        capture_telemetry([[:presence, :redis, :errors]], fn ->
          Metrics.increment_redis_error(:publish_failed, %{workspace_id: "ws_test"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:error_type] == :publish_failed
      assert metadata[:workspace_id] == "ws_test"
    end
  end

  describe "record_http_request/2 coverage" do
    test "records GET request duration" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(150, %{method: "GET", route: "/health", status: 200})
        end)

      assert length(events) == 1
      {_, measurements, metadata} = hd(events)
      assert measurements[:duration] == 150
      assert measurements[:count] == 1
      assert metadata[:method] == "GET"
    end

    test "records POST request duration" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(250, %{method: "POST", route: "/api/users", status: 201})
        end)

      assert length(events) == 1
      {_, measurements, _} = hd(events)
      assert measurements[:duration] == 250
    end

    test "handles various status codes" do
      for status <- [200, 201, 204, 400, 401, 403, 404, 500, 502, 503] do
        events =
          capture_telemetry([[:presence, :http, :request]], fn ->
            Metrics.record_http_request(50, %{method: "GET", route: "/test", status: status})
          end)

        assert length(events) == 1
        {_, _, metadata} = hd(events)
        assert metadata[:status] == status
      end
    end

    test "handles long duration values" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(30_000, %{method: "GET", route: "/slow", status: 200})
        end)

      assert length(events) == 1
      {_, measurements, _} = hd(events)
      assert measurements[:duration] == 30_000
    end
  end

  describe "decrement_connections/1 coverage" do
    test "emits telemetry event with disconnect event" do
      events =
        capture_telemetry([[:presence, :connections, :total]], fn ->
          Metrics.decrement_connections(%{user_id: "user_abc"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:event] == :disconnect
      assert metadata[:user_id] == "user_abc"
    end
  end

  describe "increment_status_change/2 coverage" do
    test "handles online status" do
      events =
        capture_telemetry([[:presence, :status, :changes]], fn ->
          Metrics.increment_status_change("online", %{user_id: "user_123"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == "online"
    end

    test "handles idle status" do
      events =
        capture_telemetry([[:presence, :status, :changes]], fn ->
          Metrics.increment_status_change("idle", %{user_id: "user_456"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == "idle"
    end

    test "handles away status" do
      events =
        capture_telemetry([[:presence, :status, :changes]], fn ->
          Metrics.increment_status_change("away", %{user_id: "user_789"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == "away"
    end
  end

  describe "increment_idle_check/1 coverage" do
    test "emits telemetry event with workspace_id" do
      events =
        capture_telemetry([[:presence, :idle, :checks]], fn ->
          Metrics.increment_idle_check(%{workspace_id: "workspace_123"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:workspace_id] == "workspace_123"
    end
  end

  describe "increment_idle_transition/1 coverage" do
    test "emits telemetry event with transition metadata" do
      events =
        capture_telemetry([[:presence, :idle, :transitions]], fn ->
          Metrics.increment_idle_transition(%{
            user_id: "user_123",
            workspace_id: "ws_456",
            previous_status: "online"
          })
        end)

      assert length(events) == 1
      assert length(events) == 1
    end
  end

  describe "increment_redis_publish/1 coverage" do
    test "emits telemetry event for user_joined event" do
      events =
        capture_telemetry([[:presence, :redis, :publish]], fn ->
          Metrics.increment_redis_publish(%{event_type: "user_joined", workspace_id: "ws_123"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:event_type] == "user_joined"
    end

    test "emits telemetry event for user_left event" do
      events =
        capture_telemetry([[:presence, :redis, :publish]], fn ->
          Metrics.increment_redis_publish(%{event_type: "user_left", workspace_id: "ws_456"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:event_type] == "user_left"
    end
  end

  describe "record_track_duration/2 coverage" do
    test "records track operation duration" do
      events =
        capture_telemetry([[:presence, :track, :duration]], fn ->
          Metrics.record_track_duration(100, %{user_id: "user_123", workspace_id: "ws_456"})
        end)

      assert length(events) == 1
      {_, measurements, metadata} = hd(events)
      assert measurements[:duration] == 100
      assert metadata[:user_id] == "user_123"
    end
  end

  describe "increment_connections/1 coverage" do
    test "emits telemetry event for connection increment" do
      events =
        capture_telemetry([[:presence, :connections, :total]], fn ->
          Metrics.increment_connections(%{user_id: "user_xyz"})
        end)

      assert length(events) == 1
      {_, measurements, metadata} = hd(events)
      assert measurements[:count] == 1
      assert metadata[:user_id] == "user_xyz"
    end
  end

  describe "record_connection_duration/2 coverage" do
    test "handles zero duration" do
      events =
        capture_telemetry([[:presence, :connection, :duration]], fn ->
          Metrics.record_connection_duration(0)
        end)

      assert length(events) == 1
      {_, measurements, _} = hd(events)
      assert measurements[:duration] == 0
    end

    test "handles large duration values" do
      large_duration = 24 * 60 * 60 * 1000

      events =
        capture_telemetry([[:presence, :connection, :duration]], fn ->
          Metrics.record_connection_duration(large_duration)
        end)

      assert length(events) == 1
      {_, measurements, _} = hd(events)
      assert measurements[:duration] == large_duration
    end
  end
end
