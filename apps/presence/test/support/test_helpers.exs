defmodule Presence.Test.Helpers do
  @moduledoc """
  Helper functions for testing presence service.
  """

  alias Presence.Test.Fixtures

  @doc """
  Start the presence application for integration tests.
  """
  def start_presence(opts \\ []) do
    Application.ensure_all_started(:phoenix)
    Application.ensure_all_started(:phoenix_pubsub)
    Application.ensure_all_started(:jason)
    Application.ensure_all_started(:jose)

    opts
  end

  @doc """
  Setup mock JWKS server for token verification tests.
  """
  def setup_jwks_mock(bypass, opts \\ []) do
    kid = Keyword.get(opts, :kid, "test-key-1")
    jwks = Fixtures.jwks_response(kid: kid)

    Bypass.expect(bypass, "GET", "/api/auth/jwks", fn conn ->
      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(200, Jason.encode!(jwks))
    end)
  end

  @doc """
  Create a socket for channel testing.
  """
  def socket_with_user(user_attrs \\ %{}) do
    user = Map.merge(Fixtures.user_attrs(), user_attrs)

    %Phoenix.Socket{
      assigns: %{
        user_id: user.id,
        user_name: user.name,
        user_avatar: user.avatar
      },
      id: "user_socket:#{user.id}",
      channel_pid: self(),
      endpoint: PresenceWeb.Endpoint,
      handler: PresenceWeb.UserSocket,
      ref: nil,
      topic: nil,
      transport: :websocket,
      transport_pid: self()
    }
  end

  @doc """
  Create a workspace socket for channel testing.
  """
  def socket_in_workspace(workspace_id, user_attrs \\ %{}) do
    socket = socket_with_user(user_attrs)

    %{socket | topic: "workspace:#{workspace_id}"}
    |> Phoenix.Socket.assign(:workspace_id, workspace_id)
    |> Phoenix.Socket.assign(:status, "online")
    |> Phoenix.Socket.assign(:last_activity, System.monotonic_time(:millisecond))
  end

  @doc """
  Wait for a telemetry event to be emitted.
  """
  def wait_for_telemetry(event_name, timeout \\ 1000) do
    ref = make_ref()

    :telemetry.attach(
      ref,
      event_name,
      fn _event, measurements, metadata, _config ->
        send(self(), {:telemetry_event, event_name, measurements, metadata})
      end,
      nil
    )

    receive do
      {:telemetry_event, ^event_name, measurements, metadata} ->
        :telemetry.detach(ref)
        {:ok, measurements, metadata}
    after
      timeout ->
        :telemetry.detach(ref)
        {:error, :timeout}
    end
  end

  @doc """
  Capture telemetry events for testing.
  """
  def capture_telemetry(event_names, fun) when is_list(event_names) do
    refs =
      Enum.map(event_names, fn event_name ->
        ref = make_ref()

        :telemetry.attach(
          {__MODULE__, ref},
          event_name,
          fn _event, measurements, metadata, _config ->
            send(self(), {:telemetry, ref, event_name, measurements, metadata})
          end,
          nil
        )

        {event_name, ref}
      end)

    fun.()

    events =
      Enum.flat_map(refs, fn {_event_name, ref} ->
        do_collect_telemetry(ref, [])
      end)

    Enum.reverse(events)
  end

  defp do_collect_telemetry(ref, acc) do
    receive do
      {:telemetry, ^ref, event_name, measurements, metadata} ->
        do_collect_telemetry(ref, [{event_name, measurements, metadata} | acc])
    after
      100 ->
        :telemetry.detach({__MODULE__, ref})
        acc
    end
  end

  @doc """
  Generate a unique test ID.
  """
  def unique_id do
    :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
  end
end
