import { expect, type Page, test } from "@playwright/test";

interface PresenceState {
  presences: Record<
    string,
    {
      metas: Array<{
        status: string;
        user_id: string;
        user_name: string;
        user_avatar: string;
        last_activity: number;
      }>;
    }
  >;
}

interface PhoenixMessage {
  event: string;
  join_ref?: string | null;
  payload?: PresenceState | Record<string, unknown>;
  ref?: string | null;
  topic: string;
}

type PhoenixWireArrayMessage = [
  string | null,
  string | null,
  string,
  string,
  PresenceState | Record<string, unknown>,
];

interface PhoenixWireObjectMessage {
  event: string;
  join_ref?: string | null;
  payload?: PresenceState | Record<string, unknown>;
  ref?: string | null;
  topic: string;
}

const DEFAULT_PRESENCE_HTTP_URL = "http://127.0.0.1:4010";

interface MessageWindow extends Window {
  onMessage: (msg: string) => void;
}

function isPhoenixWireArrayMessage(
  message: unknown
): message is PhoenixWireArrayMessage {
  return (
    Array.isArray(message) &&
    message.length === 5 &&
    (typeof message[0] === "string" || message[0] === null) &&
    (typeof message[1] === "string" || message[1] === null) &&
    typeof message[2] === "string" &&
    typeof message[3] === "string" &&
    typeof message[4] === "object" &&
    message[4] !== null
  );
}

function isPhoenixWireObjectMessage(
  message: unknown
): message is PhoenixWireObjectMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const candidate = message as Record<string, unknown>;
  return (
    typeof candidate.event === "string" &&
    typeof candidate.topic === "string" &&
    (candidate.join_ref === undefined ||
      candidate.join_ref === null ||
      typeof candidate.join_ref === "string") &&
    (candidate.ref === undefined ||
      candidate.ref === null ||
      typeof candidate.ref === "string")
  );
}

function normalizePhoenixMessage(message: unknown): PhoenixMessage | null {
  if (isPhoenixWireArrayMessage(message)) {
    const [joinRef, ref, topic, event, payload] = message;
    return {
      event,
      join_ref: joinRef,
      payload,
      ref,
      topic,
    };
  }

  if (isPhoenixWireObjectMessage(message)) {
    return {
      event: message.event,
      join_ref: message.join_ref,
      payload: message.payload,
      ref: message.ref,
      topic: message.topic,
    };
  }

  return null;
}

function createPhoenixPushMessage(
  topic: string,
  event: string,
  payload: Record<string, unknown>,
  ref: string,
  joinRef: string | null = ref
): PhoenixWireArrayMessage {
  return [joinRef, ref, topic, event, payload];
}

function getPresenceHttpBaseUrl(): string {
  return process.env.PRESENCE_URL || DEFAULT_PRESENCE_HTTP_URL;
}

function getPresenceSocketUrl(baseURL: string): string {
  const normalizedBaseUrl = baseURL.endsWith("/")
    ? baseURL.slice(0, -1)
    : baseURL;

  if (normalizedBaseUrl.startsWith("https://")) {
    return `wss://${normalizedBaseUrl.slice("https://".length)}/socket/websocket?vsn=2.0.0`;
  }

  if (normalizedBaseUrl.startsWith("http://")) {
    return `ws://${normalizedBaseUrl.slice("http://".length)}/socket/websocket?vsn=2.0.0`;
  }

  return `${normalizedBaseUrl}/socket/websocket?vsn=2.0.0`;
}

async function getTestToken(
  baseURL: string
): Promise<{ token: string; user_id: string }> {
  const response = await fetch(`${baseURL}/api/test/token`);
  if (!response.ok) {
    throw new Error(`Failed to get test token: ${response.statusText}`);
  }
  const data = await response.json();
  return { token: data.token, user_id: data.user_id };
}

async function connectWebSocket(
  page: Page,
  url: string,
  params: Record<string, string> = {}
): Promise<{
  socket: WebSocket;
  messages: PhoenixMessage[];
  openPromise: Promise<void>;
  closePromise: Promise<void>;
}> {
  const messages: PhoenixMessage[] = [];
  let openResolver: (() => void) | undefined;
  let openReject: ((reason?: unknown) => void) | undefined;
  let didOpen = false;
  let closeResolver: () => void;
  const openPromise = new Promise<void>((resolve, reject) => {
    openResolver = resolve;
    openReject = reject;
  });
  const closePromise = new Promise<void>((resolve) => {
    closeResolver = resolve;
  });

  const queryParams = new URLSearchParams(params).toString();
  const wsUrl = queryParams ? `${url}&${queryParams}` : url;

  const socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    didOpen = true;
    messages.push({ event: "socket_open", topic: "socket" });
    openResolver?.();
    openResolver = undefined;
    openReject = undefined;
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);
      const normalized = normalizePhoenixMessage(data);
      if (normalized) {
        messages.push(normalized);
      } else {
        messages.push({ event: "unknown_message", topic: "socket" });
      }
    } catch {
      messages.push({ event: "parse_error", topic: "" });
    }
  };

  socket.onclose = () => {
    if (!didOpen) {
      openReject?.(new Error("WebSocket closed before open"));
      openResolver = undefined;
      openReject = undefined;
    }
    closeResolver();
  };

  socket.onerror = () => {
    if (!didOpen) {
      openReject?.(new Error("WebSocket error before open"));
      openResolver = undefined;
      openReject = undefined;
    }
  };

  await openPromise;
  await page.waitForTimeout(250);

  return { socket, messages, openPromise, closePromise };
}

