import { createLogger } from "@lumen/logger";
import {
  recordSpanError,
  setSpanAttributes,
  withSpanAsync,
} from "@lumen/logger/server";
import { createClient } from "redis";

const logger = createLogger({ name: "collab:presence-client" });
const TRAILING_SLASH_REGEX = /\/$/;

export interface WorkspacePresenceUser {
  avatar?: string | null;
  id: string;
  joinedAt?: number;
  lastActivity?: number;
  name?: string | null;
  status: string;
}

export interface WorkspacePresenceResult {
  onlineCount: number;
  userIds: Set<string>;
  users: WorkspacePresenceUser[];
}

export interface UserPresenceResult {
  count: number;
  isOnline: boolean;
  userId: string;
  workspaces: string[];
}

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;
let redisConnectPromise: Promise<void> | null = null;
let redisReady = false;

export function getPresenceRedisClient(): RedisClient | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  if (!redisClient) {
    try {
      const client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 1000,
          reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
        },
      });

      client.on("error", (error) => {
        redisReady = false;
        logger.debug("Redis presence client error", {
          error: error instanceof Error ? error.message : "Unknown",
        });
      });

      client.on("ready", () => {
        redisReady = true;
        logger.debug("Redis presence client ready");
      });

      redisClient = client;
      redisConnectPromise = client
        .connect()
        .then(() => {
          redisReady = true;
        })
        .catch((err) => {
          redisReady = false;
          logger.debug(
            "Redis presence client connect failed, will use HTTP fallback",
            {
              error: err instanceof Error ? err.message : "Unknown",
            }
          );
        });
    } catch (err) {
      logger.debug("Failed to create Redis client for presence", {
        error: err instanceof Error ? err.message : "Unknown",
      });
      return null;
    }
  }

  return redisClient;
}

export function isPresenceRedisReady(): boolean {
  return redisReady;
}

export function getWorkspacePresence(
  workspaceId: string
): Promise<WorkspacePresenceResult> {
  return withSpanAsync("presence.getWorkspacePresence", async (span) => {
    setSpanAttributes({
      workspaceId,
      "presence.operation": "getWorkspacePresence",
    });

    // 1. Try Redis fast path
    const client = getPresenceRedisClient();
    if (client) {
      if (redisConnectPromise) {
        await redisConnectPromise.catch(() => undefined);
      }

      if (redisReady) {
        try {
          const key = `presence:workspace:${workspaceId}:users`;
          const userIds = await client.sMembers(key);
          if (Array.isArray(userIds)) {
            const userSet = new Set(userIds);
            setSpanAttributes({
              "presence.source": "redis",
              "presence.online_count": userSet.size,
            });
            logger.debug("Resolved workspace presence via Redis", {
              workspaceId,
              onlineCount: userSet.size,
            });
            return {
              userIds: userSet,
              users: userIds.map((id) => ({
                id,
                status: "online",
              })),
              onlineCount: userSet.size,
            };
          }
        } catch (err) {
          recordSpanError(span, err);
          logger.debug("Redis presence query failed, trying HTTP fallback", {
            workspaceId,
            error: err instanceof Error ? err.message : "Unknown",
          });
        }
      }
    }

    // 2. HTTP Fallback to Presence service
    const presenceBaseUrl =
      process.env.PRESENCE_HTTP_URL ||
      process.env.PRESENCE_URL ||
      "http://127.0.0.1:4000";

    try {
      const url = `${presenceBaseUrl.replace(TRAILING_SLASH_REGEX, "")}/api/workspaces/${encodeURIComponent(workspaceId)}/presence`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(2000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          user_ids?: string[];
          users?: Array<{
            id: string;
            name?: string | null;
            avatar?: string | null;
            status?: string;
            joined_at?: number;
            last_activity?: number;
          }>;
          count?: number;
        };

        const ids = data.user_ids ?? data.users?.map((u) => u.id) ?? [];
        const userSet = new Set(ids);
        const users: WorkspacePresenceUser[] = data.users
          ? data.users.map((u) => ({
              id: u.id,
              name: u.name,
              avatar: u.avatar,
              status: u.status ?? "online",
              joinedAt: u.joined_at,
              lastActivity: u.last_activity,
            }))
          : ids.map((id) => ({
              id,
              status: "online",
            }));

        setSpanAttributes({
          "presence.source": "http",
          "presence.online_count": userSet.size,
        });
        logger.debug("Resolved workspace presence via HTTP API", {
          workspaceId,
          onlineCount: userSet.size,
        });

        return {
          userIds: userSet,
          users,
          onlineCount: userSet.size,
        };
      }
    } catch (err) {
      recordSpanError(span, err);
      logger.debug("HTTP presence query failed", {
        workspaceId,
        error: err instanceof Error ? err.message : "Unknown",
      });
    }

    // 3. Fallback when both fail (empty presence)
    setSpanAttributes({
      "presence.source": "empty_fallback",
      "presence.online_count": 0,
    });

    return {
      userIds: new Set<string>(),
      users: [],
      onlineCount: 0,
    };
  });
}

