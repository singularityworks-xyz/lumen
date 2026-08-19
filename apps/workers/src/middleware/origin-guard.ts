import { createLogger } from "@lumen/logger";
import type Elysia from "elysia";
import { env } from "../env";

const logger = createLogger({ name: "workers:origin-guard" });

export const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:1420",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

// Check whether an incoming origin or referer is in the allowed list or is a valid loopback alias
export function isAllowedOrigin(
  originOrReferer: string | null | undefined,
  configuredOrigins?: string[]
): boolean {
  if (!originOrReferer) {
    return false;
  }

  const allowedList = [
    ...(configuredOrigins ?? env.ALLOWED_ORIGINS ?? []),
    ...DEFAULT_ALLOWED_ORIGINS,
  ];

  let rawOrigin = originOrReferer;
  try {
    if (
      originOrReferer.startsWith("http://") ||
      originOrReferer.startsWith("https://")
    ) {
      rawOrigin = new URL(originOrReferer).origin;
    }
  } catch {
    // If not parseable as URL, fall back to raw string comparison
  }

  for (const allowed of allowedList) {
    if (rawOrigin === allowed) {
      return true;
    }

    try {
      if (
        (rawOrigin.startsWith("http://") || rawOrigin.startsWith("https://")) &&
        (allowed.startsWith("http://") || allowed.startsWith("https://"))
      ) {
        const allowedUrl = new URL(allowed);
        const incomingUrl = new URL(rawOrigin);

        if (
          allowedUrl.protocol === incomingUrl.protocol &&
          allowedUrl.port === incomingUrl.port &&
          LOOPBACK_HOSTS.has(allowedUrl.hostname) &&
          LOOPBACK_HOSTS.has(incomingUrl.hostname)
        ) {
          return true;
        }
      }
    } catch {
      // Ignore non-standard URL schemes
    }
  }

  return false;
}

export const originGuard = (app: Elysia) => {
  return app.onRequest(({ request, set }) => {
    // 1. Allow CORS preflight requests
    if (request.method === "OPTIONS") {
      return;
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 2. Allow JWKS endpoint (RFC 7517 public cryptographic keys) and OAuth callback redirects
    if (path === "/api/auth/jwks" || path.startsWith("/api/auth/callback/")) {
      return;
    }

    // 3. Allow internal service communication via internal API key
    const internalKey = request.headers.get("x-internal-key");
    const authHeader = request.headers.get("authorization");
    const configuredKey = env.INTERNAL_API_KEY || process.env.INTERNAL_API_KEY;
    if (
      configuredKey &&
      (internalKey === configuredKey ||
        authHeader === `Bearer ${configuredKey}`)
    ) {
      return;
    }

    // 4. Allow test harness / e2e bypass in non-production
    const e2eBypass = request.headers.get("x-e2e-bypass");
    if (
      env.NODE_ENV !== "production" &&
      (e2eBypass === "1" || e2eBypass === "true")
    ) {
      return;
    }

    // 5. Block direct browser navigation (typing URL in address bar or document embedding)
    const secFetchDest = request.headers.get("sec-fetch-dest");
    const secFetchMode = request.headers.get("sec-fetch-mode");
    if (secFetchDest === "document" || secFetchMode === "navigate") {
      logger.warn("Blocked direct browser navigation to workers API", {
        path,
        secFetchDest,
        secFetchMode,
      });
      set.status = 403;
      return {
        error: "Forbidden",
        message: "Direct browser access is blocked",
      };
    }

    // 6. In unit test environment, allow requests if no explicit origin header was passed
    if (env.NODE_ENV === "test" && !request.headers.has("origin")) {
      return;
    }

    // 7. Check Origin or Referer header
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");

    if (origin && isAllowedOrigin(origin)) {
      return;
    }

    if (referer && isAllowedOrigin(referer)) {
      return;
    }

    logger.warn("Blocked request from untrusted origin", {
      path,
      origin: origin ?? "none",
      referer: referer ?? "none",
      method: request.method,
    });

    set.status = 403;
    return {
      error: "Forbidden",
      message: "Direct access or untrusted origin is blocked",
    };
  });
};
