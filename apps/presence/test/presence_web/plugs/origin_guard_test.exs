defmodule PresenceWeb.Plugs.OriginGuardTest do
  use PresenceWeb.ConnCase, async: false

  alias PresenceWeb.Plugs.OriginGuard

  describe "allowed_origin?/1" do
    test "allows default web and native origins" do
      assert OriginGuard.allowed_origin?("http://localhost:3000")
      assert OriginGuard.allowed_origin?("http://127.0.0.1:3000")
      assert OriginGuard.allowed_origin?("tauri://localhost")
      assert OriginGuard.allowed_origin?("http://tauri.localhost")
      assert OriginGuard.allowed_origin?("https://tauri.localhost")
    end

    test "allows loopback aliases for local development" do
      assert OriginGuard.allowed_origin?("http://0.0.0.0:3000")
    end

    test "blocks untrusted origins" do
      refute OriginGuard.allowed_origin?("http://evil.com")
      refute OriginGuard.allowed_origin?("https://attacker.org")
      refute OriginGuard.allowed_origin?(nil)
    end
  end

  describe "call/2 plug verification" do
    setup do
      Application.put_env(:presence, :env, :dev)
      Application.put_env(:presence, :internal_api_key, "test-internal-key")

      on_exit(fn ->
        Application.put_env(:presence, :env, :test)
        Application.delete_env(:presence, :internal_api_key)
      end)

      :ok
    end

    test "allows requests with valid origin header" do
      conn =
        build_conn()
        |> put_req_header("origin", "http://localhost:3000")
        |> OriginGuard.call([])

      refute conn.halted
      assert conn.status != 403
    end

    test "allows requests with valid referer header" do
      conn =
        build_conn()
        |> put_req_header("referer", "http://localhost:3000/boards/ws-1")
        |> OriginGuard.call([])

      refute conn.halted
      assert conn.status != 403
    end

    test "blocks requests with untrusted origin" do
      conn =
        build_conn()
        |> put_req_header("origin", "http://evil.com")
        |> OriginGuard.call([])

      assert conn.halted
      assert conn.status == 403
    end

    test "blocks direct browser navigation requests (sec-fetch-dest: document)" do
      conn =
        build_conn()
        |> put_req_header("sec-fetch-dest", "document")
        |> put_req_header("sec-fetch-mode", "navigate")
        |> OriginGuard.call([])

      assert conn.halted
      assert conn.status == 403
    end

    test "allows requests with internal API key in authorization header" do
      conn =
        build_conn()
        |> put_req_header("authorization", "Bearer test-internal-key")
        |> OriginGuard.call([])

      refute conn.halted
      assert conn.status != 403
    end

    test "allows requests with internal API key in x-internal-key header" do
      conn =
        build_conn()
        |> put_req_header("x-internal-key", "test-internal-key")
        |> OriginGuard.call([])

      refute conn.halted
      assert conn.status != 403
    end

    test "allows OPTIONS CORS preflight requests" do
      conn =
        build_conn(:options, "/health")
        |> OriginGuard.call([])

      refute conn.halted
      assert conn.status != 403
    end
  end
end
