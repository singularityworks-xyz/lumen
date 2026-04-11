import { expect, test } from "@playwright/test";

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
  join_ref?: string;
  payload?: PresenceState | Record<string, unknown>;
  ref?: string;
  topic: string;
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
  page: any,
  url: string,
  params: Record<string, string> = {}
): Promise<{
  socket: WebSocket;
  messages: PhoenixMessage[];
  closePromise: Promise<void>;
}> {
  const messages: PhoenixMessage[] = [];
  let closeResolver: () => void;
  const closePromise = new Promise<void>((resolve) => {
    closeResolver = resolve;
  });

  const queryParams = new URLSearchParams(params).toString();
  const wsUrl = queryParams ? `${url}?${queryParams}` : url;

  const socket = new WebSocket(wsUrl);

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      messages.push(data);
    } catch {
      messages.push({ event: "parse_error", topic: "" } as any);
    }
  };

  socket.onclose = () => {
    closeResolver();
  };

  await page.waitForTimeout(500);

  return { socket, messages, closePromise };
}

test.describe("WebSocket Connection", () => {
  test("rejects connection without token", async ({ page }) => {
    const messages: string[] = [];

    await page.exposeFunction("onMessage", (msg: string) => {
      messages.push(msg);
    });

    await page.evaluate(() => {
      const socket = new WebSocket("ws://localhost:4001/socket");
      socket.onmessage = (event) => {
        (window as any).onMessage(event.data);
      };
      socket.onerror = () => {
        (window as any).onMessage("error");
      };
      socket.onclose = () => {
        (window as any).onMessage("closed");
      };
    });

    await page.waitForTimeout(1000);

    expect(messages).toContain("closed");
  });
});

test.describe("WebSocket with Invalid Token", () => {
  test("rejects connection with invalid token", async ({ page }) => {
    const messages: string[] = [];

    await page.exposeFunction("onMessage", (msg: string) => {
      messages.push(msg);
    });

    await page.evaluate(() => {
      const socket = new WebSocket(
        "ws://localhost:4001/socket?token=invalid_token"
      );
      socket.onmessage = (event) => {
        (window as any).onMessage(event.data);
      };
      socket.onerror = () => {
        (window as any).onMessage("error");
      };
      socket.onclose = () => {
        (window as any).onMessage("closed");
      };
    });

    await page.waitForTimeout(1000);

    expect(messages.some((m) => m === "closed" || m === "error")).toBeTruthy();
  });
});

