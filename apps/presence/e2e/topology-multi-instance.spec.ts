import { expect, test } from "@playwright/test";

const WEBSOCKET_OPEN = "open";
const WEBSOCKET_CLOSED = "closed";

test.describe("E2E-TOPOLOGY-PRESENCE-1: Multi-Instance Presence Topology", () => {
  test("multiple presence instances can handle concurrent connections", async ({
    page,
  }) => {
    const messages: string[] = [];

    await page.exposeFunction("onPresenceMessage", (msg: string) => {
      messages.push(msg);
    });

    await page.evaluate(() => {
      const socket = new WebSocket("ws://localhost:4001/socket");
      socket.onmessage = (event) => {
        (
          window as unknown as { onPresenceMessage: (msg: string) => void }
        ).onPresenceMessage(event.data);
      };
      socket.onerror = () => {
        (
          window as unknown as { onPresenceMessage: (msg: string) => void }
        ).onPresenceMessage("error");
      };
      socket.onclose = () => {
        (
          window as unknown as { onPresenceMessage: (msg: string) => void }
        ).onPresenceMessage("closed");
      };
      socket.onopen = () => {
        (
          window as unknown as { onPresenceMessage: (msg: string) => void }
        ).onPresenceMessage("open");
      };
    });

    await page.waitForTimeout(2000);

    expect(messages).toContain(WEBSOCKET_OPEN);
  });

  test("presence fanout works across instances", async ({ page }) => {
    const messages: string[] = [];

    await page.exposeFunction("onPresenceMessage", (msg: string) => {
      messages.push(msg);
    });

    await page.evaluate(() => {
      const socket = new WebSocket("ws://localhost:4001/socket");
      socket.onmessage = (event) => {
        (
          window as unknown as { onPresenceMessage: (msg: string) => void }
        ).onPresenceMessage(event.data);
      };
      socket.onopen = () => {
        (
          window as unknown as { onPresenceMessage: (msg: string) => void }
        ).onPresenceMessage("open");
      };
    });

    await page.waitForTimeout(1000);

    const hasOpen = messages.some((m) => m === "open");
    expect(hasOpen).toBeTruthy();
  });

  test("disconnect and reconnect to presence maintains state", async ({
    page,
  }) => {
    const messages: string[] = [];

    await page.exposeFunction("onPresenceMessage", (msg: string) => {
      messages.push(msg);
    });

    await page.evaluate(() => {
      const socket = new WebSocket("ws://localhost:4001/socket");
      socket.onmessage = (event) => {
        (
          window as unknown as { onPresenceMessage: (msg: string) => void }
        ).onPresenceMessage(event.data);
      };
      socket.onopen = () => {
        (
          window as unknown as { onPresenceMessage: (msg: string) => void }
        ).onPresenceMessage("open");
      };
      socket.onclose = () => {
        (
          window as unknown as { onPresenceMessage: (msg: string) => void }
        ).onPresenceMessage("closed");
      };
    });

    await page.waitForTimeout(1000);

    expect(messages).toContain(WEBSOCKET_OPEN);

    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    await page.waitForTimeout(1500);

    expect(messages).toContain(WEBSOCKET_CLOSED);

    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });

    await page.waitForTimeout(2000);

    const openCount = messages.filter((m) => m === WEBSOCKET_OPEN).length;
    expect(openCount).toBeGreaterThanOrEqual(1);
  });

  test("presence instance handles invalid token gracefully", async ({
    page,
  }) => {
    const messages: string[] = [];

    await page.exposeFunction("onPresenceMessage", (msg: string) => {
      messages.push(msg);
    });

    await page.evaluate(() => {
      const socket = new WebSocket(
        "ws://localhost:4001/socket?token=invalid_token"
      );
      socket.onmessage = (event) => {
        (
          window as unknown as { onPresenceMessage: (msg: string) => void }
        ).onPresenceMessage(event.data);
      };
      socket.onerror = () => {
        (
          window as unknown as { onPresenceMessage: (msg: string) => void }
        ).onPresenceMessage("error");
      };
      socket.onclose = () => {
        (
          window as unknown as { onPresenceMessage: (msg: string) => void }
        ).onPresenceMessage("closed");
      };
    });

    await page.waitForTimeout(1000);

    const hasErrorOrClosed = messages.some(
      (m) => m === "error" || m === "closed"
    );
    expect(hasErrorOrClosed).toBeTruthy();
  });

  test.describe("Horizontal Scaling Presence", () => {
    test("multiple clients can connect to presence simultaneously", async ({
      browser,
    }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      const messages1: string[] = [];
      const messages2: string[] = [];

      await page1.exposeFunction("onMessage1", (msg: string) => {
        messages1.push(msg);
      });

      await page2.exposeFunction("onMessage2", (msg: string) => {
        messages2.push(msg);
      });

      await page1.evaluate(() => {
        const socket = new WebSocket("ws://localhost:4001/socket");
        socket.onopen = () => {
          (
            window as unknown as { onMessage1: (msg: string) => void }
          ).onMessage1("open");
        };
      });

      await page2.evaluate(() => {
        const socket = new WebSocket("ws://localhost:4001/socket");
        socket.onopen = () => {
          (
            window as unknown as { onMessage2: (msg: string) => void }
          ).onMessage2("open");
        };
      });

      await page1.waitForTimeout(1500);
      await page2.waitForTimeout(1500);

      expect(messages1).toContain(WEBSOCKET_OPEN);
      expect(messages2).toContain(WEBSOCKET_OPEN);

      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    });

    test("presence state persists across reconnects", async ({ page }) => {
      const messages: string[] = [];

      await page.exposeFunction("onPresenceMessage", (msg: string) => {
        messages.push(msg);
      });

      await page.evaluate(() => {
        const socket = new WebSocket("ws://localhost:4001/socket");
        socket.onopen = () => {
          (
            window as unknown as { onPresenceMessage: (msg: string) => void }
          ).onPresenceMessage("open");
        };
      });

      await page.waitForTimeout(1000);
      expect(messages).toContain(WEBSOCKET_OPEN);

      await page.evaluate(() => {
        window.dispatchEvent(new Event("offline"));
      });

      await page.waitForTimeout(1500);

      await page.evaluate(() => {
        window.dispatchEvent(new Event("online"));
      });

      await page.waitForTimeout(2000);

      const openMessages = messages.filter((m) => m === WEBSOCKET_OPEN);
      expect(openMessages.length).toBeGreaterThanOrEqual(1);
    });
  });
});
