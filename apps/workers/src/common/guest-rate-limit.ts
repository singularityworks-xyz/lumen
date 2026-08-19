// Server-side guest rate limiting and spam protection for Chat and Larity AI

interface ChatTimestamps {
  dailyTimestamps: number[];
  lastMessageTimestamp: number;
  minuteTimestamps: number[];
}

interface LarityTimestamps {
  dailyTimestamps: number[];
}

const GUEST_CHAT_SECOND_INTERVAL_MS = 1000;
const GUEST_CHAT_MINUTE_LIMIT = 10;
const GUEST_CHAT_DAILY_LIMIT = 100;
const GUEST_LARITY_DAILY_LIMIT = 20;

const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

class ServerGuestRateLimiter {
  private readonly chatMap = new Map<string, ChatTimestamps>();
  private readonly larityMap = new Map<string, LarityTimestamps>();

  // Check if a guest can send a chat message
  checkChatRateLimit(identifier: string): {
    allowed: boolean;
    reason?: "second" | "minute" | "day";
    message?: string;
    retryAfterSeconds?: number;
  } {
    const now = Date.now();
    const entry = this.chatMap.get(identifier);

    if (!entry) {
      return { allowed: true };
    }

    // 1. 1 message per second
    if (now - entry.lastMessageTimestamp < GUEST_CHAT_SECOND_INTERVAL_MS) {
      const waitMs =
        GUEST_CHAT_SECOND_INTERVAL_MS - (now - entry.lastMessageTimestamp);
      return {
        allowed: false,
        reason: "second",
        message:
          "Please slow down. You can send 1 message per second. Log in to chat without restrictions.",
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      };
    }

    // Filter windows
    const validMinutes = entry.minuteTimestamps.filter(
      (ts) => now - ts < ONE_MINUTE_MS
    );
    const validDays = entry.dailyTimestamps.filter(
      (ts) => now - ts < ONE_DAY_MS
    );

    // 2. 10 messages per minute
    if (validMinutes.length >= GUEST_CHAT_MINUTE_LIMIT) {
      const oldestMinute = validMinutes[0] ?? now;
      const waitMs = ONE_MINUTE_MS - (now - oldestMinute);
      return {
        allowed: false,
        reason: "minute",
        message:
          "Rate limit reached (10 messages/min). Please slow down or log in to chat more.",
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      };
    }

    // 3. 100 messages per day
    if (validDays.length >= GUEST_CHAT_DAILY_LIMIT) {
      const oldestDay = validDays[0] ?? now;
      const waitMs = ONE_DAY_MS - (now - oldestDay);
      return {
        allowed: false,
        reason: "day",
        message:
          "Daily guest chat limit reached (100 messages/day). Please log in to chat more.",
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      };
    }

    return { allowed: true };
  }

  // Record a chat message sent by a guest
  recordChatMessage(identifier: string): void {
    const now = Date.now();
    const entry = this.chatMap.get(identifier) ?? {
      minuteTimestamps: [],
      dailyTimestamps: [],
      lastMessageTimestamp: 0,
    };

    const validMinutes = entry.minuteTimestamps.filter(
      (ts) => now - ts < ONE_MINUTE_MS
    );
    const validDays = entry.dailyTimestamps.filter(
      (ts) => now - ts < ONE_DAY_MS
    );

    validMinutes.push(now);
    validDays.push(now);

    this.chatMap.set(identifier, {
      lastMessageTimestamp: now,
      minuteTimestamps: validMinutes,
      dailyTimestamps: validDays,
    });
  }

  // Check if a guest can send a message to Larity AI
  checkLarityRateLimit(identifier: string): {
    allowed: boolean;
    reason?: "day";
    message?: string;
    retryAfterSeconds?: number;
  } {
    const now = Date.now();
    const entry = this.larityMap.get(identifier);

    if (!entry) {
      return { allowed: true };
    }

    const validDays = entry.dailyTimestamps.filter(
      (ts) => now - ts < ONE_DAY_MS
    );

    if (validDays.length >= GUEST_LARITY_DAILY_LIMIT) {
      const oldestDay = validDays[0] ?? now;
      const waitMs = ONE_DAY_MS - (now - oldestDay);
      return {
        allowed: false,
        reason: "day",
        message:
          "Guest limit reached (20 messages/day). Please log in to chat more with Larity.",
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      };
    }

    return { allowed: true };
  }

  // Record a Larity AI message sent by a guest
  recordLarityMessage(identifier: string): void {
    const now = Date.now();
    const entry = this.larityMap.get(identifier) ?? {
      dailyTimestamps: [],
    };

    const validDays = entry.dailyTimestamps.filter(
      (ts) => now - ts < ONE_DAY_MS
    );
    validDays.push(now);

    this.larityMap.set(identifier, {
      dailyTimestamps: validDays,
    });
  }

  // Reset rate limits (for testing or administration)
  reset(identifier?: string): void {
    if (identifier) {
      this.chatMap.delete(identifier);
      this.larityMap.delete(identifier);
    } else {
      this.chatMap.clear();
      this.larityMap.clear();
    }
  }
}

export const serverGuestRateLimiter = new ServerGuestRateLimiter();
