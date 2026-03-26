import type { Page } from "@playwright/test";

export async function clearLocalStorageAndIndexedDB(page: Page) {
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("lumen-kanban-store");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
}

export async function disableAnimations(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `;
    document.head.appendChild(style);
  });
}

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () => {
      return (
        document.querySelector('[data-testid="workspace-selector"]') !== null ||
        document.querySelector('[data-testid="welcome-screen"]') !== null
      );
    },
    { timeout: 15_000 }
  );
}

export function getStoreState(page: Page) {
  return page.evaluate(() => {
    const storeElement = document.querySelector('[data-testid="kanban-store"]');
    return storeElement
      ? JSON.parse(storeElement.getAttribute("data-state") || "{}")
      : null;
  });
}
