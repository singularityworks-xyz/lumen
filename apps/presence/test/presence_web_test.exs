defmodule PresenceWebTest do
  use ExUnit.Case, async: true

  describe "static_paths/0" do
    test "returns a list of static asset paths" do
      paths = PresenceWeb.static_paths()
      assert is_list(paths)
      assert "assets" in paths
      assert "favicon.ico" in paths
      assert "robots.txt" in paths
    end

    test "includes fonts and images directories" do
      paths = PresenceWeb.static_paths()
      assert "fonts" in paths
      assert "images" in paths
    end
  end

  describe "router/0" do
    test "returns a quoted expression" do
      result = PresenceWeb.router()
      assert is_tuple(result)
      assert tuple_size(result) == 3
    end
  end

  describe "channel/0" do
    test "returns a quoted expression" do
      result = PresenceWeb.channel()
      assert is_tuple(result)
      assert tuple_size(result) == 3
    end
  end

  describe "controller/0" do
    test "returns a quoted expression" do
      result = PresenceWeb.controller()
      assert is_tuple(result)
      assert tuple_size(result) == 3
    end
  end

  describe "verified_routes/0" do
    test "returns a quoted expression" do
      result = PresenceWeb.verified_routes()
      assert is_tuple(result)
      assert tuple_size(result) == 3
    end
  end
end
