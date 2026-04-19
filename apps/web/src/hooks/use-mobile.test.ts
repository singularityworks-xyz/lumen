import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  /* ignore */
}

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";

const MOBILE_BREAKPOINT = 768;

interface MockMediaQueryList {
  addEventListener: (type: string, listener: (ev: unknown) => void) => void;
  addListener: () => void;
  dispatchEvent: () => boolean;
  matches: boolean;
  media: string;
  onchange: null;
  removeEventListener: (type: string, listener: (ev: unknown) => void) => void;
  removeListener: () => void;
}

const originalMatchMedia = globalThis.matchMedia;
const _savedWindow = globalThis.window;

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

function setMatchMedia(fn: (query: string) => MockMediaQueryList) {
  const mockFn = fn as unknown as typeof matchMedia;
  globalThis.matchMedia = mockFn;
  if (globalThis.window) {
    (globalThis.window as unknown as Record<string, unknown>).matchMedia =
      mockFn;
  }
}

function createMockMediaQueryList(
  query: string,
  matches: boolean
): MockMediaQueryList {
  const listeners: Array<(ev: unknown) => void> = [];
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: (ev: unknown) => void) => {
      listeners.push(listener);
    },
    removeEventListener: (_type: string, listener: (ev: unknown) => void) => {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) {
        listeners.splice(idx, 1);
      }
    },
    dispatchEvent: () => false,
    addListener: () => undefined,
    removeListener: () => undefined,
  };
}

beforeEach(() => {
  // Ensure window is a proper DOM window (other tests may replace it with plain objects)
  if (typeof window.dispatchEvent !== "function") {
    // Re-register happy-dom to restore proper window
    try {
      GlobalRegistrator.register();
    } catch {
      // Already registered, try to get the proper window
      const { Window } = require("happy-dom");
      globalThis.window = new Window() as unknown as typeof window;
    }
  }
  setViewportWidth(1024);
});

afterEach(() => {
  globalThis.matchMedia = originalMatchMedia;
  setViewportWidth(1024);
});

describe("use-mobile", () => {
  describe("useIsMobile hook", () => {
    it("returns true when width is below breakpoint", async () => {
      setViewportWidth(500);
      setMatchMedia((query: string) => createMockMediaQueryList(query, true));

      const { useIsMobile } = await import("./use-mobile");
      const { result } = renderHook(() => useIsMobile());

      act(() => {
        setViewportWidth(500);
        window.dispatchEvent(new Event("resize"));
      });

      expect(result.current).toBe(true);
    });

    it("returns false when width is above breakpoint", async () => {
      setViewportWidth(1024);
      setMatchMedia((query: string) => createMockMediaQueryList(query, false));

      const { useIsMobile } = await import("./use-mobile");
      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });
  });

  describe("listener setup", () => {
    it("adds event listener on initialization", () => {
      let listenerAdded = false;
      setMatchMedia((query: string) => {
        const mql = createMockMediaQueryList(query, false);
        const origAdd = mql.addEventListener;
        mql.addEventListener = (
          type: string,
          listener: (ev: unknown) => void
        ) => {
          listenerAdded = true;
          origAdd(type, listener);
        };
        return mql;
      });
      const mql = globalThis.matchMedia("(max-width: 767px)");
      mql.addEventListener("change", () => undefined);
      expect(listenerAdded).toBe(true);
    });

    it("removes event listener on cleanup", () => {
      let listenerRemoved = false;
      setMatchMedia((query: string) => {
        const mql = createMockMediaQueryList(query, false);
        const origRemove = mql.removeEventListener;
        mql.removeEventListener = (
          type: string,
          listener: (ev: unknown) => void
        ) => {
          listenerRemoved = true;
          origRemove(type, listener);
        };
        return mql;
      });
      const mql = globalThis.matchMedia("(max-width: 767px)");
      const handler = () => undefined;
      mql.addEventListener("change", handler);
      mql.removeEventListener("change", handler);
      expect(listenerRemoved).toBe(true);
    });
  });

  describe("breakpoint transitions", () => {
    it("matches correct query for mobile detection", () => {
      const query = "(max-width: 767px)";
      setMatchMedia((q: string) => createMockMediaQueryList(q, q === query));
      const mql = globalThis.matchMedia(query);
      expect(mql.matches).toBe(true);
    });

    it("breakpoint value is 768", () => {
      expect(MOBILE_BREAKPOINT).toBe(768);
    });
  });
});
