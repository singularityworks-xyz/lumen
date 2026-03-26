import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const noop = () => {
  /* intentionally empty mock */
};

const loggerMock = {
  info: mock(noop),
  warn: mock(noop),
  error: mock(noop),
  debug: mock(noop),
};

mock.module("@lumen/logger", () => ({
  createLogger: () => loggerMock,
}));

const mockSpan = {
  end: mock(noop),
  recordException: mock(noop),
  setStatus: mock(noop),
  setAttributes: mock(noop),
  addEvent: mock(noop),
  spanContext: () => ({ traceId: "trace-1", spanId: "span-1" }),
};

mock.module("@lumen/logger/server", () => ({
  withSpanAsync: <T>(_name: string, fn: (span: unknown) => Promise<T>) =>
    fn(mockSpan),
  recordSpanError: mock(noop),
}));

import {
  decryptPrivateKey,
  encryptPrivateKey,
  isEncryptionConfigured,
} from "./lib/jwks-encryption";

const TEST_KEY = "a]W3$kL9@mNp2&xQ7*vR4!zT6^yU0";

describe("jwks-encryption", () => {
  const originalEnv = process.env.JWKS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.JWKS_ENCRYPTION_KEY = TEST_KEY;
    loggerMock.error.mockClear();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      process.env.JWKS_ENCRYPTION_KEY = "";
    } else {
      process.env.JWKS_ENCRYPTION_KEY = originalEnv;
    }
  });

  describe("encryptPrivateKey / decryptPrivateKey", () => {
    it("round-trips a plaintext string", async () => {
      const plaintext = "my-private-key-data-12345";
      const encrypted = await encryptPrivateKey(plaintext);
      const decrypted = await decryptPrivateKey(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("round-trips unicode content", async () => {
      const plaintext = "clé privée 日本語 🔑";
      const encrypted = await encryptPrivateKey(plaintext);
      const decrypted = await decryptPrivateKey(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("produces base64-encoded output", async () => {
      const encrypted = await encryptPrivateKey("test-data");
      expect(() => Buffer.from(encrypted, "base64")).not.toThrow();
    });

    it("produces different ciphertexts for the same plaintext (random salt/iv)", async () => {
      const plaintext = "same-key";
      const a = await encryptPrivateKey(plaintext);
      const b = await encryptPrivateKey(plaintext);
      expect(a).not.toBe(b);
      expect(await decryptPrivateKey(a)).toBe(plaintext);
      expect(await decryptPrivateKey(b)).toBe(plaintext);
    });

    it("output contains salt(32) + iv(12) + encrypted data", async () => {
      const encrypted = await encryptPrivateKey("short");
      const buf = Buffer.from(encrypted, "base64");
      expect(buf.length).toBeGreaterThan(44);
    });
  });

  describe("error handling", () => {
    it("encrypt throws when JWKS_ENCRYPTION_KEY is missing", async () => {
      process.env.JWKS_ENCRYPTION_KEY = "";
      await expect(encryptPrivateKey("data")).rejects.toThrow(
        "Encryption failed"
      );
    });

    it("decrypt throws when JWKS_ENCRYPTION_KEY is missing", async () => {
      process.env.JWKS_ENCRYPTION_KEY = "";
      await expect(decryptPrivateKey("dG9vLXNob3J0")).rejects.toThrow(
        "Decryption failed"
      );
    });

    it("decrypt fails on corrupted ciphertext", async () => {
      const plaintext = "valid-key";
      const encrypted = await encryptPrivateKey(plaintext);
      const buf = Buffer.from(encrypted, "base64");
      // Corrupt the encrypted portion (flip bytes after salt+iv)
      const corrupted = new Uint8Array(buf);
      for (let i = 44; i < corrupted.length; i++) {
        corrupted[i] = 255 - corrupted[i]!;
      }
      const corruptedBase64 = Buffer.from(corrupted).toString("base64");
      await expect(decryptPrivateKey(corruptedBase64)).rejects.toThrow(
        "Decryption failed"
      );
    });

    it("decrypt fails on truncated input", async () => {
      const shortInput = Buffer.from("too-short-for-valid-format").toString(
        "base64"
      );
      await expect(decryptPrivateKey(shortInput)).rejects.toThrow(
        "Decryption failed"
      );
    });

    it("decrypt fails with wrong key", async () => {
      const plaintext = "secret-key";
      const encrypted = await encryptPrivateKey(plaintext);
      process.env.JWKS_ENCRYPTION_KEY = "completely-different-key-98765!";
      await expect(decryptPrivateKey(encrypted)).rejects.toThrow(
        "Decryption failed"
      );
    });

    it("encrypt throws with actionable error message", async () => {
      process.env.JWKS_ENCRYPTION_KEY = "";
      await expect(encryptPrivateKey("data")).rejects.toThrow(
        "Encryption failed"
      );
    });

    it("decrypt throws with actionable error message", async () => {
      process.env.JWKS_ENCRYPTION_KEY = "";
      await expect(decryptPrivateKey("c2hvcnQ")).rejects.toThrow(
        "Decryption failed - data may be corrupted or key is incorrect"
      );
    });
  });

  describe("isEncryptionConfigured", () => {
    it("returns true when JWKS_ENCRYPTION_KEY is set", () => {
      process.env.JWKS_ENCRYPTION_KEY = "some-key";
      expect(isEncryptionConfigured()).toBe(true);
    });

    it("returns false when JWKS_ENCRYPTION_KEY is empty", () => {
      process.env.JWKS_ENCRYPTION_KEY = "";
      expect(isEncryptionConfigured()).toBe(false);
    });

    it("returns false when JWKS_ENCRYPTION_KEY is not set", () => {
      process.env.JWKS_ENCRYPTION_KEY = "";
      expect(isEncryptionConfigured()).toBe(false);
    });
  });
});
