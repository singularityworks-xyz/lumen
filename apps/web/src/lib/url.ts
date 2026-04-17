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
