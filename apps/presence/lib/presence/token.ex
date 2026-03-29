defmodule Presence.Token do
  @moduledoc """
  JWT token verification using JWKS from Better Auth.
  Fetches and caches public keys from Better Auth's JWKS endpoint.
  """

  require Logger

  @jwks_cache_table :jwks_cache
  @jwks_cache_ttl_ms 60 * 60 * 1000

  @doc """
  Initialize the JWKS cache ETS table.
  Called during application startup.
  """
  def init_cache do
    if :ets.whereis(@jwks_cache_table) == :undefined do
      :ets.new(@jwks_cache_table, [:named_table, :public, read_concurrency: true])
      Logger.info("JWKS cache initialized")
    end

    :ok
  end

  @doc """
  Set JWKS directly in the cache for testing.
  Clears any existing entry first to ensure test isolation.
  """
  def set_jwks_for_test(jwks) do
    init_cache()
    :ets.delete(@jwks_cache_table, :jwks)
    timestamp = System.monotonic_time(:millisecond)
    :ets.insert(@jwks_cache_table, {:jwks, jwks, timestamp})
    :ok
  end

  @doc """
  Clear the JWKS cache. Useful for test isolation.
  """
  def clear_jwks_cache do
    init_cache()
    :ets.delete(@jwks_cache_table, :jwks)
    :ok
  end

  @doc """
  Verify a JWT token using JWKS from Better Auth.
  """
  def verify(token) do
    with {:ok, header} <- decode_header(token),
         {:ok, kid} <- extract_kid(header),
         {:ok, jwks} <- get_jwks(),
         {:ok, key} <- find_key(jwks, kid),
         {:ok, claims} <- verify_token_with_key(token, key) do
      {:ok, claims}
    else
      {:error, reason} ->
        Logger.warning("JWT verification failed", reason: inspect(reason))
        {:error, reason}
    end
  end

  @doc """
  Fetch JWKS from Better Auth and cache it.
  """
  def fetch_jwks do
    base_url = Application.get_env(:presence, :better_auth_url)
    jwks_url = "#{base_url}/api/auth/jwks"

    Logger.debug("Fetching JWKS from #{jwks_url}")

    case Req.get(jwks_url) do
      {:ok, %{status: 200, body: body}} when is_map(body) ->
        # Req auto-decodes JSON
        cache_jwks(body)
        {:ok, body}

      {:ok, %{status: status}} ->
        Logger.error("Failed to fetch JWKS", status: status, url: jwks_url)
        {:error, :jwks_fetch_failed}

      {:error, reason} ->
        Logger.error("HTTP error fetching JWKS", reason: inspect(reason), url: jwks_url)
        {:error, :jwks_fetch_failed}
    end
  end

  defp get_jwks do
    case lookup_cached_jwks() do
      {:ok, jwks} ->
        {:ok, jwks}

      {:error, :expired} ->
        fetch_jwks()

      {:error, :not_found} ->
        fetch_jwks()
    end
  end

  defp lookup_cached_jwks do
    case :ets.lookup(@jwks_cache_table, :jwks) do
      [{:jwks, jwks, timestamp}] ->
        if fresh?(timestamp) do
          {:ok, jwks}
        else
          {:error, :expired}
        end

      [] ->
        {:error, :not_found}
    end
  end

  defp cache_jwks(jwks) do
    timestamp = System.monotonic_time(:millisecond)
    :ets.insert(@jwks_cache_table, {:jwks, jwks, timestamp})
    :ets.insert(@jwks_cache_table, {:last_fetch, timestamp})
    Logger.debug("JWKS cached successfully")
  end

  defp fresh?(timestamp) do
    now = System.monotonic_time(:millisecond)
    now - timestamp < @jwks_cache_ttl_ms
  end

  defp extract_kid(header) when is_map(header) do
    case Map.get(header, "kid") do
      nil -> {:error, :missing_kid}
      kid -> {:ok, kid}
    end
  end

  defp extract_kid(_header), do: {:error, :invalid_header}

  defp find_key(%{"keys" => keys}, kid) when is_list(keys) do
    case Enum.find(keys, fn key -> is_map(key) and key["kid"] == kid end) do
      nil -> {:error, :key_not_found}
      key -> {:ok, key}
    end
  end

  defp find_key(_jwks, _kid), do: {:error, :malformed_jwks}

  defp decode_header(token) when is_binary(token) do
    case String.split(token, ".") do
      [header_b64 | _] ->
        case Base.url_decode64(header_b64, padding: false) do
          {:ok, header_json} -> Jason.decode(header_json)
          :error -> {:error, :invalid_header}
        end

      _ ->
        {:error, :invalid_token_format}
    end
  end

  defp decode_header(_token), do: {:error, :invalid_token_format}

  defp verify_token_with_key(token, key) do
    # Convert JWK to format JOSE expects
    jwk = JOSE.JWK.from_map(key)
    base_url = Application.get_env(:presence, :better_auth_url)

    # Verify signature, issuer, and audience
    case JOSE.JWT.verify(jwk, token) do
      {true, %JOSE.JWT{fields: claims}, _} ->
        # Verify issuer, audience, and temporal claims
        with {:ok} <- verify_issuer(claims, base_url),
             {:ok} <- verify_audience(claims, base_url),
             {:ok} <- verify_expiration(claims),
             {:ok} <- verify_not_before(claims) do
          {:ok, claims}
        end

      {false, _, _} ->
        {:error, :invalid_signature}
    end
  rescue
    e ->
      Logger.error("JWT verification error", error: inspect(e))
      {:error, :verification_failed}
  end

  defp verify_issuer(claims, expected_issuer) do
    case Map.get(claims, "iss") do
      ^expected_issuer -> {:ok}
      nil -> {:error, :missing_issuer}
      actual -> {:error, {:invalid_issuer, actual, expected_issuer}}
    end
  end

  defp verify_audience(claims, expected_audience) do
    case Map.get(claims, "aud") do
      ^expected_audience -> {:ok}
      nil -> {:error, :missing_audience}
      actual -> {:error, {:invalid_audience, actual, expected_audience}}
    end
  end

  defp verify_expiration(claims) do
    now = System.system_time(:second)

    case Map.get(claims, "exp") do
      nil ->
        {:error, :missing_expiration}

      exp when is_number(exp) ->
        if exp > now do
          {:ok}
        else
          {:error, :token_expired}
        end

      _ ->
        {:error, :invalid_expiration}
    end
  end

  defp verify_not_before(claims) do
    now = System.system_time(:second)

    case Map.get(claims, "nbf") do
      nil ->
        # nbf is optional, allow if not present
        {:ok}

      nbf when is_number(nbf) ->
        if nbf <= now do
          {:ok}
        else
          {:error, :token_not_yet_valid}
        end

      _ ->
        {:error, :invalid_not_before}
    end
  end
end
