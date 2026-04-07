defmodule Presence.ApplicationTest do
  use ExUnit.Case, async: true

  describe "config_change/3" do
    test "returns :ok when called with empty changes" do
      assert Presence.Application.config_change([], [], []) == :ok
    end

    test "returns :ok when called with changed and removed configs" do
      changed = [{PresenceWeb.Endpoint, [url: [host: "new-host"]]}]
      removed = [{PresenceWeb.Endpoint, [url: [host: "old-host"]]}]
      assert Presence.Application.config_change(changed, removed, []) == :ok
    end
  end
end
