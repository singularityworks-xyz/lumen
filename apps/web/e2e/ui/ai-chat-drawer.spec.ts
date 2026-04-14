import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";

test.describe("E2E-AI-01: AI Chat Drawer", () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorageAndIndexedDB(page);
    await disableAnimations(page);
    await page.goto("/");
    await waitForAppReady(page);
    await page.waitForLoadState("networkidle");
  });

  test("floating indicator shows Larity tab", async ({ page }) => {
    const indicator = page.locator('[data-testid="ai-floating-indicator"]');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText("Larity");
  });

  test("clicking floating indicator opens AI drawer", async ({ page }) => {
    const indicator = page.locator('[data-testid="ai-floating-indicator"]');
    await indicator.click();

    const drawer = page.locator('[data-testid="ai-drawer"]');
    await expect(drawer).toBeVisible();
  });

  test("keyboard shortcut Ctrl+Shift+A toggles drawer", async ({ page }) => {
    const drawer = page.locator('[data-testid="ai-drawer"]');

    // Open with shortcut
    await page.keyboard.press("Control+Shift+A");
    await expect(drawer).toBeVisible();

    // Close with shortcut
    await page.keyboard.press("Control+Shift+A");
    await expect(drawer).not.toBeVisible();
  });

  test("drawer shows empty state for new conversation", async ({ page }) => {
    const indicator = page.locator('[data-testid="ai-floating-indicator"]');
    await indicator.click();

    const drawer = page.locator('[data-testid="ai-drawer"]');
    await expect(drawer).toBeVisible();

    // Should show welcome/empty state or input area
    const input = page.locator('[data-testid="ai-chat-input"]');
    await expect(input).toBeVisible();
  });

  test("drawer has backdrop overlay that closes on click", async ({ page }) => {
    const indicator = page.locator('[data-testid="ai-floating-indicator"]');
    await indicator.click();

    const drawer = page.locator('[data-testid="ai-drawer"]');
    await expect(drawer).toBeVisible();

    // Click backdrop (outside drawer content)
    const backdrop = page.locator('[data-testid="ai-drawer-backdrop"]');
    await expect(backdrop).toBeVisible();
    await backdrop.click({ position: { x: 10, y: 10 } });
    await expect(drawer).not.toBeVisible();
  });

  test("chat input accepts text", async ({ page }) => {
    const indicator = page.locator('[data-testid="ai-floating-indicator"]');
    await indicator.click();

    const input = page.locator('[data-testid="ai-chat-input"]');
    await input.fill("Show me my tasks");

    const value = await input.inputValue();
    expect(value).toBe("Show me my tasks");
  });

  test("suggestion chips are displayed", async ({ page }) => {
    const indicator = page.locator('[data-testid="ai-floating-indicator"]');
    await indicator.click();

    const suggestions = page.locator('[data-testid="suggestion-chip"]');
    const count = await suggestions.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(4);
  });

  test("clicking suggestion chip fills input", async ({ page }) => {
    const indicator = page.locator('[data-testid="ai-floating-indicator"]');
    await indicator.click();

    const firstSuggestion = page
      .locator('[data-testid="suggestion-chip"]')
      .first();
    await firstSuggestion.click();

    const input = page.locator('[data-testid="ai-chat-input"]');
    const value = await input.inputValue();
    // Input should be filled with the suggestion's prompt (not the label)
    expect(value.length).toBeGreaterThan(0);
    // The prompt should be longer and more descriptive than just a label
    expect(value.length).toBeGreaterThan(10);
  });
});

test.describe("E2E-AI-02: AI Chat Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorageAndIndexedDB(page);
    await disableAnimations(page);
    await page.goto("/");
    await waitForAppReady(page);
    await page.waitForLoadState("networkidle");

    // Open AI drawer
    const indicator = page.locator('[data-testid="ai-floating-indicator"]');
    await indicator.click();
    await page.waitForTimeout(500);
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    const sendButton = page.locator('[data-testid="ai-send-button"]');
    await expect(sendButton).toBeDisabled();
  });

  test("send button is enabled when input has text", async ({ page }) => {
    const input = page.locator('[data-testid="ai-chat-input"]');
    await input.fill("hello");

    const sendButton = page.locator('[data-testid="ai-send-button"]');
    await expect(sendButton).toBeEnabled();
  });

  test("pressing Enter sends message", async ({ page }) => {
    const input = page.locator('[data-testid="ai-chat-input"]');
    await input.fill("hello");
    await input.press("Enter");

    // Input should be cleared after sending
    await expect(input).toHaveValue("");
  });

  test("user message appears in chat after sending", async ({ page }) => {
    const input = page.locator('[data-testid="ai-chat-input"]');
    await input.fill("hello");
    await input.press("Enter");

    const userMessages = page.locator('[data-testid="message-user"]');
    await expect(userMessages.first()).toBeVisible();
    await expect(userMessages.first()).toContainText("hello");
  });

  test("clear conversation button exists and works", async ({ page }) => {
    // Send a message first
    const input = page.locator('[data-testid="ai-chat-input"]');
    await input.fill("test message");
    await input.press("Enter");

    await page.waitForTimeout(500);

    // Look for clear button
    const clearButton = page.locator('[data-testid="ai-clear-conversation"]');
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // Wait for confirmation modal to appear
    await page.waitForTimeout(300);

    // Clear button opens a confirmation modal
    const confirmClearButton = page.locator(
      '[data-testid="confirm-clear-conversation"]'
    );
    await expect(confirmClearButton).toBeVisible();
    await confirmClearButton.click();

    // Wait for clear to complete
    await page.waitForTimeout(300);

    // Messages should be cleared
    const messages = page.locator('[data-testid^="message-"]');
    await expect(messages).toHaveCount(0);
  });
});
