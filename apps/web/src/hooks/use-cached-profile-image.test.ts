import { beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";

interface UseQueryOptions {
  enabled?: boolean;
  gcTime?: number;
  queryFn?: () => Promise<unknown>;
  queryKey?: unknown[];
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  retry?: number;
  staleTime?: number;
}

const mockUseQuery = mock((options: UseQueryOptions) => {
  return {
    data: options?.queryFn ? null : undefined,
    isLoading: false,
    refetch: mock(() => Promise.resolve()),
  };
});

mock.module("@tanstack/react-query", () => ({
  useQuery: mockUseQuery,
}));

import { useCachedProfileImage } from "./use-cached-profile-image";

describe("use-cached-profile-image", () => {
  beforeEach(() => {
    mockUseQuery.mockClear();
  });

  it("hook return values returns null imageUrl and isLoading=false when no URL provided", () => {
    mockUseQuery.mockReturnValueOnce({
      data: null,
      isLoading: false,
      refetch: mock(),
    });
    const { result } = renderHook(() => useCachedProfileImage(null));
    expect(result.current.imageUrl).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("hook return values returns undefined imageUrl when undefined URL provided", () => {
    mockUseQuery.mockReturnValueOnce({
      data: null,
      isLoading: false,
      refetch: mock(),
    });
    const { result } = renderHook(() => useCachedProfileImage(undefined));
    expect(result.current.imageUrl).toBeUndefined();
  });

  it("hook return values returns provided URL as imageUrl when query data is null", () => {
    mockUseQuery.mockReturnValueOnce({
      data: null,
      isLoading: false,
      refetch: mock(),
    });
    const { result } = renderHook(() =>
      useCachedProfileImage("https://test.com/img.jpg")
    );
    expect(result.current.imageUrl).toBe("https://test.com/img.jpg");
  });

  it("hook return values passes through isLoading from useQuery", () => {
    mockUseQuery.mockReturnValueOnce({
      data: null,
      isLoading: true,
      refetch: mock(),
    });
    const { result } = renderHook(() =>
      useCachedProfileImage("https://test.com/img.jpg")
    );
    expect(result.current.isLoading).toBe(true);
  });

  it("query configuration sets enabled to false when URL is null", () => {
    renderHook(() => useCachedProfileImage(null));
    const args = mockUseQuery.mock.calls[0]![0];
    expect(args.enabled).toBe(false);
  });

  it("query configuration sets enabled to true when URL is provided", () => {
    renderHook(() => useCachedProfileImage("https://test.com/img.jpg"));
    const args = mockUseQuery.mock.calls[0]![0];
    expect(args.enabled).toBe(true);
  });

  it("query configuration uses profile-image query key with the URL", () => {
    renderHook(() => useCachedProfileImage("https://test.com/img.jpg"));
    const args = mockUseQuery.mock.calls[0]![0];
    expect(args.queryKey).toEqual([
      "profile-image",
      "https://test.com/img.jpg",
    ]);
  });

  it("query configuration uses different query keys for different URLs", () => {
    renderHook(() => useCachedProfileImage("https://test.com/1.jpg"));
    renderHook(() => useCachedProfileImage("https://test.com/2.jpg"));
    const args1 = mockUseQuery.mock.calls[0]![0];
    const args2 = mockUseQuery.mock.calls[1]![0];
    expect(args1.queryKey).not.toEqual(args2.queryKey);
  });

  it("query configuration sets staleTime to 1 hour", () => {
    renderHook(() => useCachedProfileImage("https://test.com/img.jpg"));
    const args = mockUseQuery.mock.calls[0]![0];
    expect(args.staleTime).toBe(3_600_000);
  });

  it("query configuration sets gcTime to 24 hours", () => {
    renderHook(() => useCachedProfileImage("https://test.com/img.jpg"));
    const args = mockUseQuery.mock.calls[0]![0];
    expect(args.gcTime).toBe(86_400_000);
  });

  it("query configuration disables refetchOnWindowFocus", () => {
    renderHook(() => useCachedProfileImage("https://test.com/img.jpg"));
    const args = mockUseQuery.mock.calls[0]![0];
    expect(args.refetchOnWindowFocus).toBe(false);
  });

  it("query configuration disables refetchOnMount", () => {
    renderHook(() => useCachedProfileImage("https://test.com/img.jpg"));
    const args = mockUseQuery.mock.calls[0]![0];
    expect(args.refetchOnMount).toBe(false);
  });

  it("query configuration sets retry to 1", () => {
    renderHook(() => useCachedProfileImage("https://test.com/img.jpg"));
    const args = mockUseQuery.mock.calls[0]![0];
    expect(args.retry).toBe(1);
  });

  it("queryFn behavior returns null immediately when no URL", async () => {
    renderHook(() => useCachedProfileImage(null));
    const args = mockUseQuery.mock.calls[0]![0] as UseQueryOptions;
    const res = await args.queryFn?.();
    expect(res).toBeNull();
  });

  it("queryFn is defined as a function", () => {
    renderHook(() => useCachedProfileImage("https://test.com/img.jpg"));
    const args = mockUseQuery.mock.calls[0]![0] as UseQueryOptions;
    expect(args.queryFn).toBeDefined();
    expect(typeof args.queryFn).toBe("function");
  });

  it("cached URL reuse uses same query key for same URL across renders", () => {
    interface TestProps {
      url: string | null;
    }
    const { rerender } = renderHook(
      (props: TestProps) => useCachedProfileImage(props?.url),
      {
        initialProps: { url: "https://test.com/img.jpg" },
      }
    );
    rerender({ url: "https://test.com/img.jpg" });
    const args1 = mockUseQuery.mock.calls[0]![0] as UseQueryOptions;
    const args2 = mockUseQuery.mock.calls[1]![0] as UseQueryOptions;
    expect(args1.queryKey).toEqual(args2.queryKey);
  });

  it("fallback behavior falls back to original URL when query data is null", () => {
    mockUseQuery.mockReturnValueOnce({
      data: null,
      isLoading: false,
      refetch: mock(),
    });
    const { result } = renderHook(() =>
      useCachedProfileImage("https://test.com/img.jpg")
    );
    expect(result.current.imageUrl).toBe("https://test.com/img.jpg");
  });

  it("fallback behavior hasImage is false for null URL even with valid query config", () => {
    const { result } = renderHook(() => useCachedProfileImage(null));
    expect(result.current.hasImage).toBe(false);
  });

  it("fallback behavior hasImage is false for empty string URL", () => {
    const { result } = renderHook(() => useCachedProfileImage(""));
    expect(result.current.hasImage).toBe(false);
  });
});
