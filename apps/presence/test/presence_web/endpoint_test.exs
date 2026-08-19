defmodule PresenceWeb.EndpointTest do
  use ExUnit.Case, async: true

  alias PresenceWeb.Endpoint

  describe "log_level/1" do
    test "returns false for health probe paths" do
      assert Endpoint.log_level(%{path_info: ["health"]}) == false
      assert Endpoint.log_level(%{path_info: ["health", "liveness"]}) == false
    end

    test "returns :info for normal request paths" do
      assert Endpoint.log_level(%{path_info: ["api", "v1", "presence"]}) == :info
      assert Endpoint.log_level(%{path_info: ["socket"]}) == :info
    end
  end
end
