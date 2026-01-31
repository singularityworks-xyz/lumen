import { createLogger } from "@lumen/logger";
import type { PresenceMessage, PresenceUser } from "./types";

const logger = createLogger({ name: "presence:manager" });

type PresenceManagerOptions = {
  workspaceId: string;
  userId: string;
  token: string;
  userName: string;
  userAvatar?: string;
  onPresenceUpdate: (users: PresenceUser[]) => void;
  onConnectionChange?: (isConnected: boolean) => void;
};

export class PresenceManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private lastActivity: number = Date.now();
  private status: "online" | "idle" | "away" = "online";
  private readonly options: PresenceManagerOptions;

  // Idle threshold: 5 minutes
  private readonly IDLE_THRESHOLD = 5 * 60 * 1000;
  private readonly HEARTBEAT_INTERVAL = 30_000; // 30s

  constructor(options: PresenceManagerOptions) {
    this.options = options;
    this.setupActivityTracking();
    this.setupVisibilityTracking();
    this.connect();
  }

  private connect() {
    const wsUrl = `${process.env.NEXT_PUBLIC_PRESENCE_WS_URL}/socket`;
    logger.debug("Connecting to presence service", { url: wsUrl });

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      logger.info("Connected to presence service");
      this.joinWorkspace();
      this.startHeartbeat();
      this.options.onConnectionChange?.(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: PresenceMessage = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (error) {
        logger.error("Failed to parse presence message", { error });
      }
    };

    this.ws.onclose = () => {
      logger.warn("Disconnected from presence service");
      this.cleanup();
      this.options.onConnectionChange?.(false);
      this.handleDisconnect();
    };

    this.ws.onerror = (error) => {
      logger.error("WebSocket error", { error });
    };
  }

  private joinWorkspace() {
    this.send({
      topic: `workspace:${this.options.workspaceId}`,
      event: "phx_join",
      payload: {
        user_id: this.options.userId,
        token: this.options.token,
      },
    });
  }

  private setupActivityTracking() {
    const events = ["mousemove", "keydown", "click", "scroll"];
    const throttledActivity = this.throttle(() => {
      this.lastActivity = Date.now();
      if (this.status === "idle") {
        this.setStatus("online");
      }
    }, 1000);

    for (const event of events) {
      document.addEventListener(event, throttledActivity);
    }
  }

  private setupVisibilityTracking() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.setStatus("away");
      } else {
        this.lastActivity = Date.now();
        this.setStatus("online");
      }
    });
  }

  private setStatus(status: "online" | "idle" | "away") {
    if (this.status === status) {
      return;
    }
    this.status = status;

    this.send({
      topic: `workspace:${this.options.workspaceId}`,
      event: "status_update",
      payload: { status },
    });

    logger.debug("Status updated", { status });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({
        topic: `workspace:${this.options.workspaceId}`,
        event: "activity_ping",
        payload: { timestamp: Date.now() },
      });
    }, this.HEARTBEAT_INTERVAL);

    // Check idle status periodically
    this.idleCheckInterval = setInterval(() => {
      const idle = Date.now() - this.lastActivity;
      if (idle > this.IDLE_THRESHOLD && this.status === "online") {
        this.setStatus("idle");
      }
    }, 10_000); // Check every 10s
  }

  private handleMessage(msg: PresenceMessage) {
    switch (msg.event) {
      case "presence_state":
      case "presence_diff": {
        const users = this.parsePresencePayload(msg.payload);
        this.options.onPresenceUpdate(users);
        break;
      }
      default:
        logger.debug("Unhandled presence event", { event: msg.event });
    }
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
      if (data.metas && data.metas.length > 0) {
        const meta = data.metas[0];
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

  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
      logger.info("Attempting to reconnect...", {
        attempt: this.reconnectAttempts + 1,
        delay,
      });

      setTimeout(() => {
        this.reconnectAttempts += 1;
        this.connect();
      }, delay);
    } else {
      logger.error("Max reconnection attempts reached");
    }
  }

  private send(msg: PresenceMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
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
    }
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }
  }

  disconnect() {
    this.cleanup();
    this.ws?.close();
    logger.info("Disconnected from presence service");
  }
}
