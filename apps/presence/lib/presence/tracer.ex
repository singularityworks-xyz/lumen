defmodule Presence.Tracer do
  @moduledoc """
  Helper module for consistent OpenTelemetry tracing across the presence service.
  """

  require OpenTelemetry.Tracer
  require Logger

  @doc """
  Execute a block of code within a traced span.
  """
  defmacro trace(operation_name, attrs \\ [], do: block) do
    quote do
      OpenTelemetry.Tracer.with_span unquote(operation_name) do
        # Set default attributes
        OpenTelemetry.Tracer.set_attributes([
          {"service.name", "presence-service"},
          {"operation", unquote(operation_name)}
        ])

        Logger.metadata(
          trace_id: Presence.Tracer.current_trace_id(),
          span_id: Presence.Tracer.current_span_id()
        )

        # Set custom attributes
        OpenTelemetry.Tracer.set_attributes(unquote(attrs))

        try do
          result = unquote(block)
          OpenTelemetry.Tracer.set_attribute("result", "success")
          result
        rescue
          e ->
            OpenTelemetry.Tracer.record_exception(e, __STACKTRACE__)
            OpenTelemetry.Tracer.set_attribute("result", "error")
            reraise e, __STACKTRACE__
        end
      end
    end
  end

  @doc """
  Set user context for the current trace.
  """
  def set_user_context(user_id, metadata \\ %{}) do
    OpenTelemetry.Tracer.set_attributes([
      {"user.id", user_id},
      {"user.metadata", Jason.encode!(metadata)}
    ])

    # Also set in Logger metadata for structured logging
    Logger.metadata(user_id: user_id)
  end

  @doc """
  Set workspace context for the current trace.
  """
  def set_workspace_context(workspace_id) do
    OpenTelemetry.Tracer.set_attribute("workspace.id", workspace_id)
    Logger.metadata(workspace_id: workspace_id)
  end

  @doc """
  Add an event to the current span.
  """
  def add_event(name, attributes \\ []) do
    OpenTelemetry.Tracer.add_event(name, attributes)
  end

  @doc """
  Get the current trace ID for logging correlation.
  """
  def current_trace_id do
    case OpenTelemetry.Tracer.current_span_ctx() do
      :undefined ->
        nil

      span_ctx ->
        trace_id = OpenTelemetry.Span.trace_id(span_ctx)
        format_id(trace_id, 32)
    end
  end

  @doc """
  Get the current span ID for logging correlation.
  """
  def current_span_id do
    case OpenTelemetry.Tracer.current_span_ctx() do
      :undefined ->
        nil

      span_ctx ->
        span_id = OpenTelemetry.Span.span_id(span_ctx)
        format_id(span_id, 16)
    end
  end

  # Convert integer ID to hex string with proper padding
  defp format_id(id, length) when is_integer(id) do
    id
    |> Integer.to_string(16)
    |> String.downcase()
    |> String.pad_leading(length, "0")
  end

  defp format_id(id, _length) when is_binary(id) do
    Base.encode16(id, case: :lower)
  end
end
