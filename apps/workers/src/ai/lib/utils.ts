import { isRateLimitError } from "../providers";

const RETRY_MATCH_REGEX = /retry in (\d+(?:\.\d+)?)/i;

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function parseRateLimitError(error: unknown): {
  isRateLimit: boolean;
  retryAfterSeconds?: number;
  message: string;
} {
  if (!(error instanceof Error)) {
    return { isRateLimit: false, message: "An error occurred" };
  }

  const errorMessage = error.message;

  if (isRateLimitError(error)) {
    const retryMatch = errorMessage.match(RETRY_MATCH_REGEX);
    const retryAfterSeconds = retryMatch
      ? Math.ceil(Number.parseFloat(retryMatch[1]))
      : 60;

    return {
      isRateLimit: true,
      retryAfterSeconds,
      message: `Rate limit reached. Please wait ${retryAfterSeconds} seconds before trying again.`,
    };
  }

  return { isRateLimit: false, message: errorMessage };
}
