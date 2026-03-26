import { describe, expect, it, mock } from "bun:test";

const mockGetSession = mock(() =>
  Promise.resolve({
    data: {
      user: { id: "u-1", name: "Test", email: "test@example.com", image: null },
    },
    error: null,
  })
);

const mockToken = mock(() =>
  Promise.resolve({ data: { token: "jwt-token-123" }, error: null })
);

mock.module("better-auth/client/plugins", () => ({
  jwtClient: () => ({}),
}));

mock.module("better-auth/react", () => ({
  createAuthClient: () => ({
    signIn: mock(),
    signOut: mock(),
    signUp: mock(),
    useSession: mock(),
    getSession: mockGetSession,
    token: mockToken,
  }),
}));

import { getCurrentUser, getJwtToken } from "./auth-client";

describe("auth-client", () => {
  describe("getCurrentUser", () => {
    it("returns mapped user when session exists", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: {
          user: {
            id: "u-1",
            name: "Test User",
            email: "test@example.com",
            image: "https://example.com/avatar.png",
          },
        },
        error: null,
      });

      const user = await getCurrentUser();
      expect(user).toEqual({
        id: "u-1",
        name: "Test User",
        email: "test@example.com",
        image: "https://example.com/avatar.png",
      });
    });

    it("returns null when no session", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });

    it("returns null when session has no user", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });

    it("maps null name and image correctly", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: {
          user: {
            id: "u-2",
            name: null,
            email: "anon@example.com",
            image: null,
          },
        },
        error: null,
      });

      const user = await getCurrentUser();
      expect(user).toEqual({
        id: "u-2",
        name: null,
        email: "anon@example.com",
        image: null,
      });
    });
  });

  describe("getJwtToken", () => {
    it("returns token when available", async () => {
      mockToken.mockResolvedValueOnce({
        data: { token: "jwt-abc" },
        error: null,
      });

      const token = await getJwtToken();
      expect(token).toBe("jwt-abc");
    });

    it("returns null when token request has error", async () => {
      mockToken.mockResolvedValueOnce({
        data: null,
        error: { message: "Not authorized" },
      });

      const token = await getJwtToken();
      expect(token).toBeNull();
    });

    it("returns null when token request returns no data", async () => {
      mockToken.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const token = await getJwtToken();
      expect(token).toBeNull();
    });

    it("returns null when token request throws", async () => {
      mockToken.mockRejectedValueOnce(new Error("Network error"));

      const token = await getJwtToken();
      expect(token).toBeNull();
    });
  });
});
