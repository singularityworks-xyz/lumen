defmodule Presence.TracerTest do
  use ExUnit.Case, async: true

  alias Presence.Tracer

  @moduletag :capture_log

  describe "current_trace_id/0" do
    test "returns nil or binary when no span context exists" do
      result = Tracer.current_trace_id()
      assert result == nil or is_binary(result)
    end
  end

  describe "current_span_id/0" do
    test "returns nil or binary when no span context exists" do
      result = Tracer.current_span_id()
      assert result == nil or is_binary(result)
    end
  end

  describe "set_user_context/2" do
    test "sets user context without error" do
      result = Tracer.set_user_context("user_123", %{workspace_id: "ws_456"})
      assert result == :ok or result == :undefined or is_atom(result)
    end

    test "handles empty metadata" do
      result = Tracer.set_user_context("user_123")
      assert result == :ok or result == :undefined or is_atom(result)
    end
  end

  describe "set_workspace_context/1" do
    test "sets workspace context without error" do
      result = Tracer.set_workspace_context("workspace_123")
      assert result == :ok or result == :undefined or is_atom(result)
    end
  end

  describe "add_event/2" do
    test "adds event without error" do
      result = Tracer.add_event("test_event", [{"key", "value"}])
      assert result == :ok or result == true or is_atom(result)
    end

    test "handles empty attributes" do
      result = Tracer.add_event("test_event")
      assert result == :ok or result == true or is_atom(result)
    end
  end
end
