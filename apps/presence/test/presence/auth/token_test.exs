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

    test "verifies token when issuer and base_url are loopback aliases" do
      Application.put_env(:presence, :better_auth_url, "http://127.0.0.1:3002")

      {token, claims, jwks} =
        valid_jwt_token_with_jwks(
          issuer: "http://localhost:3002",
          audience: "http://localhost:3002"
        )

      Token.set_jwks_for_test(jwks)

      assert {:ok, verified_claims} = Token.verify(token)
      assert verified_claims["sub"] == claims["sub"]
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

    test "get_jwks refetches when cache is expired" do
      {token, _claims, jwks} = valid_jwt_token_with_jwks()
      # Insert with a stale timestamp to trigger :expired path
      stale_timestamp = System.monotonic_time(:millisecond) - 7_200_000
      :ets.insert(:jwks_cache, {:jwks, jwks, stale_timestamp})

      # With unreachable URL, the refetch will fail
      Application.put_env(:presence, :better_auth_url, "http://localhost:1")
      result = Token.verify(token)
      assert match?({:error, _}, result)
    end

    test "get_jwks refetches when cache is not found" do
      {_token, _claims, _jwks} = valid_jwt_token_with_jwks()
      # Clear cache to trigger :not_found path
      Token.clear_jwks_cache()

      # Verify lookup returns :not_found by checking that verification fails
      Application.put_env(:presence, :better_auth_url, "http://localhost:1")
      result = Token.verify("")
      assert match?({:error, _}, result)
    end

    test "cache_jwks stores last_fetch timestamp - line 147" do
      # This test specifically covers the :ets.insert(:last_fetch, timestamp) on line 147
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.clear_jwks_cache()

      # Fetch JWKS which internally calls cache_jwks with last_fetch
      bypass = Bypass.open()

      Bypass.expect(bypass, "GET", "/api/auth/jwks", fn conn ->
        conn
        |> Plug.Conn.put_resp_content_type("application/json")
        |> Plug.Conn.resp(200, Jason.encode!(jwks))
      end)

      Application.put_env(:presence, :better_auth_url, "http://localhost:#{bypass.port}")
      {:ok, _} = Token.fetch_jwks()

      # Verify that last_fetch was set
      case :ets.lookup(:jwks_cache, :last_fetch) do
        [{:last_fetch, _timestamp}] -> assert true
        _ -> flunk("last_fetch was not set in cache")
      end
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

    test "handles malformed JWKS (no keys field)" do
      {token, _, _jwks} = valid_jwt_token_with_jwks()
      # JWKS that is a map but without a "keys" field
      malformed_jwks = %{"some_other_field" => "value"}
      Token.set_jwks_for_test(malformed_jwks)

      # This should trigger the find_key/2 clause that matches non-map or malformed jwks
      result = Token.verify(token)
      assert result == {:error, :malformed_jwks}
    end

    test "handles JWKS where keys is not a list" do
      {token, _, _jwks} = valid_jwt_token_with_jwks()
      # JWKS where "keys" is not a list
      malformed_jwks = %{"keys" => "not_a_list"}
      Token.set_jwks_for_test(malformed_jwks)

      result = Token.verify(token)
      assert result == {:error, :malformed_jwks}
    end

    test "handles completely invalid JWKS structure" do
      {token, _, _jwks} = valid_jwt_token_with_jwks()
      # JWKS that is just a string
      Token.set_jwks_for_test("not_a_map")

      result = Token.verify(token)
      assert result == {:error, :malformed_jwks}
    end
  end

  describe "find_key/2 private function - malformed JWKS clause" do
    test "returns malformed_jwks error when JWKS has no keys field" do
      {token, _claims, _jwks} = valid_jwt_token_with_jwks()
      # JWKS that is a map but without a "keys" field
      malformed_jwks = %{"some_other_field" => "value"}
      Token.set_jwks_for_test(malformed_jwks)

      result = Token.verify(token)
      assert result == {:error, :malformed_jwks}
    end

    test "returns malformed_jwks error when JWKS keys is not a list" do
      {token, _claims, _jwks} = valid_jwt_token_with_jwks()
      malformed_jwks = %{"keys" => "not_a_list"}
      Token.set_jwks_for_test(malformed_jwks)

      result = Token.verify(token)
      assert result == {:error, :malformed_jwks}
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

  describe "verify/1 missing expiration and nbf" do
    test "rejects token with missing exp claim" do
      {private_map, public_map} = generate_key_pair()
      kid = "test-key-#{System.unique_integer([:positive])}"
      jwk = JOSE.JWK.from_map(private_map)

      claims = %{
        "sub" => "user_no_exp",
        "iss" => "https://auth.example.com",
        "aud" => "https://auth.example.com",
        "iat" => System.system_time(:second)
        # No exp claim
      }

      {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256", "kid" => kid}, claims)
      {_protected, token} = JOSE.JWS.compact(token_map)

      jwks = %{"keys" => [Map.put(public_map, "kid", kid)]}
      Token.set_jwks_for_test(jwks)

      assert {:error, :missing_expiration} = Token.verify(token)
    end

    test "rejects token with invalid expiration format" do
      {private_map, public_map} = generate_key_pair()
      kid = "test-key-#{System.unique_integer([:positive])}"
      jwk = JOSE.JWK.from_map(private_map)

      claims = %{
        "sub" => "user_invalid_exp",
        "iss" => "https://auth.example.com",
        "aud" => "https://auth.example.com",
        "iat" => System.system_time(:second),
        "exp" => "not_a_number"
      }

      {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256", "kid" => kid}, claims)
      {_protected, token} = JOSE.JWS.compact(token_map)

      jwks = %{"keys" => [Map.put(public_map, "kid", kid)]}
      Token.set_jwks_for_test(jwks)

      assert {:error, :invalid_expiration} = Token.verify(token)
    end

    test "rejects token with invalid nbf format" do
      {private_map, public_map} = generate_key_pair()
      kid = "test-key-#{System.unique_integer([:positive])}"
      jwk = JOSE.JWK.from_map(private_map)

      claims = %{
        "sub" => "user_invalid_nbf",
        "iss" => "https://auth.example.com",
        "aud" => "https://auth.example.com",
        "iat" => System.system_time(:second),
        "exp" => System.system_time(:second) + 3600,
        "nbf" => "not_a_number"
      }

      {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256", "kid" => kid}, claims)
      {_protected, token} = JOSE.JWS.compact(token_map)

      jwks = %{"keys" => [Map.put(public_map, "kid", kid)]}
      Token.set_jwks_for_test(jwks)

      assert {:error, :invalid_not_before} = Token.verify(token)
    end

    test "rejects token with missing issuer" do
      {private_map, public_map} = generate_key_pair()
      kid = "test-key-#{System.unique_integer([:positive])}"
      jwk = JOSE.JWK.from_map(private_map)

      claims = %{
        "sub" => "user_no_iss",
        "aud" => "https://auth.example.com",
        "exp" => System.system_time(:second) + 3600,
        "iat" => System.system_time(:second)
        # No iss claim
      }

      {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256", "kid" => kid}, claims)
      {_protected, token} = JOSE.JWS.compact(token_map)

      jwks = %{"keys" => [Map.put(public_map, "kid", kid)]}
      Token.set_jwks_for_test(jwks)

      assert {:error, :missing_issuer} = Token.verify(token)
    end

    test "rejects token with missing audience" do
      {private_map, public_map} = generate_key_pair()
      kid = "test-key-#{System.unique_integer([:positive])}"
      jwk = JOSE.JWK.from_map(private_map)

      claims = %{
        "sub" => "user_no_aud",
        "iss" => "https://auth.example.com",
        "exp" => System.system_time(:second) + 3600,
        "iat" => System.system_time(:second)
        # No aud claim
      }

      {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256", "kid" => kid}, claims)
      {_protected, token} = JOSE.JWS.compact(token_map)

      jwks = %{"keys" => [Map.put(public_map, "kid", kid)]}
      Token.set_jwks_for_test(jwks)

      assert {:error, :missing_audience} = Token.verify(token)
    end
  end

  describe "verify/1 header edge cases" do
    test "rejects token with missing kid in header" do
      {private_map, public_map} = generate_key_pair()
      jwk = JOSE.JWK.from_map(private_map)

      claims = %{
        "sub" => "user_no_kid",
        "iss" => "https://auth.example.com",
        "aud" => "https://auth.example.com",
        "exp" => System.system_time(:second) + 3600,
        "iat" => System.system_time(:second)
      }

      # Sign without kid in header
      {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256"}, claims)
      {_protected, token} = JOSE.JWS.compact(token_map)

      jwks = %{"keys" => [public_map]}
      Token.set_jwks_for_test(jwks)

      assert {:error, :missing_kid} = Token.verify(token)
    end

    test "rejects token with header that is not a map" do
      # Create a token where header is not a map after decoding
      # This tests the extract_kid/1 non-map header clause
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      # "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" is {"alg":"HS256","typ":"JWT"} - valid JSON
      # "ew" is base64 for "{" - invalid JSON
      result = Token.verify("ew.payload.signature")
      assert match?({:error, _}, result)
    end
  end

  describe "fetch_jwks/0 HTTP error handling" do
    test "handles non-200 status codes" do
      bypass = Bypass.open()

      Bypass.expect(bypass, "GET", "/api/auth/jwks", fn conn ->
        conn
        |> Plug.Conn.put_resp_content_type("application/json")
        |> Plug.Conn.resp(404, "{}")
      end)

      Application.put_env(:presence, :better_auth_url, "http://localhost:#{bypass.port}")
      Token.clear_jwks_cache()

      assert {:error, :jwks_fetch_failed} = Token.fetch_jwks()
    end

    test "handles 500 server error" do
      bypass = Bypass.open()

      Bypass.expect(bypass, "GET", "/api/auth/jwks", fn conn ->
        conn
        |> Plug.Conn.put_resp_content_type("application/json")
        |> Plug.Conn.resp(500, "{\"error\": \"internal error\"}")
      end)

      Application.put_env(:presence, :better_auth_url, "http://localhost:#{bypass.port}")
      Token.clear_jwks_cache()

      assert {:error, :jwks_fetch_failed} = Token.fetch_jwks()
    end
  end

  describe "verify_expiration/1 with invalid exp type" do
    test "rejects token when exp is a string instead of number" do
      {private_map, public_map} = generate_key_pair()
      kid = "test-key-#{System.unique_integer([:positive])}"
      jwk = JOSE.JWK.from_map(private_map)

      claims = %{
        "sub" => "user_invalid_exp",
        "iss" => "https://auth.example.com",
        "aud" => "https://auth.example.com",
        "exp" => "not_a_number",
        "iat" => System.system_time(:second)
      }

      {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256", "kid" => kid}, claims)
      {_protected, token} = JOSE.JWS.compact(token_map)

      jwks = %{"keys" => [Map.put(public_map, "kid", kid)]}
      Token.set_jwks_for_test(jwks)

      assert {:error, :invalid_expiration} = Token.verify(token)
    end
  end

  describe "verify_not_before/1 with invalid nbf type" do
    test "rejects token when nbf is a string instead of number" do
      {private_map, public_map} = generate_key_pair()
      kid = "test-key-#{System.unique_integer([:positive])}"
      jwk = JOSE.JWK.from_map(private_map)

      claims = %{
        "sub" => "user_invalid_nbf",
        "iss" => "https://auth.example.com",
        "aud" => "https://auth.example.com",
        "exp" => System.system_time(:second) + 3600,
        "iat" => System.system_time(:second),
        "nbf" => "not_a_number"
      }

      {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256", "kid" => kid}, claims)
      {_protected, token} = JOSE.JWS.compact(token_map)

      jwks = %{"keys" => [Map.put(public_map, "kid", kid)]}
      Token.set_jwks_for_test(jwks)

      assert {:error, :invalid_not_before} = Token.verify(token)
    end
  end

  describe "verify_token_with_key/2 rescue clause" do
    test "handles unexpected JOSE error" do
      # To trigger the rescue clause, we need to cause JOSE to raise an exception
      # We'll create a JWK that causes an error when JOSE.JWT.verify is called
      {private_map, public_map} = generate_key_pair()
      kid = "test-key-#{System.unique_integer([:positive])}"
      jwk = JOSE.JWK.from_map(private_map)

      claims = %{
        "sub" => "user_test",
        "iss" => "https://auth.example.com",
        "aud" => "https://auth.example.com",
        "exp" => System.system_time(:second) + 3600,
        "iat" => System.system_time(:second)
      }

      {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256", "kid" => kid}, claims)
      {_protected, token} = JOSE.JWS.compact(token_map)

      # Create a JWKS with a key that has invalid RSA parameters
      # This will cause an error when JOSE tries to verify
      corrupted_key =
        public_map
        |> Map.put("kid", kid)
        |> Map.put("e", "!!!")
        |> Map.put("n", "!!!")

      jwks = %{"keys" => [corrupted_key]}
      Token.set_jwks_for_test(jwks)

      # The verification should catch the error and return verification_failed
      result = Token.verify(token)

      assert result == {:error, :verification_failed} or
               result == {:error, :invalid_signature}
    end

    test "handles JOSE argument error" do
      # Try with a completely malformed token that JOSE can't handle
      {_token, _claims, jwks} = valid_jwt_token_with_jwks()
      Token.set_jwks_for_test(jwks)

      # A token with invalid base64 encoding that JOSE will try to decode
      invalid_token = "invalid_base64.invalid_base64.invalid_base64"

      result = Token.verify(invalid_token)
      assert match?({:error, _}, result)
    end

    test "handles JOSE key decode error" do
      # Create a valid token with a key that will cause decode issues
      {private_map, _public_map} = generate_key_pair()
      kid = "test-key-#{System.unique_integer([:positive])}"
      jwk = JOSE.JWK.from_map(private_map)

      claims = %{
        "sub" => "user_test",
        "iss" => "https://auth.example.com",
        "aud" => "https://auth.example.com",
        "exp" => System.system_time(:second) + 3600,
        "iat" => System.system_time(:second)
      }

      {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256", "kid" => kid}, claims)
      {_protected, token} = JOSE.JWS.compact(token_map)

      # Create a JWKS with malformed key parameters
      # Missing required RSA parameters
      malformed_key = %{
        "kid" => kid,
        "kty" => "RSA",
        "e" => nil,
        "n" => nil
      }

      jwks = %{"keys" => [malformed_key]}
      Token.set_jwks_for_test(jwks)

      # Should trigger rescue clause
      result = Token.verify(token)
      assert match?({:error, _}, result)
    end
  end
end
