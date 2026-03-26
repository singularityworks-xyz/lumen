import { createLogger } from "@lumen/logger";
import { recordSpanError, withSpanAsync } from "@lumen/logger/server";

const logger = createLogger({ name: "db:jwks-encryption" });

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 32;

// Derive a cryptographic key from password using Bun's crypto, Uses PBKDF2 with SHA-256
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations = 100_000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH * 8 },
    false,
    ["encrypt", "decrypt"]
  );
}

function getMasterSecret(): string {
  const masterSecret = process.env.JWKS_ENCRYPTION_KEY;

  if (!masterSecret) {
    throw new Error(
      "JWKS_ENCRYPTION_KEY environment variable is required. Generate one with: openssl rand -base64 32"
    );
  }

  return masterSecret;
}

/**
 * Encrypt a private key using AES-256-GCM with authenticated encryption.
 * Uses Bun's Web Crypto API for secure, performant encryption.
 * Format: salt(32) + iv(12) + encryptedData (auth tag is included in encrypted output)
 */
export function encryptPrivateKey(plaintext: string): Promise<string> {
  return withSpanAsync("crypto.encryptJwks", async (span) => {
    try {
      const masterSecret = getMasterSecret();
      const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
      const encryptionKey = await deriveKey(masterSecret, salt);
      const encoder = new TextEncoder();
      const plaintextBytes = encoder.encode(plaintext);
      const encrypted = await crypto.subtle.encrypt(
        {
          name: ALGORITHM,
          iv,
        },
        encryptionKey,
        plaintextBytes
      );

      const encryptedArray = new Uint8Array(encrypted);
      const result = new Uint8Array(
        SALT_LENGTH + IV_LENGTH + encryptedArray.length
      );
      result.set(salt, 0);
      result.set(iv, SALT_LENGTH);
      result.set(encryptedArray, SALT_LENGTH + IV_LENGTH);

      return Buffer.from(result).toString("base64");
    } catch (error) {
      recordSpanError(span, error);
      logger.error("Failed to encrypt private key", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Encryption failed");
    }
  });
}

/**
 * Decrypt a private key using AES-256-GCM with authenticated encryption.
 * Uses Bun's Web Crypto API for secure, performant decryption.
 */
export function decryptPrivateKey(encryptedData: string): Promise<string> {
  return withSpanAsync("crypto.decryptJwks", async (span) => {
    try {
      const masterSecret = getMasterSecret();
      const buffer = Buffer.from(encryptedData, "base64");
      const salt = buffer.subarray(0, SALT_LENGTH);
      const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH);
      const encryptionKey = await deriveKey(masterSecret, salt);
      const decrypted = await crypto.subtle.decrypt(
        {
          name: ALGORITHM,
          iv,
        },
        encryptionKey,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      recordSpanError(span, error);
      logger.error("Failed to decrypt private key", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error(
        "Decryption failed - data may be corrupted or key is incorrect"
      );
    }
  });
}

export function isEncryptionConfigured(): boolean {
  return !!process.env.JWKS_ENCRYPTION_KEY;
}
