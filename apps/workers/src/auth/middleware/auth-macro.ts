import { createLogger } from "@lumen/logger";
import {
  recordSpanError,
  setSpanAttributes,
  withSpanAsync,
} from "@lumen/logger/server";
import Elysia from "elysia";
import { auth } from "../config/auth";

const logger = createLogger({ name: "auth:macro" });

export const authMacro = new Elysia({ name: "auth-macro" }).macro({
  auth(enabled: boolean) {
    if (!enabled) {
      return {
        beforeHandle: undefined,
      };
    }

    return {
      beforeHandle({ request, set }) {
        const path = new URL(request.url).pathname;
        return withSpanAsync("auth.validateSession", async (span) => {
          const headers = request.headers;
          setSpanAttributes({ path });

          try {
            logger.debug("Validating session", {
              headers: Object.fromEntries(headers.entries()),
            });

            const session = await auth.api.getSession({ headers });

            if (!session) {
              logger.warn("Unauthorized request - no valid session", {
                path,
              });

              span.setAttribute("auth.valid", false);
              set.status = 401;
              return {
                error: "Unauthorized",
                message: "Valid session required",
              };
            }

            setSpanAttributes({
              userId: session.user.id,
              sessionId: session.session.id,
              "auth.valid": true,
            });

            logger.info("Session validated successfully", {
              userId: session.user.id,
              sessionId: session.session.id,
            });

            return {
              user: session.user,
              session: session.session,
            };
          } catch (error) {
            recordSpanError(span, error);
            logger.error("Session validation error", {
              error: error instanceof Error ? error.message : "Unknown error",
              stack: error instanceof Error ? error.stack : undefined,
            });

            set.status = 401;
            return {
              error: "Unauthorized",
              message: "Session validation failed",
            };
          }
        });
      },
    };
  },
});
