defmodule Presence.Logger do
  @moduledoc """
  Comprehensive logging module for the presence service.

  Provides environment-aware logging with:
  - Development: Pretty console output with colors
  - Production: JSON structured logs for Loki ingestion
  - Six log levels: trace, debug, info, warn, error, fatal
  - Automatic trace context injection
  - Consistent metadata formatting

  ## Examples

      Presence.Logger.info("User joined workspace",
        user_id: user_id,
        workspace_id: workspace_id
      )

      Presence.Logger.error("Failed to track user",
        user_id: user_id,
        error: error_message
      )
  """

  require Logger

  @log_levels %{
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5
  }

  @doc """
  Log a trace message (most verbose, development only).
  """
  def trace(message, metadata \\ []) do
    log(:trace, message, metadata)
  end

  @doc """
  Log a debug message.
  """
  def debug(message, metadata \\ []) do
    log(:debug, message, metadata)
  end

  @doc """
  Log an info message.
  """
  def info(message, metadata \\ []) do
    log(:info, message, metadata)
  end

  @doc """
  Log a warning message.
  """
  def warn(message, metadata \\ []) do
    log(:warning, message, metadata)
  end

  @doc """
  Log an error message.
  """
  def error(message, metadata \\ []) do
    log(:error, message, metadata)
  end

  @doc """
  Log a fatal message (critical errors).
  """
  def fatal(message, metadata \\ []) do
    log(:error, "[FATAL] " <> message, metadata)
  end

  @doc """
  Get the current configured log level.
  """
  def current_level do
    Application.get_env(:logger, :level, :info)
  end

  @doc """
  Check if a log level is enabled.
  """
  def level_enabled?(level) do
    current_level_num = Map.get(@log_levels, current_level(), 2)
    target_level_num = Map.get(@log_levels, level, 2)
    target_level_num >= current_level_num
  end

  # Private implementation

  defp log(level, message, metadata) when is_atom(level) do
    if level_enabled?(level) do
      enriched_metadata = enrich_metadata(metadata)
      logger_level = normalize_level(level)
      Logger.log(logger_level, message, enriched_metadata)
    end
  end

  defp normalize_level(:trace), do: :debug
  defp normalize_level(:warn), do: :warning
  defp normalize_level(:fatal), do: :error
  defp normalize_level(level), do: level

  defp enrich_metadata(metadata) do
    metadata
    |> add_trace_context()
    |> add_service_context()
    |> Keyword.new()
  end

  defp add_trace_context(metadata) do
    case Presence.Tracer.current_trace_id() do
      nil -> metadata
      trace_id -> Keyword.put(metadata, :trace_id, trace_id)
    end
  end

  defp add_service_context(metadata) do
    Keyword.put_new(metadata, :service, "presence-service")
  end
end
