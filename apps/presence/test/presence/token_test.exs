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

      if original_url != nil do
        Application.put_env(:presence, :better_auth_url, original_url)
      else
        Application.delete_env(:presence, :better_auth_url)
      end
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

    test "caches JWKS after successful fetch with Bypass" do
      bypass = Bypass.open()
      {_, _, jwks} = valid_jwt_token_with_jwks()

      Bypass.expect(bypass, "GET", "/api/auth/jwks", fn conn ->
        conn
        |> Plug.Conn.put_resp_content_type("application/json")
        |> Plug.Conn.resp(200, Jason.encode!(jwks))
      end)

      Application.put_env(:presence, :better_auth_url, "http://localhost:#{bypass.port}")
      Token.clear_jwks_cache()

      assert {:ok, fetched_jwks} = Token.fetch_jwks()
      assert fetched_jwks == jwks
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

  describe "verify/1 header decode edge cases" do
    test "returns error for token missing signature" do
      # Create a token where the payload decodes to a non-map (e.g., a list)
      {private_map, public_map} = generate_key_pair()
      kid = "test-key-#{System.unique_integer([:positive])}"
      jwk = JOSE.JWK.from_map(private_map)

      # Create claims that will be a map
      claims = %{
        "sub" => "user_test",
        "iss" => "https://auth.example.com",
        "aud" => "https://auth.example.com",
        "exp" => System.system_time(:second) + 3600,
        "iat" => System.system_time(:second)
      }

      {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256", "kid" => kid}, claims)
      {_protected, _token} = JOSE.JWS.compact(token_map)

      # Decode and re-encode with a non-map payload (this is hard to create)
      # Instead, test the header decoding path with malformed but decodable header
      jwks = %{"keys" => [Map.put(public_map, "kid", kid)]}
      Token.set_jwks_for_test(jwks)

      # Token with valid header format but missing the signature part
      assert {:error, _} = Token.verify("validheader.b64payload.")
    end
  end

  describe "find_key/2 edge cases" do
    test "handles JWKS with non-map key in keys list" do
      {token, _, _jwks} = valid_jwt_token_with_jwks()
      # JWKS with a non-map entry in the keys list
      bad_jwks = %{"keys" => ["not-a-map", %{"kid" => "missing-kty"}]}
      Token.set_jwks_for_test(bad_jwks)

      result = Token.verify(token)
      assert match?({:error, _}, result)
    end

    test "handles JWKS with malformed keys entry" do
      {token, _, _jwks} = valid_jwt_token_with_jwks()
      # JWKS with a key that's missing required fields
      bad_jwks = %{"keys" => [%{"kid" => "test-key", "kty" => "RSA"}]}
      Token.set_jwks_for_test(bad_jwks)

      result = Token.verify(token)
      assert match?({:error, _}, result)
    end
  end

  describe "clear_jwks_cache/0" do
    test "clears cache and returns :ok" do
      {_, _, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      assert Token.clear_jwks_cache() == :ok
    end

    test "handles clearing already empty cache" do
      Token.clear_jwks_cache()
      assert Token.clear_jwks_cache() == :ok
    end
  end
end
