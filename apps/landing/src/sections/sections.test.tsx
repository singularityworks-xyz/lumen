import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!(globalThis.document && globalThis.window)) {
  try {
    GlobalRegistrator.register();
  } catch {
    // Already registered
  }
}

import { describe, expect, it } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { ArchitectureConceptsSection } from "./architecture-concepts";
import { ColophonSection } from "./colophon";
import { ConnectedCardsSection } from "./connected-cards";
import { KanbanShowcase } from "./kanban-showcase";

const COMPLETE_BUTTONS_REGEX = /mark complete|mark incomplete/i;
const METADATA_BUTTONS_REGEX = /Deep Task Metas/i;
const NETWORK_ONLINE_REGEX = /Network: Online/i;
const NETWORK_OFFLINE_REGEX = /Network: Offline/i;

describe("Landing Page Revamped Sections", () => {
  describe("KanbanShowcase", () => {
    it("renders the kanban board container, header, and columns", () => {
      const { getByText } = render(<KanbanShowcase />);

      expect(getByText("Spatial Kanban Engine")).toBeDefined();
      expect(getByText("Core Engine & Architecture")).toBeDefined();
      expect(getByText("To Do")).toBeDefined();
      expect(getByText("In Progress")).toBeDefined();
      expect(getByText("Done")).toBeDefined();
    });

    it("displays task cards and allows interactive completion toggle", () => {
      const { getByText, getAllByRole } = render(<KanbanShowcase />);

      expect(getByText("Local SQLite & Yjs Storage Engine")).toBeDefined();

      const completeButtons = getAllByRole("button", {
        name: COMPLETE_BUTTONS_REGEX,
      });
      expect(completeButtons.length).toBeGreaterThan(0);

      // Toggle first task completion
      fireEvent.click(completeButtons[0]);
    });

    it("allows filtering and switching feature annotations", () => {
      const { getAllByRole } = render(<KanbanShowcase />);

      const metadataButtons = getAllByRole("button", {
        name: METADATA_BUTTONS_REGEX,
      });
      expect(metadataButtons.length).toBeGreaterThan(0);
      fireEvent.click(metadataButtons[0]);
    });
  });

  describe("ConnectedCardsSection", () => {
    it("renders all 4 connected system nodes and connector badges", () => {
      const { getByText } = render(<ConnectedCardsSection />);

      expect(
        getByText("Connect your thoughts. Map your architecture.")
      ).toBeDefined();
      expect(getByText("Spatial Design System")).toBeDefined();
      expect(getByText("Yjs CRDT Sync Core")).toBeDefined();
      expect(getByText("Phoenix Presence Hub")).toBeDefined();
      expect(getByText("Global Edge Runtime")).toBeDefined();

      // Connector labels
      expect(getByText("triggers state update")).toBeDefined();
      expect(getByText("streams delta to peers")).toBeDefined();
    });
  });

  describe("ArchitectureConceptsSection", () => {
    it("renders all three architectural pillars", () => {
      const { getByText } = render(<ArchitectureConceptsSection />);

      expect(
        getByText("Workspaces with boundless spatial freedom.")
      ).toBeDefined();
      expect(
        getByText("Real-time collaboration that feels like being in the room.")
      ).toBeDefined();
      expect(
        getByText(
          "Zero-latency local writes. Mathematical conflict resolution."
        )
      ).toBeDefined();
    });

    it("supports interactive simulated network offline/online toggle", () => {
      const { getByRole, getByText } = render(<ArchitectureConceptsSection />);

      const toggleButton = getByRole("button", {
        name: NETWORK_ONLINE_REGEX,
      });
      fireEvent.click(toggleButton);

      expect(getByText(NETWORK_OFFLINE_REGEX)).toBeDefined();
    });
  });

  describe("ColophonSection", () => {
    it("renders brand information, technical principles, and no pricing", () => {
      const { getByText, queryByText } = render(<ColophonSection />);

      expect(getByText("LUMEN")).toBeDefined();
      expect(getByText("Technical Principles")).toBeDefined();
      expect(getByText("Local-First SQLite & IndexedDB")).toBeDefined();

      // Ensure pricing is completely removed
      expect(queryByText("$8")).toBeNull();
      expect(queryByText("$220")).toBeNull();
    });
  });
});
