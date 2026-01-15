import { createLogger } from "@lumen/logger";

const logger = createLogger({ name: "ai:encryption" });
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 128; // Authentication tag length in bits
const ENCRYPTED_PREFIX = "enc:v1:";

let cachedKey: CryptoKey | null = null;

async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) {
    return cachedKey;
  }

  const keyMaterial = process.env.AI_ENCRYPTION_KEY;

  if (!keyMaterial) {
    throw new Error(
      "AI_ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: openssl rand -base64 32"
    );
  }

  const keyBytes = Buffer.from(keyMaterial, "base64");

  if (keyBytes.length < 32) {
    throw new Error(
      "AI_ENCRYPTION_KEY must be at least 32 bytes (256 bits). " +
        "Generate one with: openssl rand -base64 32"
    );
  }

  cachedKey = await crypto.subtle.importKey(
    "raw",
    keyBytes.slice(0, 32), // Use first 32 bytes
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // Not extractable
    ["encrypt", "decrypt"]
  );

  return cachedKey;
}

export function isEncryptionEnabled(): boolean {
  return Boolean(process.env.AI_ENCRYPTION_KEY);
}

export async function encryptContent(plaintext: string): Promise<string> {
  if (!isEncryptionEnabled()) {
    // Encryption not configured, return plaintext
    return plaintext;
  }

  try {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const plaintextBytes = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv,
        tagLength: TAG_LENGTH,
      },
      key,
      plaintextBytes
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    const encoded = Buffer.from(combined).toString("base64");

    return `${ENCRYPTED_PREFIX}${encoded}`;
  } catch (error) {
    logger.error("Failed to encrypt message content", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return plaintext;
  }
}

export async function decryptContent(ciphertext: string): Promise<string> {
  // Check if this is encrypted content
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    return ciphertext;
  }

  if (!isEncryptionEnabled()) {
    logger.warn(
      "Encrypted content found but AI_ENCRYPTION_KEY not set. Cannot decrypt."
    );
    return "[Encrypted content - key not available]";
  }

  try {
    const key = await getEncryptionKey();

    // Remove prefix and decode base64
    const encoded = ciphertext.slice(ENCRYPTED_PREFIX.length);
    const combined = Buffer.from(encoded, "base64");

    // Extract IV and ciphertext
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);

    // Decrypt
    const plaintextBytes = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv,
        tagLength: TAG_LENGTH,
      },
      key,
      encryptedData
    );

    return new TextDecoder().decode(plaintextBytes);
  } catch (error) {
    logger.error("Failed to decrypt message content", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return "[Decryption failed]";
  }
}

export function isEncrypted(content: string): boolean {
  return content.startsWith(ENCRYPTED_PREFIX);
}