test.describe("WebSocket Connection", () => {
  test("rejects connection without token", async ({ page }) => {
    const messages: string[] = [];
    const socketUrl = getPresenceSocketUrl(getPresenceHttpBaseUrl());

    await page.exposeFunction("onMessage", (msg: string) => {
      messages.push(msg);
    });

    await page.evaluate((url) => {
      const bridge = window as unknown as MessageWindow;
      const socket = new WebSocket(url);
      socket.onmessage = (event) => {
        bridge.onMessage(event.data);
      };
      socket.onerror = () => {
        bridge.onMessage("error");
      };
      socket.onclose = () => {
        bridge.onMessage("closed");
      };
    }, socketUrl);

    await page.waitForTimeout(1000);

    expect(messages).toContain("closed");
  });
});

test.describe("WebSocket with Invalid Token", () => {
  test("rejects connection with invalid token", async ({ page }) => {
    const messages: string[] = [];
    const socketUrl = `${getPresenceSocketUrl(getPresenceHttpBaseUrl())}&token=invalid_token`;

    await page.exposeFunction("onMessage", (msg: string) => {
      messages.push(msg);
    });

    await page.evaluate((url) => {
      const bridge = window as unknown as MessageWindow;
      const socket = new WebSocket(url);
      socket.onmessage = (event) => {
        bridge.onMessage(event.data);
      };
      socket.onerror = () => {
        bridge.onMessage("error");
      };
      socket.onclose = () => {
        bridge.onMessage("closed");
      };
    }, socketUrl);

    await page.waitForTimeout(1000);

    expect(messages.some((m) => m === "closed" || m === "error")).toBeTruthy();
  });
});

