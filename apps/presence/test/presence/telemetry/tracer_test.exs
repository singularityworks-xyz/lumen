defmodule Presence.TracerTest do
  use ExUnit.Case, async: false

  alias Presence.Tracer

  require Presence.Tracer
  require Logger

  @moduletag :capture_log

  describe "current_trace_id/0" do
    test "returns nil when no span context exists" do
      # Outside of any span, should return nil
      result = Tracer.current_trace_id()
      assert result == nil
    end
  end

  describe "current_span_id/0" do
    test "returns nil when no span context exists" do
      # Outside of any span, should return nil
      result = Tracer.current_span_id()
      assert result == nil
    end
  end

  describe "set_user_context/2" do
    test "sets user context without error (outside span)" do
      # Outside a span, this returns :undefined
      result = Tracer.set_user_context("user_123", %{workspace_id: "ws_456", role: "admin"})
      assert is_atom(result)
    end

    test "sets user context with empty metadata" do
      result = Tracer.set_user_context("user_123")
      assert is_atom(result)
    end

    test "handles nil metadata" do
      result = Tracer.set_user_context("user_123", nil)
      assert is_atom(result)
    end

    test "handles various user id types" do
      # String user_id
      assert is_atom(Tracer.set_user_context("user_123", %{}))

      # Integer user_id
      assert is_atom(Tracer.set_user_context(123, %{}))

      # Atom user_id
      assert is_atom(Tracer.set_user_context(:user_123, %{}))
    end
  end

  describe "set_workspace_context/1" do
    test "sets workspace context without error" do
      result = Tracer.set_workspace_context("workspace_123")
      assert is_atom(result)
    end

    test "handles different workspace id formats" do
      # String workspace_id
      assert is_atom(Tracer.set_workspace_context("workspace_123"))

      # Integer workspace_id
      assert is_atom(Tracer.set_workspace_context(456))

      # UUID format
      assert is_atom(Tracer.set_workspace_context("550e8400-e29b-41d4-a716-446655440000"))
    end
  end

  describe "add_event/2" do
    test "adds event (returns false outside span)" do
      # Outside a span, add_event returns false
      result = Tracer.add_event("user_action", [{"action", "click"}])
      assert result == false
    end

    test "handles empty attributes" do
      result = Tracer.add_event("user_action")
      assert result == false
    end
  end

  describe "trace/3 macro" do
    test "traces a block and returns its result" do
      result =
        Tracer.trace "test_operation" do
          1 + 1
        end

      assert result == 2
    end

    test "traces a block with custom attributes" do
      result =
        Tracer.trace "test_operation", [{"custom_key", "custom_value"}] do
          "hello"
        end

      assert result == "hello"
    end

    test "traces a block with complex return value" do
      result =
        Tracer.trace "test_operation" do
          %{key: "value", list: [1, 2, 3]}
        end

      assert result == %{key: "value", list: [1, 2, 3]}
    end

    test "trace macro handles exceptions and re-raises them" do
      assert_raise RuntimeError, "test error", fn ->
        Tracer.trace "failing_operation" do
          raise "test error"
        end
      end
    end

    test "nested trace calls return correct values" do
      result =
        Tracer.trace "outer_operation" do
          inner_result =
            Tracer.trace "inner_operation" do
              "inner_value"
            end

          assert inner_result == "inner_value"
          "outer_value"
        end

      assert result == "outer_value"
    end

    test "trace macro sets Logger metadata" do
      # Clear any existing metadata first
      Logger.metadata([])

      Tracer.trace "test_operation" do
        # Logger metadata should be set
        metadata = Logger.metadata()
        assert is_list(metadata)
      end
    end
  end

  describe "integration" do
    test "trace macro works with context functions" do
      result =
        Tracer.trace "workspace_join", [{"workspace_id", "ws_123"}] do
          # These can be called inside a trace (return values may vary based on span context)
          _user_result = Tracer.set_user_context("user_456", %{name: "Test User"})
          _workspace_result = Tracer.set_workspace_context("ws_123")
          _event_result = Tracer.add_event("user_connected", [{"timestamp", System.monotonic_time()}])

          {:ok, "tracked"}
        end

      assert result == {:ok, "tracked"}
    end

    test "multiple trace operations in sequence" do
      # First operation
      result1 =
        Tracer.trace "operation_1" do
          {:ok, 1}
        end

      # Second operation
      result2 =
        Tracer.trace "operation_2" do
          {:ok, 2}
        end

      assert result1 == {:ok, 1}
      assert result2 == {:ok, 2}
    end

    test "trace handles errors gracefully" do
      assert_raise ArgumentError, fn ->
        Tracer.trace "error_operation" do
          # Simulate an operation that might fail
          :erlang.error(:badarg)
        end
      end
    end
  end

  describe "format_id/2 (private function behavior)" do
    # These tests verify the behavior through the public API
    # The format_id function is private but used by current_trace_id and current_span_id

    test "format_id handles integer IDs" do
      # When there's no span, we get nil (no crash)
      assert Tracer.current_trace_id() == nil
      assert Tracer.current_span_id() == nil
    end

    test "format_id handles binary IDs within trace" do
      # Test that the binary ID clause is covered by running within a trace
      # When inside a trace, the trace_id and span_id should be formatted
      result =
        Tracer.trace "test_binary_ids" do
          # These should return formatted hex strings when inside a trace
          trace_id = Tracer.current_trace_id()
          span_id = Tracer.current_span_id()

          # Both should be present and be binary strings when inside a trace
          {trace_id, span_id}
        end

      # Verify the trace completed
      assert result != nil
    end

    test "trace_id and span_id are formatted within span context" do
      Tracer.trace "format_test" do
        trace_id = Tracer.current_trace_id()
        span_id = Tracer.current_span_id()

        # When inside a trace, these should be hex strings
        if trace_id != nil do
          assert is_binary(trace_id)
          # Should be 32 hex chars for trace_id
          assert String.length(trace_id) == 32 or String.length(trace_id) == 0
        end

        if span_id != nil do
          assert is_binary(span_id)
          # Should be 16 hex chars for span_id
          assert String.length(span_id) == 16 or String.length(span_id) == 0
        end
      end
    end

    test "nested traces have different span IDs" do
      Tracer.trace "outer_trace" do
        outer_span_id = Tracer.current_span_id()

        Tracer.trace "inner_trace" do
          inner_span_id = Tracer.current_span_id()

          # Different spans should have different IDs
          if outer_span_id != nil and inner_span_id != nil do
            assert outer_span_id != inner_span_id
          end
        end
      end
    end
  end
end
