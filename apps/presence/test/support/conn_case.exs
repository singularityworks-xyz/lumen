defmodule PresenceWeb.ConnCase do
  @moduledoc """
  This module defines the test case to be used by
  tests that require setting up a connection.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      use Phoenix.ConnTest

      import Presence.Test.Fixtures
      import Presence.Test.Helpers

      alias Presence.Test.Fixtures

      @endpoint PresenceWeb.Endpoint

      setup_all do
        Application.ensure_all_started(:phoenix)
        Application.ensure_all_started(:phoenix_pubsub)
        :ok
      end
    end
  end

  setup _tags do
    {:ok, conn: Phoenix.ConnTest.build_conn()}
  end
end
