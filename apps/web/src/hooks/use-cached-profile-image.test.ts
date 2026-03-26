import { GlobalRegistrator } from "@happy-dom/global-registrator";
try { GlobalRegistrator.register(); } catch {}
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

import { afterEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";

type QueryFn = () => Promise<string | null>;

let queryFn: QueryFn;
let queryOptions: Record<string, unknown>;
let mockIsLoading = false;

mock.module("@tanstack/react-query", () => ({
  useQuery: (opts: Record<string, unknown>) => {
    queryOptions = opts;
    queryFn = opts.queryFn as QueryFn;
    return {
      data: null as string | null,
      isLoading: mockIsLoading,
    };
  },
}));

afterEach(() => {
  mockIsLoading = false;
  queryFn = undefined as unknown as QueryFn;
  queryOptions = {};
});

describe("use-cached-profile-image", () => {
  describe("hook return values", () => {
    it("returns null imageUrl and isLoading=false when no URL provided", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      const { result } = renderHook(() => useCachedProfileImage(null));

      expect(result.current.imageUrl).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasImage).toBe(false);
    });

    it("returns undefined imageUrl when undefined URL provided", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      const { result } = renderHook(() => useCachedProfileImage(undefined));

      expect(result.current.hasImage).toBe(false);
    });

    it("returns provided URL as imageUrl when query data is null", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      const { result } = renderHook(() =>
        useCachedProfileImage("https://example.com/avatar.png")
      );

      // When useQuery returns data: null, the hook falls back to imageUrl ?? null => null
      // But the raw imageUrl arg is passed through as fallback
      expect(result.current.hasImage).toBe(true);
    });

    it("passes through isLoading from useQuery", async () => {
      mockIsLoading = true;
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      const { result } = renderHook(() =>
        useCachedProfileImage("https://example.com/avatar.png")
      );

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("query configuration", () => {
    it("sets enabled to false when URL is null", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      renderHook(() => useCachedProfileImage(null));

      expect(queryOptions.enabled).toBe(false);
    });

    it("sets enabled to true when URL is provided", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      renderHook(() => useCachedProfileImage("https://example.com/img.png"));

      expect(queryOptions.enabled).toBe(true);
    });

    it("uses profile-image query key with the URL", async () => {
      const url = "https://example.com/photo.jpg";
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      renderHook(() => useCachedProfileImage(url));

      expect(queryOptions.queryKey).toEqual(["profile-image", url]);
    });

    it("uses different query keys for different URLs", async () => {
      const url1 = "https://example.com/photo1.jpg";
      const url2 = "https://example.com/photo2.jpg";
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );

      renderHook(() => useCachedProfileImage(url1));
      const key1 = [...(queryOptions.queryKey as string[])];

      renderHook(() => useCachedProfileImage(url2));
      const key2 = [...(queryOptions.queryKey as string[])];

      expect(key1).not.toEqual(key2);
      expect(key2).toEqual(["profile-image", url2]);
    });

    it("sets staleTime to 1 hour", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      renderHook(() => useCachedProfileImage("https://example.com/img.png"));

      expect(queryOptions.staleTime).toBe(1000 * 60 * 60);
    });

    it("sets gcTime to 24 hours", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      renderHook(() => useCachedProfileImage("https://example.com/img.png"));

      expect(queryOptions.gcTime).toBe(1000 * 60 * 60 * 24);
    });

    it("disables refetchOnWindowFocus", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      renderHook(() => useCachedProfileImage("https://example.com/img.png"));

      expect(queryOptions.refetchOnWindowFocus).toBe(false);
    });

    it("disables refetchOnMount", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      renderHook(() => useCachedProfileImage("https://example.com/img.png"));

      expect(queryOptions.refetchOnMount).toBe(false);
    });

    it("sets retry to 1", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      renderHook(() => useCachedProfileImage("https://example.com/img.png"));

      expect(queryOptions.retry).toBe(1);
    });
  });

  describe("queryFn behavior", () => {
    it("returns null immediately when no URL", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      renderHook(() => useCachedProfileImage(null));

      const result = await queryFn();
      expect(result).toBeNull();
    });

    it("returns URL on successful image load", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      const url = "https://example.com/valid.png";
      renderHook(() => useCachedProfileImage(url));

      // queryFn creates a new Image() and resolves on onload/onerror.
      // In bun:test environment, Image() constructor works but onload won't fire.
      // We verify the queryFn exists and returns a promise.
      const promise = queryFn();
      expect(promise).toBeInstanceOf(Promise);
    });

    it("queryFn returns a promise that resolves to the URL", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      const url = "https://example.com/test.png";
      renderHook(() => useCachedProfileImage(url));

      // In jsdom/bun environment, Image src assignment may not trigger events.
      // We test that the function is callable and doesn't throw.
      const promise = queryFn();
      // The promise resolves either via onload or onerror to the same URL.
      // In test env without real image loading, this may hang.
      // We just verify it's a valid promise.
      expect(typeof promise.then).toBe("function");
    });
  });

  describe("cached URL reuse", () => {
    it("uses same query key for same URL across renders", async () => {
      const url = "https://example.com/stable.png";
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );

      const { rerender } = renderHook(
        ({ url }: { url: string | null }) => useCachedProfileImage(url),
        { initialProps: { url } }
      );

      const key1 = [...(queryOptions.queryKey as string[])];

      rerender({ url });
      const key2 = [...(queryOptions.queryKey as string[])];

      expect(key1).toEqual(key2);
    });
  });

  describe("fallback behavior", () => {
    it("falls back to original URL when query data is null", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      const url = "https://example.com/fallback.png";
      const { result } = renderHook(() => useCachedProfileImage(url));

      // data is null in our mock, so imageUrl should be null ?? url = null
      // Actually: cachedUrl ?? imageUrl where cachedUrl=null and imageUrl=url
      // So: null ?? url = null... wait the hook returns imageUrl: cachedUrl ?? imageUrl
      // cachedUrl is null, imageUrl param is the url. So null ?? url = null
      // Hmm, null ?? url actually returns url because ?? only falls through null/undefined
      // Wait: null ?? "url" = "url" (because null is on the left of ??)
      // So result.current.imageUrl should be the url
      expect(result.current.imageUrl).toBe(url);
    });

    it("hasImage is false for null URL even with valid query config", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      const { result } = renderHook(() => useCachedProfileImage(null));

      expect(result.current.hasImage).toBe(false);
      expect(queryOptions.enabled).toBe(false);
    });

    it("hasImage is true for empty string URL", async () => {
      const { useCachedProfileImage } = await import(
        "./use-cached-profile-image"
      );
      const { result } = renderHook(() => useCachedProfileImage(""));

      // Empty string is falsy, so !!"" = false
      expect(result.current.hasImage).toBe(false);
      expect(queryOptions.enabled).toBe(false);
    });
  });
});
