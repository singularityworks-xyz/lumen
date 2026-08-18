import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  getUserPresence,
  getWorkspacePresence,
  resetPresenceClientForTesting,
} from "./presence-client";

describe("presence-client", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    await resetPresenceClientForTesting(null);
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    await resetPresenceClientForTesting(null);
  });

  describe("getWorkspacePresence", () => {
    it("queries Redis set when Redis client is available and ready", async () => {
      const mockRedis = {
        sMembers: mock((key: string) => {
          if (key === "presence:workspace:ws-1:users") {
            return Promise.resolve(["user-1", "user-2"]);
          }
          return Promise.resolve([]);
        }),
        disconnect: mock(() => Promise.resolve()),
      } as any;

      await resetPresenceClientForTesting(mockRedis);

      const result = await getWorkspacePresence("ws-1");

      expect(mockRedis.sMembers).toHaveBeenCalledWith(
        "presence:workspace:ws-1:users"
      );
      expect(result.onlineCount).toBe(2);
      expect(result.userIds.has("user-1")).toBe(true);
      expect(result.userIds.has("user-2")).toBe(true);
      expect(result.users.length).toBe(2);
    });

    it("falls back to HTTP API when Redis is not available", async () => {
      await resetPresenceClientForTesting(null);
      process.env.REDIS_URL = "";
      process.env.PRESENCE_HTTP_URL = "http://localhost:4000";

      const mockFetch = mock((url: string | URL | Request) => {
        expect(url.toString()).toContain("/api/workspaces/ws-2/presence");
        return Promise.resolve(
          new Response(
            JSON.stringify({
              workspace_id: "ws-2",
              user_ids: ["user-3"],
              users: [
                {
                  id: "user-3",
                  name: "Charlie",
                  avatar: "https://example.com/c.png",
                  status: "online",
                },
              ],
              count: 1,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      });

      globalThis.fetch = mockFetch as any;

      const result = await getWorkspacePresence("ws-2");

      expect(mockFetch).toHaveBeenCalled();
      expect(result.onlineCount).toBe(1);
      expect(result.userIds.has("user-3")).toBe(true);
      expect(result.users[0]?.name).toBe("Charlie");
    });

    it("returns empty result gracefully when both Redis and HTTP fail", async () => {
      await resetPresenceClientForTesting(null);
      process.env.REDIS_URL = "";

      const mockFetch = mock(() => Promise.reject(new Error("Network error")));
      globalThis.fetch = mockFetch as any;

      const result = await getWorkspacePresence("ws-fail");

      expect(result.onlineCount).toBe(0);
      expect(result.userIds.size).toBe(0);
      expect(result.users).toEqual([]);
    });
  });

  describe("getUserPresence", () => {
    it("queries Redis set for user workspaces (cross-workspace presence)", async () => {
      const mockRedis = {
        sMembers: mock((key: string) => {
          if (key === "presence:user:user-1:workspaces") {
            return Promise.resolve(["ws-a", "ws-b"]);
          }
          return Promise.resolve([]);
        }),
        disconnect: mock(() => Promise.resolve()),
      } as any;

      await resetPresenceClientForTesting(mockRedis);

      const result = await getUserPresence("user-1");

      expect(mockRedis.sMembers).toHaveBeenCalledWith(
        "presence:user:user-1:workspaces"
      );
      expect(result.isOnline).toBe(true);
      expect(result.count).toBe(2);
      expect(result.workspaces).toEqual(["ws-a", "ws-b"]);
    });

    it("falls back to HTTP API for user presence", async () => {
      await resetPresenceClientForTesting(null);
      process.env.REDIS_URL = "";
      process.env.PRESENCE_HTTP_URL = "http://localhost:4000";

      const mockFetch = mock((url: string | URL | Request) => {
        expect(url.toString()).toContain("/api/users/user-2/presence");
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user_id: "user-2",
              workspaces: ["ws-x"],
              is_online: true,
              count: 1,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      });

      globalThis.fetch = mockFetch as any;

      const result = await getUserPresence("user-2");

      expect(mockFetch).toHaveBeenCalled();
      expect(result.isOnline).toBe(true);
      expect(result.count).toBe(1);
      expect(result.workspaces).toEqual(["ws-x"]);
    });

    it("returns offline status when user is not present in any workspace", async () => {
      const mockRedis = {
        sMembers: mock(() => Promise.resolve([])),
        disconnect: mock(() => Promise.resolve()),
      } as any;

      await resetPresenceClientForTesting(mockRedis);

      const result = await getUserPresence("user-offline");

      expect(result.isOnline).toBe(false);
      expect(result.count).toBe(0);
      expect(result.workspaces).toEqual([]);
    });
  });

  describe("internal API authentication", () => {
    it("sends the internal API key as a Bearer token when configured", async () => {
      await resetPresenceClientForTesting(null);
      process.env.REDIS_URL = "";
      process.env.PRESENCE_HTTP_URL = "http://localhost:4000";
      process.env.INTERNAL_API_KEY = "secret-key";

      const mockFetch = mock(
        (_url: string | URL | Request, init?: RequestInit) => {
          expect(init?.headers).toMatchObject({
            Authorization: "Bearer secret-key",
          });
          return Promise.resolve(
            new Response(
              JSON.stringify({
                workspace_id: "ws-auth",
                user_ids: ["user-auth"],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      );
      globalThis.fetch = mockFetch as any;

      const result = await getWorkspacePresence("ws-auth");

      expect(mockFetch).toHaveBeenCalled();
      expect(result.onlineCount).toBe(1);
    });

    it("omits the Authorization header when no internal API key is configured", async () => {
      await resetPresenceClientForTesting(null);
      process.env.REDIS_URL = "";
      process.env.PRESENCE_HTTP_URL = "http://localhost:4000";
      process.env.INTERNAL_API_KEY = "";

      const mockFetch = mock(
        (_url: string | URL | Request, init?: RequestInit) => {
          const headers = init?.headers as Record<string, string> | undefined;
          expect(headers?.Authorization).toBeUndefined();
          return Promise.resolve(
            new Response(
              JSON.stringify({ workspace_id: "ws-noauth", user_ids: [] }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      );
      globalThis.fetch = mockFetch as any;

      const result = await getUserPresence("user-noauth");

      expect(mockFetch).toHaveBeenCalled();
      expect(result.isOnline).toBe(false);
    });

    it("returns empty presence on a non-2xx response", async () => {
      await resetPresenceClientForTesting(null);
      process.env.REDIS_URL = "";
      process.env.PRESENCE_HTTP_URL = "http://localhost:4000";

      const mockFetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })
        )
      );
      globalThis.fetch = mockFetch as any;

      const result = await getWorkspacePresence("ws-denied");

      expect(mockFetch).toHaveBeenCalled();
      expect(result.onlineCount).toBe(0);
      expect(result.userIds.size).toBe(0);
      expect(result.users).toEqual([]);
    });
  });
});
