import "./bun.setup";
import { afterEach, beforeEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";

GlobalRegistrator.register();

const originalIndexedDB = globalThis.indexedDB;

beforeEach(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {
      // no-op
    }
    unobserve() {
      // no-op
    }
    disconnect() {
      // no-op
    }
  };

  globalThis.IntersectionObserver = class IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];
    observe() {
      // no-op
    }
    unobserve() {
      // no-op
    }
    disconnect() {
      // no-op
    }
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;

  globalThis.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {
        // no-op
      },
      removeListener: () => {
        // no-op
      },
      addEventListener: () => {
        // no-op
      },
      removeEventListener: () => {
        // no-op
      },
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;

  globalThis.HTMLElement.prototype.scrollIntoView = () => {
    // no-op
  };
  globalThis.HTMLElement.prototype.hasPointerCapture = () => false;
  globalThis.HTMLElement.prototype.releasePointerCapture = () => {
    // no-op
  };
});

afterEach(() => {
  globalThis.indexedDB = originalIndexedDB;
});
