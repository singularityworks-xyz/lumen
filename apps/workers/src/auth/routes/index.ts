import { randomBytes } from "node:crypto";
import { prisma } from "@lumen/db";
import { createLogger } from "@lumen/logger";
import Elysia, { t } from "elysia";
import { auth } from "../config/auth";

const logger = createLogger({ name: "auth:routes" });
const SESSION_TOKEN_REGEX = /better-auth\.session_token=([^;]+)/;

// Cleanup expired tokens periodically (every 5 minutes)
const cleanupInterval = setInterval(
  async () => {
    try {
      const result = await prisma.oneTimeAuthToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        logger.debug("Cleaned up expired one-time tokens", {
          count: result.count,
        });
      }
    } catch (err) {
      logger.error("Failed to cleanup expired tokens", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
  5 * 60 * 1000
);

// Ensure cleanup stops on process exit (helps with hot reload)
if (typeof process !== "undefined") {
  process.on("beforeExit", () => clearInterval(cleanupInterval));
}

function toHeaders(
  headers: Record<string, string | null | undefined>
): Headers {
  const h = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      h.set(key, value);
    }
  }
  return h;
}

export const authRoutes = new Elysia({ name: "auth-routes" })
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    if (!url.pathname.includes("/token")) {
      logger.info("Auth request received", {
        method: request.method,
        path: url.pathname,
      });
    }
  })
  .onAfterHandle(({ request }) => {
    const url = new URL(request.url);
    if (!url.pathname.includes("/token")) {
      logger.info("Auth response sent", {
        method: request.method,
        path: url.pathname,
      });
    }
  })
  .onError(({ error, request, set }) => {
    const url = new URL(request.url);
    logger.error("Auth route error", {
      method: request.method,
      path: url.pathname,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    const statusCode = (error as { status?: number }).status || 500;
    set.status = statusCode;

    return {
      error: statusCode === 401 ? "Unauthorized" : "Internal Server Error",
      message:
        process.env.NODE_ENV === "production"
          ? "Something went wrong"
          : error instanceof Error
            ? error.message
            : "Unknown error",
      ...(process.env.NODE_ENV === "development" && error instanceof Error
        ? { stack: error.stack }
        : {}),
    };
  })

  // Generate a one-time token for native app authentication
  // Called from the native-callback page (in external browser) after OAuth success
  .post("/api/auth/native/generate-token", async ({ headers, set }) => {
    const session = await auth.api.getSession({
      headers: toHeaders(headers),
    });

    if (!session) {
      set.status = 401;
      return { error: "Unauthorized", message: "No active session" };
    }

    const oneTimeToken = randomBytes(32).toString("hex");
    const cookieHeader = headers.cookie || "";
    const sessionMatch = cookieHeader.match(SESSION_TOKEN_REGEX);
    const sessionToken = sessionMatch
      ? decodeURIComponent(sessionMatch[1])
      : null;

    if (!sessionToken) {
      set.status = 401;
      return { error: "Unauthorized", message: "No session token found" };
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.oneTimeAuthToken.create({
      data: {
        token: oneTimeToken,
        sessionToken,
        expiresAt,
      },
    });

    logger.info("Generated one-time token for native auth", {
      userId: session.user.id,
    });

    return { token: oneTimeToken };
  })

  // Exchange one-time token for a session cookie (called from Tauri WebView)
  .post(
    "/api/auth/native/exchange-token",
    async ({ body, set, cookie }) => {
      const { token } = body;

      if (!token) {
        set.status = 400;
        return { error: "Bad Request", message: "Token is required" };
      }

      // Atomically find and delete the token to prevent race conditions
      const tokenData = await prisma.oneTimeAuthToken.findUnique({
        where: { token },
      });

      if (!tokenData) {
        set.status = 401;
        return { error: "Unauthorized", message: "Invalid or expired token" };
      }

      // Delete the token immediately (one-time use)
      await prisma.oneTimeAuthToken.delete({ where: { token } });

      if (tokenData.expiresAt < new Date()) {
        set.status = 401;
        return { error: "Unauthorized", message: "Token has expired" };
      }

      // Set the session cookie for the Tauri WebView
      cookie["better-auth.session_token"].set({
        value: tokenData.sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      logger.info("Exchanged one-time token for session cookie");

      return {
        success: true,
      };
    },
    {
      body: t.Object({
        token: t.String(),
      }),
    }
  )

  // Special handler for OAuth callback when redirecting to native-callback
  // This intercepts the callback, completes the OAuth flow, and adds a one-time token to the redirect URL
  .get("/api/auth/callback/:provider", async ({ request, params, set }) => {
    // Let Better Auth handle the callback first
    const authResponse = await auth.handler(request);

    // Check if this is a redirect to native-callback
    if (authResponse.status >= 300 && authResponse.status < 400) {
      const redirectUrl = authResponse.headers.get("Location");

      logger.debug("OAuth callback response", {
        provider: params.provider,
        status: authResponse.status,
        redirectUrl,
        isNativeCallback: redirectUrl?.includes("/auth/native-callback"),
      });

      if (redirectUrl?.includes("/auth/native-callback")) {
        // Extract session token from Set-Cookie headers
        // Use getSetCookie() which properly handles multiple Set-Cookie headers
        const setCookies = authResponse.headers.getSetCookie?.() || [];

        // Fallback: try to get from single header if getSetCookie not available
        if (setCookies.length === 0) {
          const singleCookie = authResponse.headers.get("Set-Cookie");
          if (singleCookie) {
            // biome-ignore lint/performance/useTopLevelRegex: does not hurt here
            setCookies.push(...singleCookie.split(/,(?=\s*\w+=)/));
          }
        }

        logger.debug("Extracting session from cookies", {
          cookieCount: setCookies.length,
          cookies: setCookies.map((c) => `${c.substring(0, 50)}...`),
        });

        let sessionToken: string | null = null;
        for (const cookie of setCookies) {
          const match = cookie.match(SESSION_TOKEN_REGEX);
          if (match) {
            sessionToken = decodeURIComponent(match[1]);
            break;
          }
        }

        logger.debug("Session token extraction result", {
          hasSessionToken: !!sessionToken,
          tokenPreview: sessionToken
            ? `${sessionToken.substring(0, 20)}...`
            : null,
        });

        if (sessionToken) {
          const oneTimeToken = randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

          await prisma.oneTimeAuthToken.create({
            data: {
              token: oneTimeToken,
              sessionToken,
              expiresAt,
            },
          });

          logger.info("Generated one-time token for native OAuth callback", {
            provider: params.provider,
          });

          const redirectWithToken = new URL(redirectUrl);
          redirectWithToken.searchParams.set("native_token", oneTimeToken);
          const setCookieHeaders = authResponse.headers.getSetCookie?.() || [];
          if (setCookieHeaders.length > 0) {
            set.headers["Set-Cookie"] = setCookieHeaders.join(", ");
          }
          // biome-ignore lint/complexity/useLiteralKeys: if it works, don't touch it
          set.headers["Location"] = redirectWithToken.toString();
          set.status = 302;
          return;
        }

        logger.warn(
          "Could not generate native token, falling back to normal redirect",
          {
            provider: params.provider,
            hasSessionToken: !!sessionToken,
          }
        );
      }
    }

    // For non-native callbacks or if token generation failed, return original response
    return authResponse;
  })

  .all("/api/auth/*", ({ request }) => {
    logger.debug("Delegating to Better Auth handler", {
      method: request.method,
      url: request.url,
    });

    return auth.handler(request);
  });
