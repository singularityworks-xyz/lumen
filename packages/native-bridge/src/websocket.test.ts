import { afterEach, describe, expect, it, mock } from "bun:test";

interface MockWindow {
  __TAURI_INTERNALS__?: object | undefined;
}

const originalWindow = globalThis.window;

function setMockWindow(win: MockWindow | undefined) {
  Object.defineProperty(globalThis, "window", {
    writable: true,
    configurable: true,
    value: win,
  });
}

afterEach(() => {
  if (originalWindow === undefined) {
    setMockWindow(undefined);
  } else {
    globalThis.window = originalWindow;
  }
});

describe("websocket", () => {
  describe("connectWebSocket", () => {
    it("creates browser WebSocket in web context", async () => {
      setMockWindow({});
      const { connectWebSocket } = await import("../websocket");
      const ws = await connectWebSocket("ws://localhost:8080");
      expect(ws).toBeInstanceOf(WebSocket);
      ws.close();
    });

    it("creates browser WebSocket in SSR context", async () => {
      setMockWindow(undefined);
      const { connectWebSocket } = await import("../websocket");
      const ws = await connectWebSocket("ws://localhost:8080");
      expect(ws).toBeInstanceOf(WebSocket);
      ws.close();
    });

    it("falls back to browser WebSocket when native import fails", async () => {
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { connectWebSocket } = await import("../websocket");
      const ws = await connectWebSocket("ws://localhost:8080");
      expect(ws).toBeInstanceOf(WebSocket);
      ws.close();
    });

    it("uses native WebSocket when Tauri plugin is available", async () => {
      const mockConnect = mock(() =>
        Promise.resolve({ send: mock(), close: mock() })
      );
      mock.module("@tauri-apps/plugin-websocket", () => ({
        default: { connect: mockConnect },
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      const { connectWebSocket } = await import("../websocket");
      const ws = await connectWebSocket("ws://localhost:8080");
      expect(mockConnect).toHaveBeenCalledWith("ws://localhost:8080");
      expect(ws).toHaveProperty("send");
      expect(ws).toHaveProperty("close");
    });

    it("logs warning and falls back when native connect rejects", async () => {
      const warnSpy = mock(() => undefined);
      const origWarn = console.warn;
      console.warn = warnSpy;
      mock.module("@tauri-apps/plugin-websocket", () => ({
        default: {
          connect: () => Promise.reject(new Error("connection refused")),
        },
      }));
      setMockWindow({ __TAURI_INTERNALS__: {} });
      try {
        const { connectWebSocket } = await import("../websocket");
        const ws = await connectWebSocket("ws://localhost:8080");
        expect(warnSpy).toHaveBeenCalled();
        expect(ws).toBeInstanceOf(WebSocket);
        ws.close();
      } finally {
        console.warn = origWarn;
      }
    });
  });
});
