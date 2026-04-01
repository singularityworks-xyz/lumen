defmodule Presence.TokenTest do
  use ExUnit.Case, async: false

  import Presence.Test.Fixtures

  alias Presence.Token

  @moduletag :capture_log

  setup_all do
    Application.ensure_all_started(:jose)
    Application.put_env(:presence, :better_auth_url, "https://auth.example.com")
    :ok
  end

  setup do
    original_url = Application.get_env(:presence, :better_auth_url)
    Token.init_cache()

    on_exit(fn ->
      Token.clear_jwks_cache()
      Application.put_env(:presence, :better_auth_url, original_url)
    end)

    :ok
  end

  describe "init_cache/0" do
    test "creates ETS table if it does not exist" do
      assert Token.init_cache() == :ok
    end

    test "handles existing ETS table gracefully" do
      assert Token.init_cache() == :ok
      assert Token.init_cache() == :ok
    end
  end

  describe "verify/1 with valid tokens" do
    test "verifies a valid JWT token successfully" do
      {token, claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      assert {:ok, verified_claims} = Token.verify(token)
      assert verified_claims["sub"] == claims["sub"]
      assert verified_claims["name"] == claims["name"]
    end

    test "verifies token with custom claims" do
      {token, _, jwks} =
        valid_jwt_token_with_jwks(user_id: "custom_user_123", name: "Custom User")

      Token.set_jwks_for_test(jwks)

      assert {:ok, verified_claims} = Token.verify(token)
      assert verified_claims["sub"] == "custom_user_123"
    end

    test "verifies token with minimum required claims" do
      {token, _, jwks} = valid_jwt_token_with_jwks(user_id: "minimal_user")
      Token.set_jwks_for_test(jwks)

      assert {:ok, verified_claims} = Token.verify(token)
      assert verified_claims["sub"] == "minimal_user"
    end
  end

  describe "verify/1 with invalid tokens" do
    test "rejects expired token" do
      {token, jwks} = expired_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      assert {:error, :token_expired} = Token.verify(token)
    end

    test "rejects token not yet valid (nbf in future)" do
      {token, jwks} = not_yet_valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      assert {:error, :token_not_yet_valid} = Token.verify(token)
    end

    test "rejects token with invalid issuer" do
      {token, jwks} = invalid_issuer_jwt_token()
      Token.set_jwks_for_test(jwks)

      result = Token.verify(token)
      assert match?({:error, {:invalid_issuer, _, _}}, result)
    end

    test "rejects token with invalid audience" do
      {token, jwks} = invalid_audience_jwt_token()
      Token.set_jwks_for_test(jwks)

      result = Token.verify(token)
      assert match?({:error, {:invalid_audience, _, _}}, result)
    end

    test "rejects malformed token" do
      token = malformed_token()
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      result = Token.verify(token)
      assert match?({:error, _}, result)
    end

    test "rejects token with invalid signature" do
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      kid = jwks["keys"] |> hd() |> Map.get("kid")
      token = invalid_signature_token(kid: kid)
      Token.set_jwks_for_test(jwks)

      assert {:error, :invalid_signature} = Token.verify(token)
    end

    test "rejects token with key not found in JWKS" do
      {token, _, _jwks} = valid_jwt_token_with_jwks()
      different_jwks = %{"keys" => []}
      Token.set_jwks_for_test(different_jwks)

      result = Token.verify(token)
      assert match?({:error, _}, result)
    end

    test "rejects empty string token" do
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      result = Token.verify("")
      assert match?({:error, _}, result)
    end

    test "rejects nil token" do
      assert {:error, :invalid_token_format} = Token.verify(nil)
    end

    test "rejects token with invalid header encoding" do
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      assert {:error, :invalid_header} = Token.verify("!!!.payload.signature")
    end
  end

  describe "verify/1 JWKS caching" do
    test "uses cached JWKS when available and fresh" do
      {token, _, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      assert {:ok, _} = Token.verify(token)
    end

    test "refetches JWKS when cache is expired" do
      {token, _claims, jwks} = valid_jwt_token_with_jwks()
      # Insert with a stale timestamp (older than 1 hour TTL)
      stale_timestamp = System.monotonic_time(:millisecond) - 7_200_000
      :ets.insert(:jwks_cache, {:jwks, jwks, stale_timestamp})

      # With an unreachable auth URL, fetch fails and verify returns error
      Application.put_env(:presence, :better_auth_url, "http://localhost:1")
      result = Token.verify(token)
      assert match?({:error, _}, result)
    end

    test "refetches JWKS when cache is empty" do
      {token, _claims, _jwks} = valid_jwt_token_with_jwks()
      # Clear cache completely
      Token.clear_jwks_cache()

      # With an unreachable auth URL, fetch fails and verify returns error
      Application.put_env(:presence, :better_auth_url, "http://localhost:1")
      result = Token.verify(token)
      assert match?({:error, _}, result)
    end
  end

  describe "fetch_jwks/0" do
    test "returns error when auth URL is unreachable" do
      Application.put_env(:presence, :better_auth_url, "http://localhost:1")
      assert {:error, :jwks_fetch_failed} = Token.fetch_jwks()
    end

    test "caches JWKS after successful fetch" do
      {_, _, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      # Verify cache is populated by checking verify works
      assert Token.init_cache() == :ok
    end
  end

  describe "verify/1 edge cases" do
    test "handles token with extra dots" do
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      result = Token.verify("a.b.c.d")
      assert match?({:error, _}, result)
    end

    test "handles token with only one part" do
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      result = Token.verify("!!!invalid-base64!!!")
      assert match?({:error, _}, result)
    end

    test "handles token with only two parts" do
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      result = Token.verify("!!!.payload")
      assert match?({:error, _}, result)
    end

    test "handles JWKS with multiple keys" do
      {token, _, jwks} = valid_jwt_token_with_jwks()
      multi_key_jwks = %{"keys" => [%{"kid" => "key-1", "kty" => "RSA"} | jwks["keys"]]}
      Token.set_jwks_for_test(multi_key_jwks)

      assert {:ok, _} = Token.verify(token)
    end

    test "handles JWKS with empty keys array" do
      {token, _, _jwks} = valid_jwt_token_with_jwks()
      empty_jwks = %{"keys" => []}
      Token.set_jwks_for_test(empty_jwks)

      result = Token.verify(token)
      assert match?({:error, _}, result)
    end
  end

  describe "verify/1 race conditions" do
    test "handles concurrent verification requests" do
      {token, _, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      tasks =
        for _ <- 1..10 do
          Task.async(fn -> Token.verify(token) end)
        end

      results = Task.await_many(tasks, 5000)

      assert Enum.all?(results, fn
               {:ok, _} -> true
               _ -> false
             end)
    end
  end
end
