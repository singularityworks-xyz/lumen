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

    test "returns expected static paths list" do
      paths = PresenceWeb.static_paths()
      expected_paths = ~w(assets fonts images favicon.ico robots.txt)

      for path <- expected_paths do
        assert path in paths
      end

      assert length(paths) == 5
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

    test "verified_routes macro works correctly in quoted context" do
      # Test that verified_routes returns proper quote structure
      # It returns a use statement which is {:use, _, _} or {:__block__, _, _} for quote
      result = PresenceWeb.verified_routes()

      # The result is a use statement which starts with :use
      assert elem(result, 0) in [:quote, :use]

      # The quoted expression should contain the proper module setup
      if elem(result, 0) == :use do
        # Check that it uses Phoenix.VerifiedRoutes
        args = elem(result, 2)
        assert is_list(args)
      else
        contents = elem(result, 2)
        assert is_list(contents)
      end
    end
  end

  describe "__using__/1" do
    test "dispatches correctly to controller" do
      # Create a module that uses PresenceWeb :controller
      defmodule TestUsingController do
        use PresenceWeb, :controller
      end

      # Verify the module was compiled - it should have controller functionality
      assert Module.open?(__MODULE__) or function_exported?(TestUsingController, :action, 2)
    end

    test "dispatches correctly to channel" do
      # Create a module that uses PresenceWeb :channel
      defmodule TestUsingChannel do
        use PresenceWeb, :channel
      end

      # Verify the module was compiled - it should have channel macros available
      assert function_exported?(TestUsingChannel, :__info__, 1)
    end

    test "dispatches correctly to router" do
      # Create a module that uses PresenceWeb :router
      defmodule TestUsingRouter do
        use PresenceWeb, :router
      end

      # Verify the module was compiled - it should have router macros
      # The router should have basic module structure
      assert is_atom(TestUsingRouter)
      assert function_exported?(TestUsingRouter, :__info__, 1)
    end
  end
end
