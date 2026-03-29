defmodule Presence.Test.Fixtures do
  @moduledoc """
  Test fixtures for presence service tests.
  Provides consistent, deterministic test data.
  """

  defp sign_and_compact(jwk, claims, kid \\ "test-key-1") do
    {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256", "kid" => kid}, claims)
    {_protected, token} = JOSE.JWS.compact(token_map)
    token
  end

  @doc """
  Generate a valid JWT token for testing with matching JWKS.
  Returns {token, claims, jwks} where jwks contains the public key.
  """
  def valid_jwt_token_with_jwks(opts \\ []) do
    user_id = Keyword.get(opts, :user_id, "user_#{System.unique_integer([:positive])}")
    name = Keyword.get(opts, :name, "Test User")
    image = Keyword.get(opts, :image, "https://example.com/avatar.png")
    issuer = Keyword.get(opts, :issuer, "https://auth.example.com")
    audience = Keyword.get(opts, :audience, "https://auth.example.com")
    kid = "test-key-#{System.unique_integer([:positive])}"

    claims = %{
      "sub" => user_id,
      "name" => name,
      "image" => image,
      "iss" => issuer,
      "aud" => audience,
      "exp" => System.system_time(:second) + 3600,
      "iat" => System.system_time(:second),
      "nbf" => System.system_time(:second) - 1
    }

    {private_map, public_map} = generate_key_pair()
    jwk = JOSE.JWK.from_map(private_map)
    token = sign_and_compact(jwk, claims, kid)

    jwks = %{
      "keys" => [
        Map.put(public_map, "kid", kid)
      ]
    }

    {token, claims, jwks}
  end

  @doc """
  Generate a valid JWT token for testing.
  Use valid_jwt_token_with_jwks for tests that need JWKS.
  """
  def valid_jwt_token(opts \\ []) do
    {token, claims, _jwks} = valid_jwt_token_with_jwks(opts)
    {token, claims, nil}
  end

  @doc """
  Generate an expired JWT token for testing with matching JWKS.
  Returns {token, jwks}.
  """
  def expired_jwt_token_with_jwks(opts \\ []) do
    user_id = Keyword.get(opts, :user_id, "user_expired")
    issuer = Keyword.get(opts, :issuer, "https://auth.example.com")
    audience = Keyword.get(opts, :audience, "https://auth.example.com")
    kid = "test-key-#{System.unique_integer([:positive])}"

    claims = %{
      "sub" => user_id,
      "name" => "Expired User",
      "iss" => issuer,
      "aud" => audience,
      "exp" => System.system_time(:second) - 3600,
      "iat" => System.system_time(:second) - 7200
    }

    {private_map, public_map} = generate_key_pair()
    jwk = JOSE.JWK.from_map(private_map)
    token = sign_and_compact(jwk, claims, kid)

    jwks = %{
      "keys" => [
        Map.put(public_map, "kid", kid)
      ]
    }

    {token, jwks}
  end

  @doc """
  Generate an expired JWT token for testing.
  """
  def expired_jwt_token(opts \\ []) do
    user_id = Keyword.get(opts, :user_id, "user_expired")
    issuer = Keyword.get(opts, :issuer, "https://auth.example.com")
    audience = Keyword.get(opts, :audience, "https://auth.example.com")

    claims = %{
      "sub" => user_id,
      "name" => "Expired User",
      "iss" => issuer,
      "aud" => audience,
      "exp" => System.system_time(:second) - 3600,
      "iat" => System.system_time(:second) - 7200
    }

    {private_map, _public_map} = generate_key_pair()
    jwk = JOSE.JWK.from_map(private_map)
    sign_and_compact(jwk, claims)
  end

  @doc """
  Generate a JWT token not yet valid (nbf in future) with matching JWKS.
  Returns {token, jwks}.
  """
  def not_yet_valid_jwt_token_with_jwks(opts \\ []) do
    user_id = Keyword.get(opts, :user_id, "user_future")
    issuer = Keyword.get(opts, :issuer, "https://auth.example.com")
    audience = Keyword.get(opts, :audience, "https://auth.example.com")
    kid = "test-key-#{System.unique_integer([:positive])}"

    claims = %{
      "sub" => user_id,
      "name" => "Future User",
      "iss" => issuer,
      "aud" => audience,
      "exp" => System.system_time(:second) + 7200,
      "iat" => System.system_time(:second),
      "nbf" => System.system_time(:second) + 3600
    }

    {private_map, public_map} = generate_key_pair()
    jwk = JOSE.JWK.from_map(private_map)
    token = sign_and_compact(jwk, claims, kid)

    jwks = %{
      "keys" => [
        Map.put(public_map, "kid", kid)
      ]
    }

    {token, jwks}
  end

  @doc """
  Generate a JWT token not yet valid (nbf in future).
  """
  def not_yet_valid_jwt_token(opts \\ []) do
    user_id = Keyword.get(opts, :user_id, "user_future")
    issuer = Keyword.get(opts, :issuer, "https://auth.example.com")
    audience = Keyword.get(opts, :audience, "https://auth.example.com")

    claims = %{
      "sub" => user_id,
      "name" => "Future User",
      "iss" => issuer,
      "aud" => audience,
      "exp" => System.system_time(:second) + 7200,
      "iat" => System.system_time(:second),
      "nbf" => System.system_time(:second) + 3600
    }

    {private_map, _public_map} = generate_key_pair()
    jwk = JOSE.JWK.from_map(private_map)
    sign_and_compact(jwk, claims)
  end

  @doc """
  Generate a JWT token with invalid issuer.
  """
  def invalid_issuer_jwt_token(opts \\ []) do
    user_id = Keyword.get(opts, :user_id, "user_invalid_issuer")
    expected_issuer = Keyword.get(opts, :expected_issuer, "https://auth.example.com")
    kid = "test-key-#{System.unique_integer([:positive])}"

    claims = %{
      "sub" => user_id,
      "name" => "Invalid Issuer User",
      "iss" => "https://evil.com",
      "aud" => expected_issuer,
      "exp" => System.system_time(:second) + 3600,
      "iat" => System.system_time(:second)
    }

    {private_map, public_map} = generate_key_pair()
    jwk = JOSE.JWK.from_map(private_map)
    token = sign_and_compact(jwk, claims, kid)

    jwks = %{
      "keys" => [
        Map.put(public_map, "kid", kid)
      ]
    }

    {token, jwks}
  end

  @doc """
  Generate a JWT token with invalid audience.
  """
  def invalid_audience_jwt_token(opts \\ []) do
    user_id = Keyword.get(opts, :user_id, "user_invalid_audience")
    issuer = Keyword.get(opts, :issuer, "https://auth.example.com")
    kid = "test-key-#{System.unique_integer([:positive])}"

    claims = %{
      "sub" => user_id,
      "name" => "Invalid Audience User",
      "iss" => issuer,
      "aud" => "https://evil.com",
      "exp" => System.system_time(:second) + 3600,
      "iat" => System.system_time(:second)
    }

    {private_map, public_map} = generate_key_pair()
    jwk = JOSE.JWK.from_map(private_map)
    token = sign_and_compact(jwk, claims, kid)

    jwks = %{
      "keys" => [
        Map.put(public_map, "kid", kid)
      ]
    }

    {token, jwks}
  end

  @doc """
  Generate a JWT token with malformed structure.
  """
  def malformed_token do
    "not.a.valid.jwt.token"
  end

  @doc """
  Generate a JWT token with invalid signature.
  Signs with a different key than what's in the JWKS.
  Optionally accepts a kid to match a specific JWKS.
  """
  def invalid_signature_token(opts \\ []) do
    user_id = Keyword.get(opts, :user_id, "user_bad_sig")
    issuer = Keyword.get(opts, :issuer, "https://auth.example.com")
    audience = Keyword.get(opts, :audience, "https://auth.example.com")
    kid = Keyword.get(opts, :kid, "test-key-1")

    claims = %{
      "sub" => user_id,
      "name" => "Bad Signature User",
      "iss" => issuer,
      "aud" => audience,
      "exp" => System.system_time(:second) + 3600,
      "iat" => System.system_time(:second)
    }

    {different_private, _different_public} = generate_key_pair()
    different_key = JOSE.JWK.from_map(different_private)
    sign_and_compact(different_key, claims, kid)
  end

  @doc """
  Generate a JWKS response for testing.
  Note: Use valid_jwt_token_with_jwks for coordinated token/JWKS pairs.
  """
  def jwks_response(opts \\ []) do
    kid = Keyword.get(opts, :kid, "test-key-1")
    {_private_key, public_key} = generate_key_pair()

    %{
      "keys" => [
        Map.put(public_key, "kid", kid)
      ]
    }
  end

  @doc """
  Generate a key pair for JWT signing/verification.
  Returns {private_key_map, public_key_map}.
  """
  def generate_key_pair do
    key = JOSE.JWK.generate_key({:rsa, 2048})
    private_map = JOSE.JWK.to_map(key) |> elem(1)
    public_map = JOSE.JWK.to_public_map(key) |> elem(1)
    {private_map, public_map}
  end

  @doc """
  Generate test user attributes.
  """
  def user_attrs(opts \\ []) do
    %{
      id: Keyword.get(opts, :id, "user_#{System.unique_integer([:positive])}"),
      name: Keyword.get(opts, :name, "Test User"),
      avatar: Keyword.get(opts, :avatar, "https://example.com/avatar.png")
    }
  end

  @doc """
  Generate test workspace attributes.
  """
  def workspace_attrs(opts \\ []) do
    %{
      id: Keyword.get(opts, :id, "workspace_#{System.unique_integer([:positive])}"),
      name: Keyword.get(opts, :name, "Test Workspace")
    }
  end
end
