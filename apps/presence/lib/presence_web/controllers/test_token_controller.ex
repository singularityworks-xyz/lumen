defmodule PresenceWeb.TestTokenController do
  use PresenceWeb, :controller

  @doc """
  Generates a valid JWT token for E2E testing purposes.
  This endpoint is only available in the test environment.
  """
  def generate(conn, _params) do
    if Application.get_env(:presence, :env) == :test do
      user_id = "test_user_#{:crypto.strong_rand_bytes(4) |> Base.encode16()}"
      name = "Test User"
      image = "https://example.com/avatar.png"

      claims = %{
        "sub" => user_id,
        "name" => name,
        "image" => image,
        "iss" => "https://auth.example.com",
        "aud" => "https://auth.example.com",
        "exp" => System.system_time(:second) + 3600,
        "iat" => System.system_time(:second),
        "nbf" => System.system_time(:second) - 1
      }

      key = JOSE.JWK.generate_key({:rsa, 2048})
      private_map = JOSE.JWK.to_map(key) |> elem(1)
      public_map = JOSE.JWK.to_public_map(key) |> elem(1)
      jwk = JOSE.JWK.from_map(private_map)
      kid = "test-key-#{:crypto.strong_rand_bytes(4) |> Base.encode16()}"

      {_alg, token_map} = JOSE.JWT.sign(jwk, %{"alg" => "RS256", "kid" => kid}, claims)
      {_protected, token} = JOSE.JWS.compact(token_map)

      jwks = %{
        "keys" => [
          Map.merge(public_map, %{"kid" => kid})
        ]
      }

      Presence.Token.set_jwks_for_test(jwks)

      conn
      |> put_status(:ok)
      |> json(%{
        token: token,
        user_id: user_id,
        claims: claims
      })
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "Test endpoint not available in this environment"})
    end
  end
end
