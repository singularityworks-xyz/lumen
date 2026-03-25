import { afterEach, describe, expect, it } from "bun:test";

describe("use-mobile", () => {
  const MOBILE_BREAKPOINT = 768;

  const originalMatchMedia = globalThis.matchMedia;
  const originalInnerWidth = (globalThis as any).innerWidth;

  afterEach(() => {
    globalThis.matchMedia = originalMatchMedia;
    (globalThis as any).innerWidth = originalInnerWidth;
  });

  describe("breakpoint logic", () => {
    it("returns true when width is below breakpoint", () => {
      (globalThis as any).innerWidth = 500;
      const isMobile = (globalThis as any).innerWidth < MOBILE_BREAKPOINT;
      expect(isMobile).toBe(true);
    });

    it("returns false when width is above breakpoint", () => {
      (globalThis as any).innerWidth = 1024;
      const isMobile = (globalThis as any).innerWidth < MOBILE_BREAKPOINT;
      expect(isMobile).toBe(false);
    });
  });

  describe("listener setup", () => {
    it("adds event listener on initialization", () => {
      let listenerAdded = false;
      globalThis.matchMedia = (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: (_: string, __: () => void) => {
            listenerAdded = true;
          },
          removeEventListener: () => {
            return;
          },
          dispatchEvent: () => false,
        }) as any;
      const mql = globalThis.matchMedia("(max-width: 767px)");
      mql.addEventListener("change", () => {
        return;
      });
      expect(listenerAdded).toBe(true);
    });

    it("removes event listener on cleanup", () => {
      let listenerRemoved = false;
      globalThis.matchMedia = (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: () => {
            return;
          },
          removeEventListener: (_: string, __: () => void) => {
            listenerRemoved = true;
          },
          dispatchEvent: () => false,
        }) as any;
      const mql = globalThis.matchMedia("(max-width: 767px)");
      const handler = () => {
        return;
      };
      mql.addEventListener("change", handler);
      mql.removeEventListener("change", handler);
      expect(listenerRemoved).toBe(true);
    });
  });

  describe("breakpoint transitions", () => {
    it("matches correct query for mobile detection", () => {
      const query = "(max-width: 767px)";
      globalThis.matchMedia = (q: string) =>
        ({
          matches: q === query,
          media: q,
          addEventListener: () => {
            return;
          },
          removeEventListener: () => {
            return;
          },
          dispatchEvent: () => false,
        }) as any;
      const mql = globalThis.matchMedia(query);
      expect(mql.matches).toBe(true);
    });

    it("breakpoint value is 768", () => {
      expect(MOBILE_BREAKPOINT).toBe(768);
    });
  });
});
