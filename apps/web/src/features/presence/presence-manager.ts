import { createLogger } from "@lumen/logger";
import { type Channel, Socket } from "phoenix";
import type { PresenceUser } from "./types";

const logger = createLogger({ name: "presence:manager" });

interface PresenceManagerOptions {
  onConnectionChange?: (isConnected: boolean) => void;
  onPresenceUpdate: (users: PresenceUser[]) => void;
  token: string;
  userAvatar?: string;
  userId: string;
  userName: string;
  workspaceId: string;
}

export class PresenceManager {
  private socket: Socket | null = null;
  private channel: Channel | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private lastActivity: number = Date.now();
  private throttledActivityHandler: ((...args: unknown[]) => void) | null =
    null;
  private visibilityChangeHandler: (() => void) | null = null;
  private status: "online" | "idle" | "away" = "online";
  private readonly options: PresenceManagerOptions;

  // Internal state to track presence
  private readonly presenceState: Map<string, PresenceUser> = new Map();

  // Idle threshold: 5 minutes
  private readonly IDLE_THRESHOLD = 5 * 60 * 1000;
  private readonly HEARTBEAT_INTERVAL = 30_000;

  constructor(options: PresenceManagerOptions) {
    this.options = options;
    this.setupActivityTracking();
    this.setupVisibilityTracking();
    this.connect();
  }

  private get topic(): string {
    return `workspace:${this.options.workspaceId}`;
  }

  private connect() {
    const wsUrl = process.env.NEXT_PUBLIC_PRESENCE_WS_URL || "";

    // Enforce secure WebSocket in production to prevent token interception
    if (process.env.NODE_ENV === "production" && !wsUrl.startsWith("wss://")) {
      logger.error(
        "Refusing to connect: NEXT_PUBLIC_PRESENCE_WS_URL must use wss:// in production"
      );
      return;
    }

    logger.debug("Connecting to presence service", { url: wsUrl });

    this.socket = new Socket(`${wsUrl}/socket`, {
      params: { token: this.options.token },
    });

    this.socket.onOpen(() => {
      logger.info("Connected to presence service");
      this.options.onConnectionChange?.(true);
    });

    this.socket.onClose(() => {
      logger.warn("Disconnected from presence service");
      this.cleanup();
      this.presenceState.clear();
      this.options.onConnectionChange?.(false);
    });

    this.socket.onError((error) => {
      logger.error("Socket error", { error });
    });

    this.socket.connect();

    this.channel = this.socket.channel(this.topic, {});

    this.channel.on("presence_state", (payload) => {
      // Full state - replace everything
      this.presenceState.clear();
      const users = this.parsePresencePayload(payload);
      for (const user of users) {
        this.presenceState.set(user.id, user);
      }
      this.notifyPresenceUpdate();
    });

    this.channel.on("presence_diff", (payload) => {
      // Incremental update - apply joins and leaves
      const diffPayload = payload as { joins?: unknown; leaves?: unknown };

      // Handle leaves first
      if (diffPayload.leaves) {
        const leavingUsers = this.parsePresencePayload(diffPayload.leaves);
        for (const user of leavingUsers) {
          this.presenceState.delete(user.id);
          logger.debug("User left", { userId: user.id, name: user.name });
        }
      }

      // Then handle joins (could be new users or updates)
      if (diffPayload.joins) {
        const joiningUsers = this.parsePresencePayload(diffPayload.joins);
        for (const user of joiningUsers) {
          this.presenceState.set(user.id, user);
          logger.debug("User joined/updated", {
            userId: user.id,
            name: user.name,
          });
        }
      }

      this.notifyPresenceUpdate();
    });

    this.channel
      .join()
      .receive("ok", () => {
        logger.info("Joined workspace channel", { topic: this.topic });
        this.startHeartbeat();
      })
      .receive("error", (resp) => {
        logger.error("Unable to join channel", { resp });
      })
      .receive("timeout", () => {
        logger.error("Channel join timed out");
      });
  }

  private setupActivityTracking() {
    const events = ["mousemove", "keydown", "click", "scroll"];
    this.throttledActivityHandler = this.throttle(() => {
      this.lastActivity = Date.now();
      if (this.status === "idle") {
        this.setStatus("online");
      }
    }, 1000);

    for (const event of events) {
      document.addEventListener(event, this.throttledActivityHandler);
    }
  }

  private setupVisibilityTracking() {
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        this.setStatus("away");
      } else {
        this.lastActivity = Date.now();
        this.setStatus("online");
      }
    };
    document.addEventListener("visibilitychange", this.visibilityChangeHandler);
  }

  private setStatus(status: "online" | "idle" | "away") {
    if (this.status === status || !this.channel) {
      return;
    }
    this.status = status;

    this.push("status_update", { status });

    logger.debug("Status updated", { status });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.push("activity_ping", { timestamp: Date.now() });
    }, this.HEARTBEAT_INTERVAL);

    // Check idle status periodically
    this.idleCheckInterval = setInterval(() => {
      const idle = Date.now() - this.lastActivity;
      if (idle > this.IDLE_THRESHOLD && this.status === "online") {
        this.setStatus("idle");
      }
    }, 10_000);
  }

  private notifyPresenceUpdate() {
    const users = Array.from(this.presenceState.values());
    this.options.onPresenceUpdate(users);
  }

  private parsePresencePayload(payload: unknown): PresenceUser[] {
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const users: PresenceUser[] = [];
    const presenceMap = payload as Record<
      string,
      {
        metas: Array<{
          name: string;
          avatar?: string;
          status: string;
          joined_at: number;
        }>;
      }
    >;

    for (const [userId, data] of Object.entries(presenceMap)) {
      const meta = data.metas?.[0];
      if (meta) {
        users.push({
          id: userId,
          name: meta.name,
          avatar: meta.avatar,
          status: meta.status as "online" | "idle" | "away",
          joinedAt: meta.joined_at,
        });
      }
    }

    return users;
  }

  private push(event: string, payload: object) {
    this.channel?.push(event, payload);
  }

  private throttle<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn(...args);
      }
    };
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
    if (this.throttledActivityHandler) {
      const events = ["mousemove", "keydown", "click", "scroll"];
      for (const event of events) {
        document.removeEventListener(event, this.throttledActivityHandler);
      }
      this.throttledActivityHandler = null;
    }
    if (this.visibilityChangeHandler) {
      document.removeEventListener(
        "visibilitychange",
        this.visibilityChangeHandler
      );
      this.visibilityChangeHandler = null;
    }
  }

  disconnect() {
    this.cleanup();
    this.presenceState.clear();
    this.channel?.leave();
    this.socket?.disconnect();
    logger.info("Disconnected from presence service");
  }
}
