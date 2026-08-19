export interface RateLimitCheckResult {
  allowed: boolean;
  message?: string;
  reason?: "second" | "minute" | "daily";
  retryAfterSeconds?: number;
}

const CHAT_STORAGE_KEY = "lumen_guest_chat_ratelimit_v1";
const LARITY_STORAGE_KEY = "lumen_guest_larity_ratelimit_v1";

const CHAT_LIMITS = {
  PER_SECOND: 1, // 1 msg / sec
  PER_MINUTE: 10, // 10 msgs / min
  PER_DAY: 100, // 100 msgs / day
} as const;

const LARITY_LIMITS = {
  PER_DAY: 20, // 20 msgs / day
} as const;

interface StoredChatRateLimit {
  dailyCount: number;
  date: string; // YYYY-MM-DD
  recentTimestamps: number[];
}

interface StoredLarityRateLimit {
  dailyCount: number;
  date: string; // YYYY-MM-DD
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

let memoryChatData: StoredChatRateLimit = {
  date: getTodayString(),
  dailyCount: 0,
  recentTimestamps: [],
};

let memoryLarityData: StoredLarityRateLimit = {
  date: getTodayString(),
  dailyCount: 0,
};

function getStoredChatData(): StoredChatRateLimit {
  if (typeof window === "undefined") {
    if (memoryChatData.date !== getTodayString()) {
      memoryChatData = {
        date: getTodayString(),
        dailyCount: 0,
        recentTimestamps: [],
      };
    }
    return memoryChatData;
  }
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredChatRateLimit;
      if (parsed.date === getTodayString()) {
        return parsed;
      }
    }
  } catch {
    // Ignore JSON parsing issues
  }
  return { date: getTodayString(), dailyCount: 0, recentTimestamps: [] };
}

function saveStoredChatData(data: StoredChatRateLimit): void {
  if (typeof window === "undefined") {
    memoryChatData = data;
    return;
  }
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage quota or private browsing
  }
}

function getStoredLarityData(): StoredLarityRateLimit {
  if (typeof window === "undefined") {
    if (memoryLarityData.date !== getTodayString()) {
      memoryLarityData = {
        date: getTodayString(),
        dailyCount: 0,
      };
    }
    return memoryLarityData;
  }
  try {
    const raw = localStorage.getItem(LARITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredLarityRateLimit;
      if (parsed.date === getTodayString()) {
        return parsed;
      }
    }
  } catch {
    // Ignore JSON parsing issues
  }
  return { date: getTodayString(), dailyCount: 0 };
}

function saveStoredLarityData(data: StoredLarityRateLimit): void {
  if (typeof window === "undefined") {
    memoryLarityData = data;
    return;
  }
  try {
    localStorage.setItem(LARITY_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage quota or private browsing
  }
}

/**
 * Checks if a guest is allowed to send a chat message based on:
 * 1. 1 message per second
 * 2. 10 messages per minute
 * 3. 100 messages per day
 */
export function checkGuestChatRateLimit(): RateLimitCheckResult {
  const now = Date.now();
  const data = getStoredChatData();

  // 1. Check daily limit (100 / day)
  if (data.dailyCount >= CHAT_LIMITS.PER_DAY) {
    return {
      allowed: false,
      reason: "daily",
      message:
        "Daily guest chat limit reached (100 messages/day). Please log in to chat more.",
    };
  }

  // Filter timestamps within the last 60 seconds
  const oneMinuteAgo = now - 60_000;
  const recentWithinMinute = data.recentTimestamps.filter(
    (t) => t > oneMinuteAgo
  );

  // 2. Check per-second limit (1 msg / sec)
  const lastTimestamp = data.recentTimestamps.at(-1);
  if (lastTimestamp && now - lastTimestamp < 1000) {
    const waitTime = Math.ceil((1000 - (now - lastTimestamp)) / 1000);
    return {
      allowed: false,
      reason: "second",
      retryAfterSeconds: waitTime,
      message:
        "Please slow down. You can send 1 message per second. Log in to chat without restrictions.",
    };
  }

  // 3. Check per-minute limit (10 msgs / min)
  if (recentWithinMinute.length >= CHAT_LIMITS.PER_MINUTE) {
    const oldestInWindow = recentWithinMinute[0];
    const waitTime = Math.ceil(
      (60_000 - (now - (oldestInWindow ?? now))) / 1000
    );
    return {
      allowed: false,
      reason: "minute",
      retryAfterSeconds: Math.max(1, waitTime),
      message:
        "Rate limit reached (10 messages/min). Please slow down or log in to chat more.",
    };
  }

  return { allowed: true };
}

/**
 * Records a successful guest chat message.
 */
export function recordGuestChatMessage(): void {
  const now = Date.now();
  const data = getStoredChatData();
  const oneMinuteAgo = now - 60_000;

  const updatedTimestamps = [
    ...data.recentTimestamps.filter((t) => t > oneMinuteAgo),
    now,
  ];

  saveStoredChatData({
    date: getTodayString(),
    dailyCount: data.dailyCount + 1,
    recentTimestamps: updatedTimestamps,
  });
}

export function getGuestChatStats(): {
  dailyCount: number;
  dailyLimit: number;
  dailyRemaining: number;
} {
  const data = getStoredChatData();
  return {
    dailyCount: data.dailyCount,
    dailyLimit: CHAT_LIMITS.PER_DAY,
    dailyRemaining: Math.max(0, CHAT_LIMITS.PER_DAY - data.dailyCount),
  };
}

/**
 * Checks if a guest is allowed to send a Larity message (20 msgs / day).
 */
export function checkGuestLarityRateLimit(): RateLimitCheckResult {
  const data = getStoredLarityData();

  if (data.dailyCount >= LARITY_LIMITS.PER_DAY) {
    return {
      allowed: false,
      reason: "daily",
      message:
        "Guest limit reached (20 messages/day). Please log in to chat more with Larity.",
    };
  }

  return { allowed: true };
}

/**
 * Records a successful guest Larity message.
 */
export function recordGuestLarityMessage(): void {
  const data = getStoredLarityData();
  saveStoredLarityData({
    date: getTodayString(),
    dailyCount: data.dailyCount + 1,
  });
}

export function getGuestLarityStats(): {
  dailyCount: number;
  dailyLimit: number;
  dailyRemaining: number;
} {
  const data = getStoredLarityData();
  return {
    dailyCount: data.dailyCount,
    dailyLimit: LARITY_LIMITS.PER_DAY,
    dailyRemaining: Math.max(0, LARITY_LIMITS.PER_DAY - data.dailyCount),
  };
}
