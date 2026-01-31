defmodule Presence.Token do
  @moduledoc """
  JWT token verification for user authentication.
  """

  @doc """
  Verify a JWT token and return the claims.
  """
  def verify(token, secret) do
    claims = JOSE.JWT.verify(token, secret)
    {:ok, claims}
  rescue
    _ -> {:error, :invalid_token}
  end
end
