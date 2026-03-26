import { type BrowserContext, expect, test } from "@playwright/test";
import {
  disableAnimations,
  freezeDate,
  seedPopulatedWorkspace,
  waitForCanvas,
  waitForHydration,
} from "./helpers/visual-test-utils";

test.describe("VIS-06: Multi-User Overlay Visual Regression", () => {
  let secondContext: BrowserContext;
  let secondPage: import("@playwright/test").Page;

  test.beforeEach(async ({ browser }) => {
    secondContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
    });
    secondPage = await secondContext.newPage();

    freezeDate(await secondPage);
    disableAnimations(await secondPage);
  });

  test.afterEach(async () => {
    await secondContext.close();
  });

  test("collaboration cursor overlay baseline", async ({ page }) => {
    freezeDate(page);
    disableAnimations(page);
    await page.goto("/");
    await waitForHydration(page);
    await seedPopulatedWorkspace(page);
    await page.reload();
    await waitForHydration(page);
    await waitForCanvas(page);
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      require("@/src/features/kanban/store/kanban-store");
      const { useCollaboration } = require("@/src/features/collab");

      const collaborator = {
        id: "user-2",
        name: "Alice Johnson",
        color: "#FF6B6B",
        cursor: { x: 500, y: 300 },
        selectionBox: null,
        draggingTask: null,
        draggingColumn: null,
      };

      const collabState = useCollaboration.getState();
      if (collabState && typeof collabState.setCollaborators === "function") {
        collabState.setCollaborators([collaborator]);
      }
    });

    await page.waitForTimeout(500);

    const cursorOverlay = page.locator(
      ".pointer-events-none.absolute.inset-0.overflow-hidden"
    );
    await expect(cursorOverlay).toBeVisible();

    await expect(page).toHaveScreenshot("multi-user-cursor-overlay.png", {
      animations: "disabled",
    });
  });

  test("collaboration selection overlay baseline", async ({ page }) => {
    freezeDate(page);
    disableAnimations(page);
    await page.goto("/");
    await waitForHydration(page);
    await seedPopulatedWorkspace(page);
    await page.reload();
    await waitForHydration(page);
    await waitForCanvas(page);
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const { useCollaboration } = require("@/src/features/collab");

      const collaborator = {
        id: "user-2",
        name: "Alice Johnson",
        color: "#4ECDC4",
        cursor: null,
        selectionBox: { x: 200, y: 150, width: 300, height: 200 },
        draggingTask: null,
        draggingColumn: null,
      };

      const collabState = useCollaboration.getState();
      if (collabState && typeof collabState.setCollaborators === "function") {
        collabState.setCollaborators([collaborator]);
      }
    });

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("multi-user-selection-overlay.png", {
      animations: "disabled",
    });
  });

  test("two user state with cursors and selections", async ({ page }) => {
    freezeDate(page);
    disableAnimations(page);
    await page.goto("/");
    await waitForHydration(page);
    await seedPopulatedWorkspace(page);
    await page.reload();
    await waitForHydration(page);
    await waitForCanvas(page);
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const { useCollaboration } = require("@/src/features/collab");

      const collaborators = [
        {
          id: "user-2",
          name: "Alice Johnson",
          color: "#FF6B6B",
          cursor: { x: 500, y: 300 },
          selectionBox: null,
          draggingTask: null,
          draggingColumn: null,
        },
        {
          id: "user-3",
          name: "Bob Smith",
          color: "#4ECDC4",
          cursor: { x: 800, y: 400 },
          selectionBox: { x: 600, y: 200, width: 200, height: 150 },
          draggingTask: null,
          draggingColumn: null,
        },
      ];

      const collabState = useCollaboration.getState();
      if (collabState && typeof collabState.setCollaborators === "function") {
        collabState.setCollaborators(collaborators);
      }
    });

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("multi-user-two-users-overlay.png", {
      animations: "disabled",
    });
  });

  test("cursor name label visible", async ({ page }) => {
    freezeDate(page);
    disableAnimations(page);
    await page.goto("/");
    await waitForHydration(page);
    await seedPopulatedWorkspace(page);
    await page.reload();
    await waitForHydration(page);
    await waitForCanvas(page);
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const { useCollaboration } = require("@/src/features/collab");

      const collaborator = {
        id: "user-2",
        name: "Alice Johnson",
        color: "#FF6B6B",
        cursor: { x: 500, y: 300 },
        selectionBox: null,
        draggingTask: null,
        draggingColumn: null,
      };

      const collabState = useCollaboration.getState();
      if (collabState && typeof collabState.setCollaborators === "function") {
        collabState.setCollaborators([collaborator]);
      }
    });

    await page.waitForTimeout(500);

    const nameLabel = page.locator("text=Alice");
    await expect(nameLabel.first()).toBeVisible();

    await expect(page).toHaveScreenshot("multi-user-cursor-name-label.png", {
      animations: "disabled",
    });
  });

  test("edge indicator when cursor off screen", async ({ page }) => {
    freezeDate(page);
    disableAnimations(page);
    await page.goto("/");
    await waitForHydration(page);
    await seedPopulatedWorkspace(page);
    await page.reload();
    await waitForHydration(page);
    await waitForCanvas(page);
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      const { useCollaboration } = require("@/src/features/collab");

      const collaborator = {
        id: "user-2",
        name: "Alice Johnson",
        color: "#FF6B6B",
        cursor: { x: 5000, y: 5000 },
        selectionBox: null,
        draggingTask: null,
        draggingColumn: null,
      };

      const collabState = useCollaboration.getState();
      if (collabState && typeof collabState.setCollaborators === "function") {
        collabState.setCollaborators([collaborator]);
      }
    });

    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("multi-user-edge-indicator.png", {
      animations: "disabled",
    });
  });
});
