import { beforeEach, describe, expect, it, mock } from "bun:test";

const noop = () => {
  // intentionally empty mock
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

const encryptPrivateKeyMock = mock<(plaintext: string) => Promise<string>>(
  async (plaintext: string) => `encrypted:${plaintext}`
);

const decryptPrivateKeyMock = mock<(data: string) => Promise<string>>(
  (data: string) => {
    if (typeof data === "string" && data.startsWith("encrypted:")) {
      return Promise.resolve(data.slice("encrypted:".length));
    }
    return Promise.reject(
      new Error("Decryption failed - data may be corrupted or key is incorrect")
    );
  }
);

let encryptionConfigured = true;

mock.module("./jwks-encryption", () => ({
  encryptPrivateKey: encryptPrivateKeyMock,
  decryptPrivateKey: decryptPrivateKeyMock,
  isEncryptionConfigured: () => encryptionConfigured,
}));

type QueryFn = (args: {
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
}) => Promise<unknown>;

mock.module("../../prisma/generated/prisma/client", () => ({
  Prisma: {
    defineExtension: (factory: (...args: unknown[]) => unknown) => factory,
  },
}));

import { createJwksEncryptionExtension } from "./prisma-middleware";

function buildHandlers(): Record<string, QueryFn> {
  const client = {
    $extends: (config: Record<string, unknown>) => {
      const ext = config as { query: { jwks: Record<string, QueryFn> } };
      return ext.query.jwks;
    },
  };

  const factory = createJwksEncryptionExtension();
  return factory(client) as unknown as Record<string, QueryFn>;
}

describe("prisma-middleware", () => {
  beforeEach(() => {
    encryptPrivateKeyMock.mockClear();
    decryptPrivateKeyMock.mockClear();
    loggerMock.warn.mockClear();
    loggerMock.error.mockClear();
    encryptionConfigured = true;
  });

  describe("middleware initialization", () => {
    it("exports createJwksEncryptionExtension function", () => {
      expect(typeof createJwksEncryptionExtension).toBe("function");
    });

    it("returns a function when called", () => {
      const extension = createJwksEncryptionExtension();
      expect(typeof extension).toBe("function");
    });

    it("builds handlers object with all expected query methods", () => {
      const handlers = buildHandlers();
      expect(typeof handlers.create).toBe("function");
      expect(typeof handlers.update).toBe("function");
      expect(typeof handlers.upsert).toBe("function");
      expect(typeof handlers.findUnique).toBe("function");
      expect(typeof handlers.findFirst).toBe("function");
      expect(typeof handlers.findMany).toBe("function");
    });
  });

  describe("create operation", () => {
    it("encrypts privateKey before query execution when configured", async () => {
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({
          id: "1",
          privateKey: (_args.data as any).privateKey,
        })
      );

      await handlers.create?.({
        args: { data: { privateKey: "my-raw-key", kid: "k1" } },
        query: queryFn,
      });

      expect(encryptPrivateKeyMock).toHaveBeenCalledWith("my-raw-key");
      expect(queryFn).toHaveBeenCalledWith({
        data: { privateKey: "encrypted:my-raw-key", kid: "k1" },
      });
    });

    it("decrypts privateKey in result after successful creation", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve({ id: "1", privateKey: "encrypted:stored-key" })
      );

      const result = (await handlers.create?.({
        args: { data: { privateKey: "my-raw-key", kid: "k1" } },
        query: queryFn,
      })) as { id: string; privateKey: string };

      expect(decryptPrivateKeyMock).toHaveBeenCalledWith(
        "encrypted:stored-key"
      );
      expect(result.privateKey).toBe("stored-key");
    });

    it("passes through unchanged when encryption is not configured", async () => {
      encryptionConfigured = false;
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({
          id: "1",
          ...(_args.data as Record<string, unknown>),
        })
      );

      await handlers.create?.({
        args: { data: { privateKey: "plaintext-key", kid: "k1" } },
        query: queryFn,
      });

      expect(encryptPrivateKeyMock).not.toHaveBeenCalled();
      expect(decryptPrivateKeyMock).not.toHaveBeenCalled();
      expect(queryFn).toHaveBeenCalledWith({
        data: { privateKey: "plaintext-key", kid: "k1" },
      });
    });

    it("passes through when privateKey is not in data", async () => {
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({
          id: "1",
          ...(_args.data as Record<string, unknown>),
        })
      );

      await handlers.create?.({
        args: { data: { kid: "k1", publicKey: "pub" } },
        query: queryFn,
      });

      expect(encryptPrivateKeyMock).not.toHaveBeenCalled();
    });

    it("re-throws encryption errors and records span error", async () => {
      encryptPrivateKeyMock.mockRejectedValueOnce(new Error("encrypt failed"));
      const handlers = buildHandlers();

      const queryFn = mock(() => Promise.resolve({ id: "1" }));

      await expect(
        handlers.create?.({
          args: { data: { privateKey: "bad-key", kid: "k1" } },
          query: queryFn,
        })
      ).rejects.toThrow("encrypt failed");
    });

    it("re-throws decryption errors on result", async () => {
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({ id: "1", privateKey: "bad-data" })
      );

      await expect(
        handlers.create?.({
          args: { data: { privateKey: "my-raw-key", kid: "k1" } },
          query: queryFn,
        })
      ).rejects.toThrow("Decryption failed");
    });
  });

  describe("update operation", () => {
    it("encrypts privateKey before query execution when configured", async () => {
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({
          id: "1",
          ...(_args.data as Record<string, unknown>),
        })
      );

      await handlers.update?.({
        args: { data: { privateKey: "updated-key" } },
        query: queryFn,
      });

      expect(encryptPrivateKeyMock).toHaveBeenCalledWith("updated-key");
      expect(queryFn).toHaveBeenCalledWith({
        data: { privateKey: "encrypted:updated-key" },
      });
    });

    it("passes through when encryption is not configured", async () => {
      encryptionConfigured = false;
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({
          id: "1",
          ...(_args.data as Record<string, unknown>),
        })
      );

      await handlers.update?.({
        args: { data: { privateKey: "updated-key" } },
        query: queryFn,
      });

      expect(encryptPrivateKeyMock).not.toHaveBeenCalled();
      expect(queryFn).toHaveBeenCalledWith({
        data: { privateKey: "updated-key" },
      });
    });

    it("re-throws encryption errors and records span error", async () => {
      encryptPrivateKeyMock.mockRejectedValueOnce(
        new Error("update encrypt failed")
      );
      const handlers = buildHandlers();

      const queryFn = mock(() => Promise.resolve({ id: "1" }));

      await expect(
        handlers.update?.({
          args: { data: { privateKey: "bad-key" } },
          query: queryFn,
        })
      ).rejects.toThrow("update encrypt failed");
    });

    it("passes through when privateKey is not in update data", async () => {
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({
          id: "1",
          ...(_args.data as Record<string, unknown>),
        })
      );

      await handlers.update?.({
        args: { data: { publicKey: "new-pub-key" } },
        query: queryFn,
      });

      expect(encryptPrivateKeyMock).not.toHaveBeenCalled();
    });
  });

  describe("upsert operation", () => {
    it("encrypts both create.privateKey and update.privateKey when configured", async () => {
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({ id: "1", privateKey: _args.create })
      );

      await handlers.upsert?.({
        args: {
          create: { privateKey: "create-key", kid: "k1" },
          update: { privateKey: "update-key" },
        },
        query: queryFn,
      });

      expect(encryptPrivateKeyMock).toHaveBeenCalledWith("create-key");
      expect(encryptPrivateKeyMock).toHaveBeenCalledWith("update-key");
      expect(encryptPrivateKeyMock).toHaveBeenCalledTimes(2);
    });

    it("passes through when encryption is not configured", async () => {
      encryptionConfigured = false;
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({
          id: "1",
          ...(_args.create as Record<string, unknown>),
        })
      );

      await handlers.upsert?.({
        args: {
          create: { privateKey: "create-key" },
          update: { privateKey: "update-key" },
        },
        query: queryFn,
      });

      expect(encryptPrivateKeyMock).not.toHaveBeenCalled();
    });

    it("re-throws create encryption errors", async () => {
      encryptPrivateKeyMock.mockRejectedValueOnce(
        new Error("create encrypt failed")
      );
      const handlers = buildHandlers();

      const queryFn = mock(() => Promise.resolve({ id: "1" }));

      await expect(
        handlers.upsert?.({
          args: {
            create: { privateKey: "bad-create-key" },
            update: { privateKey: "update-key" },
          },
          query: queryFn,
        })
      ).rejects.toThrow("create encrypt failed");
    });

    it("re-throws update encryption errors", async () => {
      // First call succeeds (for create), second call fails (for update)
      encryptPrivateKeyMock
        .mockResolvedValueOnce("encrypted:create-key")
        .mockRejectedValueOnce(new Error("update encrypt failed"));
      const handlers = buildHandlers();

      const queryFn = mock(() => Promise.resolve({ id: "1" }));

      await expect(
        handlers.upsert?.({
          args: {
            create: { privateKey: "create-key" },
            update: { privateKey: "bad-update-key" },
          },
          query: queryFn,
        })
      ).rejects.toThrow("update encrypt failed");
    });

    it("handles upsert with only create.privateKey", async () => {
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({ id: "1" })
      );

      await handlers.upsert?.({
        args: {
          create: { privateKey: "create-key" },
          update: {},
        },
        query: queryFn,
      });

      expect(encryptPrivateKeyMock).toHaveBeenCalledTimes(1);
      expect(encryptPrivateKeyMock).toHaveBeenCalledWith("create-key");
    });

    it("handles upsert with only update.privateKey", async () => {
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({ id: "1" })
      );

      await handlers.upsert?.({
        args: {
          create: {},
          update: { privateKey: "update-key" },
        },
        query: queryFn,
      });

      expect(encryptPrivateKeyMock).toHaveBeenCalledTimes(1);
      expect(encryptPrivateKeyMock).toHaveBeenCalledWith("update-key");
    });

    it("handles upsert with neither create nor update privateKey", async () => {
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({ id: "1" })
      );

      await handlers.upsert?.({
        args: {
          create: { kid: "k1" },
          update: { publicKey: "pub" },
        },
        query: queryFn,
      });

      expect(encryptPrivateKeyMock).not.toHaveBeenCalled();
    });
  });

  describe("findUnique operation", () => {
    it("decrypts privateKey on read when configured", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve({ id: "1", privateKey: "encrypted:stored-key" })
      );

      const result = (await handlers.findUnique?.({
        args: { where: { id: "1" } },
        query: queryFn,
      })) as { id: string; privateKey: string };

      expect(decryptPrivateKeyMock).toHaveBeenCalledWith(
        "encrypted:stored-key"
      );
      expect(result.privateKey).toBe("stored-key");
    });

    it("returns result unchanged when encryption is not configured", async () => {
      encryptionConfigured = false;
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve({ id: "1", privateKey: "plaintext-key" })
      );

      const result = (await handlers.findUnique?.({
        args: { where: { id: "1" } },
        query: queryFn,
      })) as { id: string; privateKey: string };

      expect(decryptPrivateKeyMock).not.toHaveBeenCalled();
      expect(result.privateKey).toBe("plaintext-key");
    });

    it("returns null result unchanged", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() => Promise.resolve(null));

      const result = await handlers.findUnique?.({
        args: { where: { id: "nonexistent" } },
        query: queryFn,
      });

      expect(result).toBeNull();
      expect(decryptPrivateKeyMock).not.toHaveBeenCalled();
    });

    it("returns result unchanged when privateKey is null", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve({ id: "1", privateKey: null })
      );

      const result = (await handlers.findUnique?.({
        args: { where: { id: "1" } },
        query: queryFn,
      })) as { id: string; privateKey: null };

      expect(result.privateKey).toBeNull();
      expect(decryptPrivateKeyMock).not.toHaveBeenCalled();
    });

    it("surfaces decryption errors instead of silently returning bad data", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve({
          id: "1",
          privateKey: "corrupted-data-not-encrypted",
        })
      );

      await expect(
        handlers.findUnique?.({
          args: { where: { id: "1" } },
          query: queryFn,
        })
      ).rejects.toThrow("Decryption failed");
    });
  });

  describe("findFirst operation", () => {
    it("decrypts privateKey on read when configured", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve({ id: "1", privateKey: "encrypted:found-key" })
      );

      const result = (await handlers.findFirst?.({
        args: {},
        query: queryFn,
      })) as { id: string; privateKey: string };

      expect(decryptPrivateKeyMock).toHaveBeenCalledWith("encrypted:found-key");
      expect(result.privateKey).toBe("found-key");
    });

    it("returns null when no record found", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() => Promise.resolve(null));

      const result = await handlers.findFirst?.({
        args: {},
        query: queryFn,
      });

      expect(result).toBeNull();
      expect(decryptPrivateKeyMock).not.toHaveBeenCalled();
    });

    it("returns result unchanged when encryption not configured", async () => {
      encryptionConfigured = false;
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve({ id: "1", privateKey: "plaintext-key" })
      );

      const result = (await handlers.findFirst?.({
        args: {},
        query: queryFn,
      })) as { id: string; privateKey: string };

      expect(decryptPrivateKeyMock).not.toHaveBeenCalled();
      expect(result.privateKey).toBe("plaintext-key");
    });

    it("surfaces decryption errors", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve({ id: "1", privateKey: "bad-data" })
      );

      await expect(
        handlers.findFirst?.({ args: {}, query: queryFn })
      ).rejects.toThrow("Decryption failed");
    });

    it("returns result unchanged when privateKey is undefined", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() => Promise.resolve({ id: "1" }));

      const result = (await handlers.findFirst?.({
        args: {},
        query: queryFn,
      })) as { id: string; privateKey?: string };

      expect(result.privateKey).toBeUndefined();
      expect(decryptPrivateKeyMock).not.toHaveBeenCalled();
    });
  });

  describe("findMany operation", () => {
    it("decrypts each item's privateKey when configured", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve([
          { id: "1", privateKey: "encrypted:key-a" },
          { id: "2", privateKey: "encrypted:key-b" },
        ])
      );

      const result = (await handlers.findMany?.({
        args: {},
        query: queryFn,
      })) as Array<{ id: string; privateKey: string }>;

      expect(decryptPrivateKeyMock).toHaveBeenCalledTimes(2);
      expect(result[0]?.privateKey).toBe("key-a");
      expect(result[1]?.privateKey).toBe("key-b");
    });

    it("returns result unchanged when encryption is not configured", async () => {
      encryptionConfigured = false;
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve([
          { id: "1", privateKey: "plaintext-a" },
          { id: "2", privateKey: "plaintext-b" },
        ])
      );

      const result = (await handlers.findMany?.({
        args: {},
        query: queryFn,
      })) as Array<{ id: string; privateKey: string }>;

      expect(decryptPrivateKeyMock).not.toHaveBeenCalled();
      expect(result[0]?.privateKey).toBe("plaintext-a");
      expect(result[1]?.privateKey).toBe("plaintext-b");
    });

    it("handles items without privateKey gracefully", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve([
          { id: "1", privateKey: "encrypted:key-a" },
          { id: "2", privateKey: null },
          { id: "3", privateKey: "encrypted:key-c" },
        ])
      );

      const result = (await handlers.findMany?.({
        args: {},
        query: queryFn,
      })) as Array<{ id: string; privateKey: string | null }>;

      expect(decryptPrivateKeyMock).toHaveBeenCalledTimes(2);
      expect(result[0]?.privateKey).toBe("key-a");
      expect(result[1]?.privateKey).toBeNull();
      expect(result[2]?.privateKey).toBe("key-c");
    });

    it("handles empty array result", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() => Promise.resolve([]));

      const result = (await handlers.findMany?.({
        args: {},
        query: queryFn,
      })) as Array<{ id: string; privateKey: string }>;

      expect(result).toHaveLength(0);
      expect(decryptPrivateKeyMock).not.toHaveBeenCalled();
    });

    it("surfaces decryption errors for any item", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve([
          { id: "1", privateKey: "encrypted:valid" },
          { id: "2", privateKey: "corrupt-not-encrypted" },
        ])
      );

      await expect(
        handlers.findMany?.({ args: {}, query: queryFn })
      ).rejects.toThrow("Decryption failed");
    });

    it("handles items without privateKey field", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve([
          { id: "1", privateKey: "encrypted:key-a" },
          { id: "2", kid: "k2" },
          { id: "3", privateKey: "encrypted:key-c" },
        ])
      );

      const result = (await handlers.findMany?.({
        args: {},
        query: queryFn,
      })) as Array<{ id: string; privateKey?: string }>;

      expect(decryptPrivateKeyMock).toHaveBeenCalledTimes(2);
      expect(result[0]?.privateKey).toBe("key-a");
      expect(result[1]?.privateKey).toBeUndefined();
      expect(result[2]?.privateKey).toBe("key-c");
    });
  });

  describe("error handling", () => {
    it("preserves other data fields during encryption", async () => {
      const handlers = buildHandlers();

      const queryFn = mock((_args: Record<string, unknown>) =>
        Promise.resolve({
          id: "1",
          ...(_args.data as Record<string, unknown>),
        })
      );

      await handlers.create?.({
        args: {
          data: {
            privateKey: "my-raw-key",
            kid: "k1",
            publicKey: "pub-key",
            extraField: "extra-value",
          },
        },
        query: queryFn,
      });

      expect(queryFn).toHaveBeenCalledWith({
        data: {
          privateKey: "encrypted:my-raw-key",
          kid: "k1",
          publicKey: "pub-key",
          extraField: "extra-value",
        },
      });
    });

    it("handles encryption failure gracefully with proper error", async () => {
      encryptPrivateKeyMock.mockRejectedValueOnce(
        new Error("crypto operation failed")
      );
      const handlers = buildHandlers();

      const queryFn = mock(() => Promise.resolve({ id: "1" }));

      await expect(
        handlers.create?.({
          args: { data: { privateKey: "key-that-fails", kid: "k1" } },
          query: queryFn,
        })
      ).rejects.toThrow("crypto operation failed");
    });

    it("handles decryption failure gracefully with proper error", async () => {
      const handlers = buildHandlers();

      const queryFn = mock(() =>
        Promise.resolve({ id: "1", privateKey: "invalid-encrypted-data" })
      );

      await expect(
        handlers.findUnique?.({
          args: { where: { id: "1" } },
          query: queryFn,
        })
      ).rejects.toThrow("Decryption failed");
    });
  });

  describe("createJwksEncryptionMiddleware alias", () => {
    it("exports createJwksEncryptionMiddleware as alias", async () => {
      // We need to re-import to get the named export
      const { createJwksEncryptionMiddleware } = await import(
        "./prisma-middleware"
      );
      expect(typeof createJwksEncryptionMiddleware).toBe("function");
      expect(createJwksEncryptionMiddleware).toBe(
        createJwksEncryptionExtension
      );
    });
  });
});
