defmodule PresenceWeb.ChannelCase do
  @moduledoc """
  This module defines the test case to be used by
  channel tests.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      import Phoenix.ChannelTest

      import Presence.Test.Fixtures
      import Presence.Test.Helpers

      alias Presence.Test.Fixtures

      setup_all do
        Application.ensure_all_started(:phoenix)
        Application.ensure_all_started(:phoenix_pubsub)
        :ok
      end
    end
  end

  setup _tags do
    :ok
  end
end
