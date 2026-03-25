const FROZEN_TIMESTAMP = "2023-11-15T00:00:00.000Z";

interface TestSession {
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export function createTestSession(userId = "test-user-1"): TestSession {
  return {
    session: {
      id: "session-1",
      userId,
      token: "test-session-token-000000000000",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    user: {
      id: userId,
      name: "Test User",
      email: "test@example.com",
    },
  };
}

export function createExpiredSession(userId = "test-user-1"): TestSession {
  return {
    session: {
      id: "session-expired",
      userId,
      token: "expired-session-token-00000000000",
      expiresAt: FROZEN_TIMESTAMP,
    },
    user: {
      id: userId,
      name: "Expired User",
      email: "expired@example.com",
    },
  };
}
