import { prisma } from "@lumen/db";
import { createLogger } from "@lumen/logger";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, jwt } from "better-auth/plugins";
import { env } from "../../env";

const logger = createLogger({ name: "auth:config" });

logger.info("Initializing Better Auth with Prisma adapter");

// E2E session regex - defined at top level for performance
const E2E_SESSION_REGEX = /e2e-session-(e2e-user-[a-f0-9]+)-/;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: process.env.NODE_ENV === "development",
  },
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/github`,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
      strategy: "compact",
    },
  },
  plugins: [
    bearer(),
    jwt({
      jwt: {
        expirationTime: "1h",
      },
      jwks: {
        disablePrivateKeyEncryption: true,
      },
    }),
  ],
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS || [],
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    cookieSameSite: env.NODE_ENV === "production" ? "none" : "lax",
  },
  logger: {
    level: env.LOG_LEVEL,
    disabled: false,
    verboseLogging: env.NODE_ENV === "development",
  },
});

logger.info("Better Auth initialized successfully", {
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS || [],
  sessionExpiresIn: "7 days",
  cookieStrategy: "compact",
  jwtEnabled: true,
});

if (env.NODE_ENV === "development") {
  const originalGetSession = (
    auth.api as { getSession: (req: unknown) => Promise<unknown> }
  ).getSession;

  (auth.api as { getSession: (req: unknown) => Promise<unknown> }).getSession =
    (req: unknown): Promise<unknown> => {
      let bypass = false;
      let userId = "e2e-user";
      const headers = (req as { headers?: unknown }).headers;

      let cookieStr = "";
      if (headers && typeof headers === "object" && headers !== null) {
        const h = headers as {
          get?: (key: string) => string | null;
          [key: string]: unknown;
        };
        if (typeof h.get === "function") {
          if (h.get("x-e2e-bypass") === "true") {
            bypass = true;
          }
          userId = h.get("x-e2e-user-id") || userId;
          cookieStr = h.get("cookie") || "";
        } else {
          if (h["x-e2e-bypass"] === "true") {
            bypass = true;
          }
          userId = (h["x-e2e-user-id"] as string) || userId;
          cookieStr = (h.cookie as string) || "";
        }
      }

      if (cookieStr.includes("e2e-session-e2e-user-")) {
        bypass = true;
        const match = cookieStr.match(E2E_SESSION_REGEX);
        if (match) {
          userId = match[1];
        }
      }

      if (bypass) {
        // Return E2E bypass session
        return Promise.resolve({
          user: {
            id: userId,
            name: "E2E User",
            email: `${userId}@e2e.test`,
            emailVerified: true,
            image: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          session: {
            id: "e2e-session",
            userId,
            token: "e2e-token",
            expiresAt: new Date(Date.now() + 100_000),
            ipAddress: null,
            userAgent: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
      return originalGetSession(req);
    };
}

export type Auth = typeof auth;