export function getUserPresence(userId: string): Promise<UserPresenceResult> {
  return withSpanAsync("presence.getUserPresence", async (span) => {
    setSpanAttributes({
      userId,
      "presence.operation": "getUserPresence",
    });

    // 1. Try Redis fast path
    const client = getPresenceRedisClient();
    if (client) {
      if (redisConnectPromise) {
        await redisConnectPromise.catch(() => undefined);
      }

      if (redisReady) {
        try {
          const key = `presence:user:${userId}:workspaces`;
          const workspaces = await client.sMembers(key);
          if (Array.isArray(workspaces)) {
            setSpanAttributes({
              "presence.source": "redis",
              "presence.workspace_count": workspaces.length,
              "presence.is_online": workspaces.length > 0,
            });
            logger.debug("Resolved user presence via Redis", {
              userId,
              workspaceCount: workspaces.length,
            });
            return {
              userId,
              workspaces,
              isOnline: workspaces.length > 0,
              count: workspaces.length,
            };
          }
        } catch (err) {
          recordSpanError(span, err);
          logger.debug(
            "Redis user presence query failed, trying HTTP fallback",
            {
              userId,
              error: err instanceof Error ? err.message : "Unknown",
            }
          );
        }
      }
    }

    // 2. HTTP Fallback to Presence service
    const presenceBaseUrl =
      process.env.PRESENCE_HTTP_URL ||
      process.env.PRESENCE_URL ||
      "http://127.0.0.1:4000";

    try {
      const url = `${presenceBaseUrl.replace(TRAILING_SLASH_REGEX, "")}/api/users/${encodeURIComponent(userId)}/presence`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(2000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          workspaces?: string[];
          is_online?: boolean;
          count?: number;
        };

        const workspaces = data.workspaces ?? [];
        const isOnline = data.is_online ?? workspaces.length > 0;
        const count = data.count ?? workspaces.length;

        setSpanAttributes({
          "presence.source": "http",
          "presence.workspace_count": count,
          "presence.is_online": isOnline,
        });
        logger.debug("Resolved user presence via HTTP API", {
          userId,
          workspaceCount: count,
          isOnline,
        });

        return {
          userId,
          workspaces,
          isOnline,
          count,
        };
      }
    } catch (err) {
      recordSpanError(span, err);
      logger.debug("HTTP user presence query failed", {
        userId,
        error: err instanceof Error ? err.message : "Unknown",
      });
    }

    setSpanAttributes({
      "presence.source": "empty_fallback",
      "presence.workspace_count": 0,
      "presence.is_online": false,
    });

    return {
      userId,
      workspaces: [],
      isOnline: false,
      count: 0,
    };
  });
}

export async function resetPresenceClientForTesting(
  mockClient?: RedisClient | null
): Promise<void> {
  if (redisClient && redisClient !== mockClient) {
    try {
      await redisClient.disconnect();
    } catch {
      // ignore
    }
  }
  redisClient = mockClient ?? null;
  redisReady = !!mockClient;
  redisConnectPromise = null;
}
