const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function normalizeApiOriginForCurrentHost(rawApiUrl: string): URL {
  const apiUrl = new URL(rawApiUrl);

  if (typeof window === "undefined") {
    return apiUrl;
  }

  const currentHost = window.location.hostname;
  const isApiLoopback = LOOPBACK_HOSTS.has(apiUrl.hostname);
  const isCurrentLoopback = LOOPBACK_HOSTS.has(currentHost);

  if (isApiLoopback && isCurrentLoopback) {
    apiUrl.hostname = currentHost;
  }

  return apiUrl;
}

export function normalizeApiUrlForCurrentHost(rawApiUrl: string): string {
  const normalized = normalizeApiOriginForCurrentHost(rawApiUrl);

  // Preserve whether the caller provided a trailing slash for bare origins.
  // `URL#toString()` always emits `.../` for origin-only URLs, but several
  // call sites expect a slashless origin when the input had no trailing slash.
  const inputHasTrailingSlash = rawApiUrl.endsWith("/");
  if (
    !inputHasTrailingSlash &&
    normalized.pathname === "/" &&
    normalized.search === "" &&
    normalized.hash === ""
  ) {
    return normalized.toString().slice(0, -1);
  }

  return normalized.toString();
}
