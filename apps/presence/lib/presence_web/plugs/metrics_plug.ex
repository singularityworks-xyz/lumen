defmodule PresenceWeb.Plugs.MetricsPlug do
  @moduledoc """
  Plug for collecting HTTP request metrics.

  Records:
  - Request count by method, route, and status code
  - Request duration histogram
  - Error tracking

  Similar to the workers app's otel-metrics middleware.
  """

  import Plug.Conn
  require Logger

  @doc """
  Initializes the plug.
  """
  def init(opts), do: opts

  @doc """
  Records metrics for each HTTP request.
  """
  def call(conn, _opts) do
    start_time = System.monotonic_time(:millisecond)

    conn
    |> register_before_send(fn conn ->
      duration_ms = System.monotonic_time(:millisecond) - start_time
      record_metrics(conn, duration_ms)
      conn
    end)
  end

  defp record_metrics(conn, duration_ms) do
    route = normalize_path(conn.request_path)

    # Skip metrics for infrastructure probe endpoints
    if route in ["/health", "/"] do
      :ok
    else
      method = conn.method
      status = conn.status

      metadata = %{
        method: method,
        route: route,
        status: status
      }

      # Record the request metric
      Presence.Metrics.record_http_request(duration_ms, metadata)

      # Log slow requests (over 1 second)
      if duration_ms > 1000 do
        Logger.warning("Slow HTTP request",
          method: method,
          route: route,
          status: status,
          duration_ms: duration_ms
        )
      end

      # Log errors (5xx status codes)
      if status >= 500 do
        Logger.error("HTTP request error",
          method: method,
          route: route,
          status: status,
          duration_ms: duration_ms
        )
      end
    end
  end

  # Normalize paths to prevent high cardinality in metrics
  # Replace UUIDs, numeric IDs, and hashes with placeholders
  defp normalize_path(path) do
    path
    # Replace UUIDs
    |> String.replace(~r/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, ":id", global: true)
    # Replace numeric IDs (but not version numbers like v1, v2)
    |> String.replace(~r/(?<!v)\/[0-9]+/, "/:id", global: true)
    # Replace hex strings longer than 8 chars (likely hashes)
    |> String.replace(~r/[0-9a-f]{16,}/i, ":hash", global: true)
  end
end
