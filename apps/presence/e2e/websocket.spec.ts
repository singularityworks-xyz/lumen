import { expect, test } from "@playwright/test";

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
