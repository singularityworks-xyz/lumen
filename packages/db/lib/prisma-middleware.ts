import { createLogger } from "@lumen/logger";
import { recordSpanError, withSpanAsync } from "@lumen/logger/server";
import { Prisma } from "../prisma/generated/prisma/client";
import {
  decryptPrivateKey,
  encryptPrivateKey,
  isEncryptionConfigured,
} from "./jwks-encryption";

const logger = createLogger({ name: "db:extension" });

export function createJwksEncryptionExtension() {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: "jwks-encryption",
      query: {
        jwks: {
          create({ args, query }) {
            return withSpanAsync("db.jwks.encrypt", async (span) => {
              if (!isEncryptionConfigured()) {
                logger.warn("JWKS encryption not configured", {
                  operation: "db.jwks.encryption",
                  issue: "JWKS_ENCRYPTION_KEY_missing",
                  message:
                    "Private keys will be stored as plaintext. Generate a key with: openssl rand -base64 32",
                });
                return query(args);
              }

              if (args.data.privateKey) {
                try {
                  args.data.privateKey = await encryptPrivateKey(
                    args.data.privateKey
                  );
                } catch (error) {
                  recordSpanError(span, error);
                  throw error;
                }
              }
              return query(args);
            });
          },

          update({ args, query }) {
            return withSpanAsync("db.jwks.encrypt", async (span) => {
              if (!isEncryptionConfigured()) {
                return query(args);
              }

              if (args.data.privateKey) {
                try {
                  args.data.privateKey = await encryptPrivateKey(
                    args.data.privateKey as string
                  );
                } catch (error) {
                  recordSpanError(span, error);
                  throw error;
                }
              }
              return query(args);
            });
          },

          upsert({ args, query }) {
            return withSpanAsync("db.jwks.encrypt", async (span) => {
              if (!isEncryptionConfigured()) {
                return query(args);
              }

              if (args.create.privateKey) {
                try {
                  args.create.privateKey = await encryptPrivateKey(
                    args.create.privateKey
                  );
                } catch (error) {
                  recordSpanError(span, error);
                  throw error;
                }
              }
              if (args.update.privateKey) {
                try {
                  args.update.privateKey = await encryptPrivateKey(
                    args.update.privateKey as string
                  );
                } catch (error) {
                  recordSpanError(span, error);
                  throw error;
                }
              }
              return query(args);
            });
          },

          findUnique({ args, query }) {
            return withSpanAsync("db.jwks.decrypt", async (span) => {
              const result = await query(args);
              if (!(isEncryptionConfigured() && result?.privateKey)) {
                return result;
              }

              try {
                result.privateKey = await decryptPrivateKey(result.privateKey);
              } catch (error) {
                recordSpanError(span, error);
                logger.error("Failed to decrypt private key on read", {
                  jwksId: result.id,
                  operation: "db.jwks.decrypt",
                  error: {
                    type: "decryption_error",
                    message:
                      error instanceof Error ? error.message : "Unknown error",
                  },
                });
                throw error;
              }
              return result;
            });
          },

          findFirst({ args, query }) {
            return withSpanAsync("db.jwks.decrypt", async (span) => {
              const result = await query(args);
              if (!(isEncryptionConfigured() && result?.privateKey)) {
                return result;
              }

              try {
                result.privateKey = await decryptPrivateKey(result.privateKey);
              } catch (error) {
                recordSpanError(span, error);
                logger.error("Failed to decrypt private key on read", {
                  jwksId: result.id,
                  operation: "db.jwks.decrypt",
                  error: {
                    type: "decryption_error",
                    message:
                      error instanceof Error ? error.message : "Unknown error",
                  },
                });
                throw error;
              }
              return result;
            });
          },

          findMany({ args, query }) {
            return withSpanAsync("db.jwks.decrypt", async (span) => {
              const result = await query(args);
              if (!isEncryptionConfigured()) {
                return result;
              }

              for (const item of result) {
                if (item?.privateKey) {
                  try {
                    item.privateKey = await decryptPrivateKey(item.privateKey);
                  } catch (error) {
                    recordSpanError(span, error);
                    logger.error("Failed to decrypt private key on read", {
                      jwksId: item.id,
                      operation: "db.jwks.decrypt",
                      error: {
                        type: "decryption_error",
                        message:
                          error instanceof Error
                            ? error.message
                            : "Unknown error",
                      },
                    });
                    throw error;
                  }
                }
              }
              return result;
            });
          },
        },
      },
    })
  );
}

export const createJwksEncryptionMiddleware = createJwksEncryptionExtension;