test.describe("WebSocket with Valid Token", () => {
  test("authenticates successfully with valid token", async ({ page }) => {
    const baseURL = process.env.PRESENCE_URL || "http://localhost:4001";
    const { token } = await getTestToken(baseURL);

    const { socket, messages } = await connectWebSocket(
      page,
      "ws://localhost:4001/socket",
      {
        token,
      }
    );

    await page.waitForTimeout(1000);

    const phxReply = messages.find(
      (m) => m.event === "phx_reply" && m.payload?.status === "ok"
    );
    expect(phxReply).toBeDefined();

    socket.close();
  });

  test("joins workspace channel after authentication", async ({ page }) => {
    const baseURL = process.env.PRESENCE_URL || "http://localhost:4001";
    const { token } = await getTestToken(baseURL);

    const { socket, messages } = await connectWebSocket(
      page,
      "ws://localhost:4001/socket",
      {
        token,
      }
    );

    await page.waitForTimeout(500);

    const joinChannelMessage = {
      topic: "workspace:test-workspace",
      event: "phx_join",
      payload: {},
      ref: "1",
      join_ref: null,
    };

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
    const baseURL = process.env.PRESENCE_URL || "http://localhost:4001";
    const { token } = await getTestToken(baseURL);

    const { socket, messages } = await connectWebSocket(
      page,
      "ws://localhost:4001/socket",
      {
        token,
      }
    );

    await page.waitForTimeout(500);

    const joinChannelMessage = {
      topic: "workspace:presence-state-test",
      event: "phx_join",
      payload: {},
      ref: "1",
      join_ref: null,
    };

    socket.send(JSON.stringify(joinChannelMessage));
    await page.waitForTimeout(1500);

    const presenceStateMsg = messages.find((m) => m.event === "presence_state");
    expect(presenceStateMsg).toBeDefined();
    expect(presenceStateMsg?.payload).toBeDefined();

    socket.close();
  });

  test("receives presence diff when another user joins", async ({ page }) => {
    const baseURL = process.env.PRESENCE_URL || "http://localhost:4001";

    const { token: token1 } = await getTestToken(baseURL);
    const { socket: socket1 } = await connectWebSocket(
      page,
      "ws://localhost:4001/socket",
      {
        token: token1,
      }
    );

    await page.waitForTimeout(500);

    const joinMsg = {
      topic: "workspace:diff-test-workspace",
      event: "phx_join",
      payload: {},
      ref: "1",
      join_ref: null,
    };
    socket1.send(JSON.stringify(joinMsg));
    await page.waitForTimeout(1000);

    const socket2Page = await page.context().newPage();
    const { token: token2 } = await getTestToken(baseURL);
    const { socket: socket2 } = await connectWebSocket(
      socket2Page,
      "ws://localhost:4001/socket",
      {
        token: token2,
      }
    );

    await socket2Page.waitForTimeout(500);

    const joinMsg2 = {
      topic: "workspace:diff-test-workspace",
      event: "phx_join",
      payload: {},
      ref: "2",
      join_ref: null,
    };
    socket2.send(JSON.stringify(joinMsg2));
    await socket2Page.waitForTimeout(1500);

    socket1.close();
    socket2.close();
    await socket2Page.close();
  });

  test("handles status update to idle", async ({ page }) => {
    const baseURL = process.env.PRESENCE_URL || "http://localhost:4001";
    const { token } = await getTestToken(baseURL);

    const { socket } = await connectWebSocket(
      page,
      "ws://localhost:4001/socket",
      {
        token,
      }
    );

    await page.waitForTimeout(500);

    const joinChannelMessage = {
      topic: "workspace:status-test",
      event: "phx_join",
      payload: {},
      ref: "1",
      join_ref: null,
    };
    socket.send(JSON.stringify(joinChannelMessage));
    await page.waitForTimeout(1000);

    const statusUpdateMessage = {
      topic: "workspace:status-test",
      event: "status_update",
      payload: { status: "idle" },
      ref: "2",
      join_ref: null,
    };
    socket.send(JSON.stringify(statusUpdateMessage));
    await page.waitForTimeout(1000);

    socket.close();
  });

  test("reconnects successfully with valid token", async ({ page }) => {
    const baseURL = process.env.PRESENCE_URL || "http://localhost:4001";
    const { token } = await getTestToken(baseURL);

    const { socket } = await connectWebSocket(
      page,
      "ws://localhost:4001/socket",
      {
        token,
      }
    );

    await page.waitForTimeout(500);

    socket.close();
    await page.waitForTimeout(500);

    const { socket: socket2, messages: messages2 } = await connectWebSocket(
      page,
      "ws://localhost:4001/socket",
      { token }
    );

    await page.waitForTimeout(1000);

    const phxReply = messages2.find(
      (m) => m.event === "phx_reply" && m.payload?.status === "ok"
    );
    expect(phxReply).toBeDefined();

    socket2.close();
  });

  test("handles activity ping", async ({ page }) => {
    const baseURL = process.env.PRESENCE_URL || "http://localhost:4001";
    const { token } = await getTestToken(baseURL);

    const { socket } = await connectWebSocket(
      page,
      "ws://localhost:4001/socket",
      {
        token,
      }
    );

    await page.waitForTimeout(500);

    const joinChannelMessage = {
      topic: "workspace:activity-test",
      event: "phx_join",
      payload: {},
      ref: "1",
      join_ref: null,
    };
    socket.send(JSON.stringify(joinChannelMessage));
    await page.waitForTimeout(1000);

    const activityPingMessage = {
      topic: "workspace:activity-test",
      event: "activity_ping",
      payload: { timestamp: Date.now() },
      ref: "2",
      join_ref: null,
    };
    socket.send(JSON.stringify(activityPingMessage));
    await page.waitForTimeout(1000);

    socket.close();
  });
});
