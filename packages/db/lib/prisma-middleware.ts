import { createLogger } from "@lumen/logger";
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
          async create({ args, query }) {
            if (!isEncryptionConfigured()) {
              logger.warn(
                "JWKS encryption not configured - JWKS_ENCRYPTION_KEY environment variable missing. " +
                  "Private keys will be stored as plaintext. Generate a key with: openssl rand -base64 32"
              );
              return query(args);
            }

            if (args.data.privateKey) {
              args.data.privateKey = await encryptPrivateKey(
                args.data.privateKey
              );
            }
            return query(args);
          },

          async update({ args, query }) {
            if (!isEncryptionConfigured()) {
              return query(args);
            }

            if (args.data.privateKey) {
              args.data.privateKey = await encryptPrivateKey(
                args.data.privateKey as string
              );
            }
            return query(args);
          },

          async upsert({ args, query }) {
            if (!isEncryptionConfigured()) {
              return query(args);
            }

            if (args.create.privateKey) {
              args.create.privateKey = await encryptPrivateKey(
                args.create.privateKey
              );
            }
            if (args.update.privateKey) {
              args.update.privateKey = await encryptPrivateKey(
                args.update.privateKey as string
              );
            }
            return query(args);
          },

          async findUnique({ args, query }) {
            const result = await query(args);
            if (!(isEncryptionConfigured() && result?.privateKey)) {
              return result;
            }

            try {
              result.privateKey = await decryptPrivateKey(result.privateKey);
            } catch (error) {
              logger.error("Failed to decrypt private key on read", {
                jwksId: result.id,
                error: error instanceof Error ? error.message : "Unknown error",
              });
              throw error;
            }
            return result;
          },

          async findFirst({ args, query }) {
            const result = await query(args);
            if (!(isEncryptionConfigured() && result?.privateKey)) {
              return result;
            }

            try {
              result.privateKey = await decryptPrivateKey(result.privateKey);
            } catch (error) {
              logger.error("Failed to decrypt private key on read", {
                jwksId: result.id,
                error: error instanceof Error ? error.message : "Unknown error",
              });
              throw error;
            }
            return result;
          },

          async findMany({ args, query }) {
            const result = await query(args);
            if (!isEncryptionConfigured()) {
              return result;
            }

            for (const item of result) {
              if (item?.privateKey) {
                try {
                  item.privateKey = await decryptPrivateKey(item.privateKey);
                } catch (error) {
                  logger.error("Failed to decrypt private key on read", {
                    jwksId: item.id,
                    error:
                      error instanceof Error ? error.message : "Unknown error",
                  });
                  throw error;
                }
              }
            }
            return result;
          },
        },
      },
    })
  );
}

export const createJwksEncryptionMiddleware = createJwksEncryptionExtension;
