defmodule Presence.RedisPubSubCoverageTest do
  use ExUnit.Case, async: false

  alias Presence.RedisPubSub

  @moduletag :capture_log

  setup do
    original_url = Application.get_env(:presence, :redis_url)

    on_exit(fn ->
      if original_url do
        Application.put_env(:presence, :redis_url, original_url)
      else
        Application.delete_env(:presence, :redis_url)
      end
    end)

    :ok
  end

  describe "broadcast/2 error handling" do
    @tag skip: "Redis is now mandatory - application will fail to start without it"
    test "returns {:error, :not_configured} when Redis URL is not set" do
      # Redis is now mandatory, so this test is skipped
    end
  end
end
