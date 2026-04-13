import { prisma } from "@lumen/db";
import { createLogger } from "@lumen/logger";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { jwt } from "better-auth/plugins";
import { env } from "../../env";

const logger = createLogger({ name: "auth:config" });

logger.info("Initializing Better Auth with Prisma adapter");

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: false,
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

export type Auth = typeof auth;