test.describe("WebSocket with Valid Token", () => {
  test("authenticates successfully with valid token", async ({ page }) => {
    const baseURL = getPresenceHttpBaseUrl();
    const socketUrl = getPresenceSocketUrl(baseURL);
    const { token } = await getTestToken(baseURL);

    const { socket, messages, openPromise } = await connectWebSocket(
      page,
      socketUrl,
      {
        token,
      }
    );

    await openPromise;

    await page.waitForTimeout(500);

    expect(socket.readyState).toBe(WebSocket.OPEN);
    expect(messages.some((m) => m.event === "socket_open")).toBeTruthy();

    socket.close();
  });

  test("joins workspace channel after authentication", async ({ page }) => {
    const baseURL = getPresenceHttpBaseUrl();
    const socketUrl = getPresenceSocketUrl(baseURL);
    const { token } = await getTestToken(baseURL);

    const { socket, messages, openPromise } = await connectWebSocket(
      page,
      socketUrl,
      {
        token,
      }
    );

    await openPromise;

    await page.waitForTimeout(500);

    const joinChannelMessage = createPhoenixPushMessage(
      "workspace:test-workspace",
      "phx_join",
      {},
      "1",
      null
    );

    socket.send(JSON.stringify(joinChannelMessage));
    await page.waitForTimeout(1000);

    const phxReply = messages.find(
      (m) => m.event === "phx_reply" && m.ref === "1"
    );
    expect(phxReply).toBeDefined();
    expect(phxReply?.payload?.status).toBe("ok");

    socket.close();
  });

  test("receives presence state after joining channel", async ({ page }) => {
    const baseURL = getPresenceHttpBaseUrl();
    const socketUrl = getPresenceSocketUrl(baseURL);
    const { token } = await getTestToken(baseURL);

    const { socket, messages, openPromise } = await connectWebSocket(
      page,
      socketUrl,
      {
        token,
      }
    );

    await openPromise;

    await page.waitForTimeout(500);

    const joinChannelMessage = createPhoenixPushMessage(
      "workspace:presence-state-test",
      "phx_join",
      {},
      "1",
      null
    );

    socket.send(JSON.stringify(joinChannelMessage));
    await page.waitForTimeout(1500);

    const presenceStateMsg = messages.find((m) => m.event === "presence_state");
    expect(presenceStateMsg).toBeDefined();
    expect(presenceStateMsg?.payload).toBeDefined();

    socket.close();
  });

  test("receives presence diff when another user joins", async ({ page }) => {
    const baseURL = getPresenceHttpBaseUrl();
    const socketUrl = getPresenceSocketUrl(baseURL);

    const { token: token1 } = await getTestToken(baseURL);
    const {
      socket: socket1,
      messages: messages1,
      openPromise: socket1OpenPromise,
    } = await connectWebSocket(page, socketUrl, {
      token: token1,
    });

    await socket1OpenPromise;

    await page.waitForTimeout(500);

    const joinMsg = createPhoenixPushMessage(
      "workspace:diff-test-workspace",
      "phx_join",
      {},
      "1",
      null
    );
    socket1.send(JSON.stringify(joinMsg));
    await page.waitForTimeout(1000);

    const presenceStateMsg = messages1.find(
      (m) => m.event === "presence_state"
    );
    expect(presenceStateMsg).toBeDefined();
    expect(presenceStateMsg?.payload).toBeDefined();

    const socket2Page = await page.context().newPage();
    const { token: token2 } = await getTestToken(baseURL);
    const { socket: socket2, openPromise: socket2OpenPromise } =
      await connectWebSocket(socket2Page, socketUrl, {
        token: token2,
      });

    await socket2OpenPromise;

    await socket2Page.waitForTimeout(500);

    const joinMsg2 = createPhoenixPushMessage(
      "workspace:diff-test-workspace",
      "phx_join",
      {},
      "2",
      null
    );
    socket2.send(JSON.stringify(joinMsg2));
    await socket2Page.waitForTimeout(1500);

    const presenceDiffMsg = messages1.find((m) => m.event === "presence_diff");
    expect(presenceDiffMsg).toBeDefined();
    expect(presenceDiffMsg?.payload).toBeDefined();
    expect(presenceDiffMsg?.payload).toHaveProperty("joins");
    expect(presenceDiffMsg?.topic).toBe("workspace:diff-test-workspace");

    socket1.close();
    socket2.close();
    await socket2Page.close();
  });

  test("handles status update to idle", async ({ page }) => {
    const baseURL = getPresenceHttpBaseUrl();
    const socketUrl = getPresenceSocketUrl(baseURL);
    const { token } = await getTestToken(baseURL);

    const { socket, messages, openPromise } = await connectWebSocket(
      page,
      socketUrl,
      {
        token,
      }
    );

    await openPromise;

    await page.waitForTimeout(500);

    const joinChannelMessage = createPhoenixPushMessage(
      "workspace:status-test",
      "phx_join",
      {},
      "1",
      null
    );
    socket.send(JSON.stringify(joinChannelMessage));
    await page.waitForTimeout(1000);

    const joinReply = messages.find(
      (m) => m.event === "phx_reply" && m.payload?.status === "ok"
    );
    expect(joinReply).toBeDefined();

    const statusUpdateMessage = createPhoenixPushMessage(
      "workspace:status-test",
      "status_update",
      { status: "idle" },
      "2"
    );
    socket.send(JSON.stringify(statusUpdateMessage));
    await page.waitForTimeout(1000);

    expect(socket.readyState).toBe(WebSocket.OPEN);

    socket.close();
  });

  test("reconnects successfully with valid token", async ({ page }) => {
    const baseURL = getPresenceHttpBaseUrl();
    const socketUrl = getPresenceSocketUrl(baseURL);
    const { token } = await getTestToken(baseURL);

    const { socket, openPromise } = await connectWebSocket(page, socketUrl, {
      token,
    });

    await openPromise;

    await page.waitForTimeout(500);

    socket.close();
    await page.waitForTimeout(500);

    const {
      socket: socket2,
      messages: messages2,
      openPromise: socket2OpenPromise,
    } = await connectWebSocket(page, socketUrl, { token });

    await socket2OpenPromise;

    await page.waitForTimeout(500);

    expect(socket2.readyState).toBe(WebSocket.OPEN);
    expect(messages2.some((m) => m.event === "socket_open")).toBeTruthy();

    socket2.close();
  });

  test("handles activity ping", async ({ page }) => {
    const baseURL = getPresenceHttpBaseUrl();
    const socketUrl = getPresenceSocketUrl(baseURL);
    const { token } = await getTestToken(baseURL);

    const { socket, messages, openPromise } = await connectWebSocket(
      page,
      socketUrl,
      {
        token,
      }
    );

    await openPromise;

    await page.waitForTimeout(500);

    const joinChannelMessage = createPhoenixPushMessage(
      "workspace:activity-test",
      "phx_join",
      {},
      "1",
      null
    );
    socket.send(JSON.stringify(joinChannelMessage));
    await page.waitForTimeout(1000);

    const joinReply = messages.find(
      (m) => m.event === "phx_reply" && m.payload?.status === "ok"
    );
    expect(joinReply).toBeDefined();

    const pingTimestamp = Date.now();
    const activityPingMessage = createPhoenixPushMessage(
      "workspace:activity-test",
      "activity_ping",
      { timestamp: pingTimestamp },
      "2"
    );
    socket.send(JSON.stringify(activityPingMessage));
    await page.waitForTimeout(1000);

    expect(socket.readyState).toBe(WebSocket.OPEN);

    socket.close();
  });
});
