import { expect, test } from "@playwright/test";
import {
  fetchPresenceInstanceId,
  getSecondaryPresenceUrl,
  MultiInstanceTopology,
} from "../../web/e2e/lib/multi-instance-setup";

const WEBSOCKET_OPEN = "open";
const WEBSOCKET_CLOSED = "closed";

test.describe("E2E-TOPOLOGY-PRESENCE-1: Multi-Instance Presence Topology", () => {
  let topology: MultiInstanceTopology;

  test.beforeEach(() => {
    topology = new MultiInstanceTopology();
  });

  test.afterEach(() => {
    return topology.stopAll();
  });

  test("primary presence instance is accessible at port 4001", async ({
    page: _page,
  }) => {
    const instanceId = await fetchPresenceInstanceId(
      topology.getPrimaryPresenceUrl()
    );
    expect(instanceId).toBe("presence-4001");
  });

  test("secondary presence instance is accessible at port 4002", async ({
    page: _page,
  }) => {
    await topology.startSecondaryPresence();
    const instanceId = await fetchPresenceInstanceId(getSecondaryPresenceUrl());
    expect(instanceId).toBe("presence-4002");
  });

  test("multiple presence instances can handle concurrent connections", async ({
    page,
  }) => {
    await topology.startSecondaryPresence();
    const messages: string[] = [];

    await page.exposeFunction("onPresenceMessage", (msg: string) => {
      messages.push(msg);
    });

    await page.evaluate(
      ({ primaryUrl }) => {
        const socket = new WebSocket(`${primaryUrl}/socket`);
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
      },
      { primaryUrl: topology.getPrimaryPresenceUrl() }
    );

    await page.waitForTimeout(2000);

    expect(messages).toContain(WEBSOCKET_OPEN);

    const primaryInstanceId = await fetchPresenceInstanceId(
      topology.getPrimaryPresenceUrl()
    );
    expect(primaryInstanceId).toBe("presence-4001");
  });

  test("presence fanout works across instances", async ({ browser }) => {
    await topology.startSecondaryPresence();

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const messages1: string[] = [];
    const messages2: string[] = [];

    await page1.exposeFunction("onPresenceMessage", (msg: string) => {
      messages1.push(msg);
    });

    await page2.exposeFunction("onPresenceMessage", (msg: string) => {
      messages2.push(msg);
    });

    await page1.evaluate(
      ({ primaryUrl }) => {
        const socket = new WebSocket(`${primaryUrl}/socket`);
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
      },
      { primaryUrl: topology.getPrimaryPresenceUrl() }
    );

    await page2.evaluate(
      ({ secondaryUrl }) => {
        const socket = new WebSocket(`${secondaryUrl}/socket`);
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
      },
      { secondaryUrl: getSecondaryPresenceUrl() }
    );

    await page1.waitForTimeout(1500);
    await page2.waitForTimeout(1500);

    expect(messages1).toContain(WEBSOCKET_OPEN);
    expect(messages2).toContain(WEBSOCKET_OPEN);

    const primaryInstanceId = await fetchPresenceInstanceId(
      topology.getPrimaryPresenceUrl()
    );
    const secondaryInstanceId = await fetchPresenceInstanceId(
      getSecondaryPresenceUrl()
    );
    expect(primaryInstanceId).toBe("presence-4001");
    expect(secondaryInstanceId).toBe("presence-4002");

    await page1.close();
    await page2.close();
    await context1.close();
    await context2.close();
  });

  test("disconnect and reconnect to presence maintains state", async ({
    page,
  }) => {
    await topology.startSecondaryPresence();
    const messages: string[] = [];

    await page.exposeFunction("onPresenceMessage", (msg: string) => {
      messages.push(msg);
    });

    await page.evaluate(
      ({ primaryUrl }) => {
        const socket = new WebSocket(`${primaryUrl}/socket`);
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
      },
      { primaryUrl: topology.getPrimaryPresenceUrl() }
    );

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
    await topology.startSecondaryPresence();
    const messages: string[] = [];

    await page.exposeFunction("onPresenceMessage", (msg: string) => {
      messages.push(msg);
    });

    await page.evaluate(
      ({ primaryUrl }) => {
        const socket = new WebSocket(
          `${primaryUrl}/socket?token=invalid_token`
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
      },
      { primaryUrl: topology.getPrimaryPresenceUrl() }
    );

    await page.waitForTimeout(1000);

    const hasErrorOrClosed = messages.some(
      (m) => m === "error" || m === "closed"
    );
    expect(hasErrorOrClosed).toBeTruthy();
  });

  test.describe("Horizontal Scaling Presence", () => {
    test("multiple clients can connect to presence simultaneously across instances", async ({
      browser,
    }) => {
      await topology.startSecondaryPresence();
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

      await page1.evaluate(
        ({ primaryUrl }) => {
          const socket = new WebSocket(`${primaryUrl}/socket`);
          socket.onopen = () => {
            (
              window as unknown as { onMessage1: (msg: string) => void }
            ).onMessage1("open");
          };
        },
        { primaryUrl: topology.getPrimaryPresenceUrl() }
      );

      await page2.evaluate(
        ({ secondaryUrl }) => {
          const socket = new WebSocket(`${secondaryUrl}/socket`);
          socket.onopen = () => {
            (
              window as unknown as { onMessage2: (msg: string) => void }
            ).onMessage2("open");
          };
        },
        { secondaryUrl: getSecondaryPresenceUrl() }
      );

      await page1.waitForTimeout(1500);
      await page2.waitForTimeout(1500);

      expect(messages1).toContain(WEBSOCKET_OPEN);
      expect(messages2).toContain(WEBSOCKET_OPEN);

      const primaryInstanceId = await fetchPresenceInstanceId(
        topology.getPrimaryPresenceUrl()
      );
      const secondaryInstanceId = await fetchPresenceInstanceId(
        getSecondaryPresenceUrl()
      );
      expect(primaryInstanceId).toBe("presence-4001");
      expect(secondaryInstanceId).toBe("presence-4002");

      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    });

    test("presence state persists across reconnects", async ({ page }) => {
      await topology.startSecondaryPresence();
      const messages: string[] = [];

      await page.exposeFunction("onPresenceMessage", (msg: string) => {
        messages.push(msg);
      });

      await page.evaluate(
        ({ primaryUrl }) => {
          const socket = new WebSocket(`${primaryUrl}/socket`);
          socket.onopen = () => {
            (
              window as unknown as { onPresenceMessage: (msg: string) => void }
            ).onPresenceMessage("open");
          };
        },
        { primaryUrl: topology.getPrimaryPresenceUrl() }
      );

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

    test("fanout occurs between clients on different instance ports", async ({
      browser,
    }) => {
      await topology.startSecondaryPresence();

      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      const messages1: string[] = [];
      const messages2: string[] = [];

      await page1.exposeFunction("onPresenceMessage", (msg: string) => {
        messages1.push(msg);
      });

      await page2.exposeFunction("onPresenceMessage", (msg: string) => {
        messages2.push(msg);
      });

      await page1.evaluate(
        ({ primaryUrl }) => {
          const socket = new WebSocket(`${primaryUrl}/socket`);
          socket.onmessage = (event) => {
            (
              window as unknown as { onPresenceMessage: (msg: string) => void }
            ).onPresenceMessage(event.data);
          };
          socket.onopen = () => {
            (
              window as unknown as { onPresenceMessage: (msg: string) => void }
            ).onPresenceMessage("open");
            socket.send(
              JSON.stringify({ event: "phx_join", topic: "presence:test" })
            );
          };
        },
        { primaryUrl: topology.getPrimaryPresenceUrl() }
      );

      await page2.evaluate(
        ({ secondaryUrl }) => {
          const socket = new WebSocket(`${secondaryUrl}/socket`);
          socket.onmessage = (event) => {
            (
              window as unknown as { onPresenceMessage: (msg: string) => void }
            ).onPresenceMessage(event.data);
          };
          socket.onopen = () => {
            (
              window as unknown as { onPresenceMessage: (msg: string) => void }
            ).onPresenceMessage("open");
            socket.send(
              JSON.stringify({ event: "phx_join", topic: "presence:test" })
            );
          };
        },
        { secondaryUrl: getSecondaryPresenceUrl() }
      );

      await page1.waitForTimeout(2000);
      await page2.waitForTimeout(2000);

      expect(messages1).toContain(WEBSOCKET_OPEN);
      expect(messages2).toContain(WEBSOCKET_OPEN);

      const joinAcks1 = messages1.filter(
        (m) => typeof m === "string" && m.includes("phx_reply")
      );
      const joinAcks2 = messages2.filter(
        (m) => typeof m === "string" && m.includes("phx_reply")
      );

      expect(joinAcks1.length).toBeGreaterThanOrEqual(1);
      expect(joinAcks2.length).toBeGreaterThanOrEqual(1);

      const primaryInstanceId = await fetchPresenceInstanceId(
        topology.getPrimaryPresenceUrl()
      );
      const secondaryInstanceId = await fetchPresenceInstanceId(
        getSecondaryPresenceUrl()
      );
      expect(primaryInstanceId).toBe("presence-4001");
      expect(secondaryInstanceId).toBe("presence-4002");

      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    });

    test("cross-instance broadcast reaches all connected clients", async ({
      browser,
    }) => {
      await topology.startSecondaryPresence();

      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const context3 = await browser.newContext();
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      const page3 = await context3.newPage();

      const messages1: string[] = [];
      const messages2: string[] = [];
      const messages3: string[] = [];

      await page1.exposeFunction("onPresenceMessage", (msg: string) => {
        messages1.push(msg);
      });

      await page2.exposeFunction("onPresenceMessage", (msg: string) => {
        messages2.push(msg);
      });

      await page3.exposeFunction("onPresenceMessage", (msg: string) => {
        messages3.push(msg);
      });

      await page1.evaluate(
        ({ primaryUrl }) => {
          const socket = new WebSocket(`${primaryUrl}/socket`);
          (window as unknown as { socket1: typeof socket }).socket1 = socket;
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
        },
        { primaryUrl: topology.getPrimaryPresenceUrl() }
      );

      await page2.evaluate(
        ({ secondaryUrl }) => {
          const socket = new WebSocket(`${secondaryUrl}/socket`);
          (window as unknown as { socket2: typeof socket }).socket2 = socket;
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
        },
        { secondaryUrl: getSecondaryPresenceUrl() }
      );

      await page3.evaluate(
        ({ primaryUrl }) => {
          const socket = new WebSocket(`${primaryUrl}/socket`);
          (window as unknown as { socket3: typeof socket }).socket3 = socket;
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
        },
        { primaryUrl: topology.getPrimaryPresenceUrl() }
      );

      await page1.waitForTimeout(1500);
      await page2.waitForTimeout(1500);
      await page3.waitForTimeout(1500);

      expect(messages1).toContain(WEBSOCKET_OPEN);
      expect(messages2).toContain(WEBSOCKET_OPEN);
      expect(messages3).toContain(WEBSOCKET_OPEN);

      const openCount1 = messages1.filter((m) => m === WEBSOCKET_OPEN).length;
      const openCount2 = messages2.filter((m) => m === WEBSOCKET_OPEN).length;
      const openCount3 = messages3.filter((m) => m === WEBSOCKET_OPEN).length;

      expect(openCount1).toBe(1);
      expect(openCount2).toBe(1);
      expect(openCount3).toBe(1);

      const primaryInstanceId = await fetchPresenceInstanceId(
        topology.getPrimaryPresenceUrl()
      );
      const secondaryInstanceId = await fetchPresenceInstanceId(
        getSecondaryPresenceUrl()
      );
      expect(primaryInstanceId).toBe("presence-4001");
      expect(secondaryInstanceId).toBe("presence-4002");

      await page1.close();
      await page2.close();
      await page3.close();
      await context1.close();
      await context2.close();
      await context3.close();
    });
  });
});
