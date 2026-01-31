defmodule Presence.Telemetry do
  @moduledoc """
  Telemetry handlers for presence operations and OpenTelemetry integration.
  """

  require Logger

  @doc """
  Attach telemetry handlers for presence events.
  """
  def attach_handlers do
    :telemetry.attach_many(
      "presence-telemetry",
      [
        [:presence, :track],
        [:presence, :update_status],
        [:presence, :user_joined],
        [:presence, :user_left]
      ],
      &__MODULE__.handle_event/4,
      %{}
    )
  end

  @doc """
  Handle presence telemetry events.
  """
  def handle_event([:presence, :track], measurements, metadata, _config) do
    Logger.info("User tracked in presence",
      user_id: metadata[:user_id],
      workspace_id: metadata[:workspace_id],
      duration_ms: measurements[:duration] / 1_000_000
    )
  end

  def handle_event([:presence, :update_status], _measurements, metadata, _config) do
    Logger.info("User status updated",
      user_id: metadata[:user_id],
      workspace_id: metadata[:workspace_id],
      status: metadata[:status]
    )
  end

  def handle_event([:presence, :user_joined], _measurements, metadata, _config) do
    Logger.info("User joined workspace",
      user_id: metadata[:user_id],
      workspace_id: metadata[:workspace_id]
    )
  end

  def handle_event([:presence, :user_left], _measurements, metadata, _config) do
    Logger.info("User left workspace",
      user_id: metadata[:user_id],
      workspace_id: metadata[:workspace_id]
    )
  end
end
