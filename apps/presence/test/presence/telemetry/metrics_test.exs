defmodule Presence.MetricsTest do
  use ExUnit.Case, async: false

  import Presence.Test.Helpers

  alias Presence.Metrics

  @moduletag :capture_log

  describe "increment_connections/1" do
    test "emits telemetry event for connection increment" do
      events =
        capture_telemetry([[:presence, :connections, :total]], fn ->
          Metrics.increment_connections(%{user_id: "user_123"})
        end)

      assert length(events) == 1
      {event_name, measurements, metadata} = hd(events)
      assert event_name == [:presence, :connections, :total]
      assert measurements[:count] == 1
      assert metadata[:user_id] == "user_123"
    end

    test "emits telemetry event with default metadata" do
      events =
        capture_telemetry([[:presence, :connections, :total]], fn ->
          Metrics.increment_connections()
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      # Default is empty map, but metrics can add additional fields
      assert is_map(metadata)
    end
  end

  describe "decrement_connections/1" do
    test "emits telemetry event for connection decrement" do
      events =
        capture_telemetry([[:presence, :connections, :total]], fn ->
          Metrics.decrement_connections(%{user_id: "user_123"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:event] == :disconnect
    end
  end

  describe "record_connection_duration/2" do
    test "emits telemetry event for connection duration" do
      events =
        capture_telemetry([[:presence, :connection, :duration]], fn ->
          Metrics.record_connection_duration(5000, %{user_id: "user_123"})
        end)

      assert length(events) == 1
      {_, measurements, _} = hd(events)
      assert measurements[:duration] == 5000
    end

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

  describe "increment_status_change/2" do
    test "emits telemetry event for online status" do
      events =
        capture_telemetry([[:presence, :status, :changes]], fn ->
          Metrics.increment_status_change("online", %{user_id: "user_123"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == "online"
    end

    test "emits telemetry event for idle status" do
      events =
        capture_telemetry([[:presence, :status, :changes]], fn ->
          Metrics.increment_status_change("idle", %{user_id: "user_456"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == "idle"
    end

    test "emits telemetry event for away status" do
      events =
        capture_telemetry([[:presence, :status, :changes]], fn ->
          Metrics.increment_status_change("away", %{user_id: "user_789"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == "away"
    end
  end

  describe "record_track_duration/2" do
    test "emits telemetry event for track duration" do
      events =
        capture_telemetry([[:presence, :track, :duration]], fn ->
          Metrics.record_track_duration(100, %{user_id: "user_123", workspace_id: "ws_456"})
        end)

      assert length(events) == 1
      {_, measurements, _} = hd(events)
      assert measurements[:duration] == 100
    end
  end

  describe "increment_idle_check/1" do
    test "emits telemetry event for idle check" do
      events =
        capture_telemetry([[:presence, :idle, :checks]], fn ->
          Metrics.increment_idle_check(%{workspace_id: "workspace_123"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:workspace_id] == "workspace_123"
    end
  end

  describe "increment_idle_transition/1" do
    test "emits telemetry event for idle transition" do
      events =
        capture_telemetry([[:presence, :idle, :transitions]], fn ->
          Metrics.increment_idle_transition(%{user_id: "user_123", workspace_id: "ws_456"})
        end)

      assert length(events) == 1
      {_, measurements, _} = hd(events)
      assert measurements[:count] == 1
    end
  end

  describe "increment_redis_publish/1" do
    test "emits telemetry event for Redis publish" do
      events =
        capture_telemetry([[:presence, :redis, :publish]], fn ->
          Metrics.increment_redis_publish(%{event_type: "user_joined", workspace_id: "ws_123"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:event_type] == "user_joined"
    end
  end

  describe "increment_redis_error/2" do
    test "emits telemetry event for Redis error" do
      events =
        capture_telemetry([[:presence, :redis, :errors]], fn ->
          Metrics.increment_redis_error(:connection_failed, %{workspace_id: "ws_123"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:error_type] == :connection_failed
    end

    test "handles different error types" do
      error_types = [:timeout, :connection_refused, :auth_failed, :command_failed]

      Enum.each(error_types, fn error_type ->
        events =
          capture_telemetry([[:presence, :redis, :errors]], fn ->
            Metrics.increment_redis_error(error_type)
          end)

        assert length(events) == 1
        {_, _, metadata} = hd(events)
        assert metadata[:error_type] == error_type
      end)
    end
  end

  describe "increment_error/2" do
    test "emits telemetry event for general error" do
      events =
        capture_telemetry([[:presence, :errors]], fn ->
          Metrics.increment_error(:validation_failed, %{operation: "join"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:error_type] == :validation_failed
    end
  end

  describe "record_http_request/2" do
    test "emits telemetry event for HTTP request" do
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

    test "handles POST HTTP method" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "POST", route: "/test", status: 201})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:method] == "POST"
      assert metadata[:status] == 201
    end

    test "handles PUT HTTP method" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "PUT", route: "/test", status: 200})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:method] == "PUT"
    end

    test "handles DELETE HTTP method" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "DELETE", route: "/test", status: 204})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:method] == "DELETE"
    end

    test "handles PATCH HTTP method" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "PATCH", route: "/test", status: 200})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:method] == "PATCH"
    end

    test "handles 201 status code" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "POST", route: "/test", status: 201})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == 201
    end

    test "handles 204 status code" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "DELETE", route: "/test", status: 204})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == 204
    end

    test "handles 400 status code" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "GET", route: "/test", status: 400})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == 400
    end

    test "handles 401 status code" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "GET", route: "/test", status: 401})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == 401
    end

    test "handles 403 status code" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "GET", route: "/test", status: 403})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == 403
    end

    test "handles 404 status code" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "GET", route: "/test", status: 404})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == 404
    end

    test "handles 500 status code" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "GET", route: "/test", status: 500})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == 500
    end

    test "handles 502 status code" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "GET", route: "/test", status: 502})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == 502
    end

    test "handles 503 status code" do
      events =
        capture_telemetry([[:presence, :http, :request]], fn ->
          Metrics.record_http_request(50, %{method: "GET", route: "/test", status: 503})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:status] == 503
    end
  end

  describe "record_ws_message/2" do
    test "emits telemetry event for WebSocket message" do
      events =
        capture_telemetry([[:presence, :websocket, :messages]], fn ->
          Metrics.record_ws_message("status_update", %{user_id: "user_123"})
        end)

      assert length(events) == 1
      {_, _, metadata} = hd(events)
      assert metadata[:type] == "status_update"
    end

    test "handles different message types" do
      message_types = ["status_update", "activity_ping", "presence_state", "presence_diff"]

      for type <- message_types do
        events =
          capture_telemetry([[:presence, :websocket, :messages]], fn ->
            Metrics.record_ws_message(type)
          end)

        assert length(events) == 1
        {_, _, metadata} = hd(events)
        assert metadata[:type] == type
      end
    end
  end

  describe "get_active_user_count/1" do
    test "returns 0 when tracker returns empty list" do
      count = Metrics.get_active_user_count("non_existent_topic")
      assert count == 0
    end

    test "returns 0 for wildcard topic" do
      count = Metrics.get_active_user_count("workspace:*")
      assert is_integer(count)
      assert count >= 0
    end

    test "returns 0 when Tracker.list raises an error" do
      # Mock the Tracker.list function to throw an error
      # We do this by passing an invalid topic pattern that causes an error
      # The rescue clause should catch it and return 0
      original_tracker = Process.whereis(Presence.Tracker)

      # Stop the tracker to simulate an error condition
      if original_tracker do
        Process.exit(original_tracker, :kill)
        # Wait for process to terminate
        Process.sleep(50)
      end

      count = Metrics.get_active_user_count("workspace:*")
      assert is_integer(count)
      assert count == 0

      # Restart tracker for other tests
      Application.ensure_all_started(:presence)
    end
  end

  describe "concurrent metric operations" do
    test "handles concurrent metric emissions" do
      tasks =
        for i <- 1..50 do
          Task.async(fn ->
            Metrics.increment_connections(%{user_id: "user_#{i}"})
            Metrics.increment_status_change("online", %{user_id: "user_#{i}"})
          end)
        end

      results = Task.await_many(tasks, 5000)
      assert length(results) == 50
    end
  end
end
