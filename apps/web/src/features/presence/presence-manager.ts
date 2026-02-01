import { createLogger } from "@lumen/logger";
import type { PresenceUser } from "./types";

const logger = createLogger({ name: "presence:manager" });

// Phoenix Socket message format: [join_ref, ref, topic, event, payload]
type PhoenixMessage = [
  string | null, // join_ref
  string, // ref
  string, // topic
  string, // event
  unknown, // payload
];

interface PresenceManagerOptions {
  workspaceId: string;
  userId: string;
  token: string;
  userName: string;
  userAvatar?: string;
  onPresenceUpdate: (users: PresenceUser[]) => void;
  onConnectionChange?: (isConnected: boolean) => void;
}

export class PresenceManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private phoenixHeartbeatInterval: NodeJS.Timeout | null = null;
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private lastActivity: number = Date.now();
  private status: "online" | "idle" | "away" = "online";
  private readonly options: PresenceManagerOptions;
  private messageRef = 0;
  private joinRef: string | null = null;
  private joined = false;

  // Idle threshold: 5 minutes
  private readonly IDLE_THRESHOLD = 5 * 60 * 1000;
  private readonly HEARTBEAT_INTERVAL = 30_000; // 30s
  private readonly PHOENIX_HEARTBEAT_INTERVAL = 30_000; // 30s

  constructor(options: PresenceManagerOptions) {
    this.options = options;
    this.setupActivityTracking();
    this.setupVisibilityTracking();
    this.connect();
  }

  private nextRef(): string {
    this.messageRef += 1;
    return String(this.messageRef);
  }

  private get topic(): string {
    return `workspace:${this.options.workspaceId}`;
  }

  private connect() {
    const wsUrl = `${process.env.NEXT_PUBLIC_PRESENCE_WS_URL}/socket/websocket?token=${encodeURIComponent(this.options.token)}&vsn=2.0.0`;
    logger.debug("Connecting to presence service", { url: wsUrl });

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      logger.info("Connected to presence service");
      this.startPhoenixHeartbeat();
      this.joinWorkspace();
      this.options.onConnectionChange?.(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: PhoenixMessage = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (error) {
        logger.error("Failed to parse presence message", { error });
      }
    };

    this.ws.onclose = () => {
      logger.warn("Disconnected from presence service");
      this.cleanup();
      this.joined = false;
      this.joinRef = null;
      this.options.onConnectionChange?.(false);
      this.handleDisconnect();
    };

    this.ws.onerror = (error) => {
      logger.error("WebSocket error", { error });
    };
  }

  private joinWorkspace() {
    this.joinRef = this.nextRef();
    this.push("phx_join", {});
  }

  private startPhoenixHeartbeat() {
    this.phoenixHeartbeatInterval = setInterval(() => {
      // Phoenix heartbeat uses special "phoenix" topic
      this.sendRaw([null, this.nextRef(), "phoenix", "heartbeat", {}]);
    }, this.PHOENIX_HEARTBEAT_INTERVAL);
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
    if (this.status === status || !this.joined) {
      return;
    }
    this.status = status;

    this.push("status_update", { status });

    logger.debug("Status updated", { status });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.joined) {
        this.push("activity_ping", { timestamp: Date.now() });
      }
    }, this.HEARTBEAT_INTERVAL);

    // Check idle status periodically
    this.idleCheckInterval = setInterval(() => {
      const idle = Date.now() - this.lastActivity;
      if (idle > this.IDLE_THRESHOLD && this.status === "online") {
        this.setStatus("idle");
      }
    }, 10_000); // Check every 10s
  }

  private handleMessage(msg: PhoenixMessage) {
    const [, ref, , event, payload] = msg;

    switch (event) {
      case "phx_reply": {
        // Handle join reply
        const replyPayload = payload as {
          status: string;
          response?: unknown;
        };
        if (ref === this.joinRef && replyPayload.status === "ok") {
          this.joined = true;
          logger.info("Joined workspace channel", {
            topic: this.topic,
          });
          this.startHeartbeat();
        } else if (replyPayload.status === "error") {
          logger.error("Channel error", { payload: replyPayload });
        }
        break;
      }
      case "presence_state": {
        const users = this.parsePresencePayload(payload);
        this.options.onPresenceUpdate(users);
        break;
      }
      case "presence_diff": {
        // For diff, we'd need to maintain state - for now just handle as full update
        const diffPayload = payload as { joins?: unknown; leaves?: unknown };
        if (diffPayload.joins) {
          const users = this.parsePresencePayload(diffPayload.joins);
          if (users.length > 0) {
            logger.debug("Users joined", { users });
          }
        }
        break;
      }
      case "phx_error": {
        logger.error("Phoenix channel error", { payload });
        break;
      }
      case "phx_close": {
        logger.info("Phoenix channel closed");
        break;
      }
      default:
        logger.debug("Unhandled presence event", { event, payload });
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

  private push(event: string, payload: unknown) {
    this.sendRaw([this.joinRef, this.nextRef(), this.topic, event, payload]);
  }

  private sendRaw(msg: PhoenixMessage) {
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
      this.heartbeatInterval = null;
    }
    if (this.phoenixHeartbeatInterval) {
      clearInterval(this.phoenixHeartbeatInterval);
      this.phoenixHeartbeatInterval = null;
    }
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
  }

  disconnect() {
    this.cleanup();
    this.ws?.close();
    logger.info("Disconnected from presence service");
  }
}
