// Must be first - register happy-dom before any imports
import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  // Already registered, ignore
}

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, fireEvent, render } from "@testing-library/react";
import React from "react";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  writable: true,
  configurable: true,
});

mock.module("lucide-react", () => ({
  Columns: () => React.createElement("span", { "data-icon": "Columns" }),
  GripHorizontal: () =>
    React.createElement("span", { "data-icon": "GripHorizontal" }),
  Plus: () => React.createElement("span", { "data-icon": "Plus" }),
  X: () => React.createElement("span", { "data-icon": "X" }),
}));

mock.module("@xyflow/react", () => ({
  useReactFlow: () => ({
    flowToScreenPosition: (pos: { x: number; y: number }) => pos,
    screenToFlowPosition: (pos: { x: number; y: number }) => pos,
    getNode: () => null,
    setCenter: () => undefined,
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    setViewport: () => undefined,
  }),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}));

mock.module("@/src/hooks/use-dialog-presence", () => ({
  useDialogPresenceLifecycle: () => ({
    dialogCollaborator: null,
    handleDialogPointerDown: () => undefined,
  }),
}));

mock.module("@/src/components/ui/connector-edge", () => ({
  ConnectorEdge: () =>
    React.createElement("div", { "data-testid": "mock-connector-edge" }),
}));

mock.module("@/src/components/dialogs/dialog-presence-indicator", () => ({
  DialogPresenceIndicator: () => null,
}));

const mockBoard = {
  id: "board-1",
  name: "Sprint Board",
  description: "Board for sprint tasks",
  workspace_id: "ws-1",
  created_by: "user-1",
  created_at: new Date().toISOString(),
  column_ids: ["col-1", "col-2"],
  accentColor: "#6366f1",
  icon: "folder",
};

const mockRegisterDialog = mock(() => undefined);
const mockUnregisterDialog = mock(() => undefined);
const mockBringDialogToFront = mock(() => undefined);

mock.module("@/src/features/kanban/store/kanban-store", () => ({
  useKanbanStore: (
    selector: (state: {
      boards: { byId: Record<string, typeof mockBoard>; allIds: string[] };
      boardPositions: {
        byId: Record<string, { x: number; y: number }>;
        allIds: string[];
      };
      registerDialog: typeof mockRegisterDialog;
      unregisterDialog: typeof mockUnregisterDialog;
      bringDialogToFront: typeof mockBringDialogToFront;
      dialogFocusStack: string[];
      getDialogZIndex: () => number;
    }) => unknown
  ) => {
    const state = {
      boards: {
        byId: { "board-1": mockBoard },
        allIds: ["board-1"],
      },
      boardPositions: {
        byId: { "board-1": { x: 100, y: 100 } },
        allIds: ["board-1"],
      },
      registerDialog: mockRegisterDialog,
      unregisterDialog: mockUnregisterDialog,
      bringDialogToFront: mockBringDialogToFront,
      dialogFocusStack: ["column-create-dialog-board-1"],
      getDialogZIndex: () => 1000,
    };
    return selector(state);
  },
}));

import { ColumnCreateDialog } from "./column-create-dialog";

const noop = () => undefined;

describe("ColumnCreateDialog", () => {
  beforeEach(() => {
    mockRegisterDialog.mockClear();
    mockUnregisterDialog.mockClear();
    mockBringDialogToFront.mockClear();
  });

  it("does not render when isOpen is false", () => {
    act(() => {
      render(
        <ColumnCreateDialog
          boardId="board-1"
          isOpen={false}
          onClose={noop}
          onSubmit={noop}
        />
      );
    });

    const input = document.querySelector('[data-testid="column-name-input"]');
    expect(input).toBeNull();
  });

  it("does not render when board does not exist", () => {
    act(() => {
      render(
        <ColumnCreateDialog
          boardId="non-existent"
          isOpen={true}
          onClose={noop}
          onSubmit={noop}
        />
      );
    });

    const input = document.querySelector('[data-testid="column-name-input"]');
    expect(input).toBeNull();
  });

  it("renders input, board name initials, and buttons without dimming backdrop when open", () => {
    act(() => {
      render(
        <ColumnCreateDialog
          boardId="board-1"
          isOpen={true}
          onClose={noop}
          onSubmit={noop}
        />
      );
    });

    expect(
      document.querySelector('[data-testid="column-name-input"]')
    ).not.toBeNull();
    expect(
      document.querySelector('[data-testid="column-create-submit"]')
    ).not.toBeNull();
    expect(
      document.querySelector('[data-testid="column-create-cancel"]')
    ).not.toBeNull();
    expect(
      document.querySelector('[data-testid="column-create-close"]')
    ).not.toBeNull();
    // Verify no dimming backdrop element is rendered
    expect(
      document.querySelector('[data-testid="column-create-backdrop"]')
    ).toBeNull();
    expect(document.body.textContent).toContain("Sprint Board");
  });

  it("submits the entered column name when form is submitted", () => {
    const mockSubmit = mock((_name: string) => undefined);
    const mockClose = mock(() => undefined);

    act(() => {
      render(
        <ColumnCreateDialog
          boardId="board-1"
          initialValue="In Progress"
          isOpen={true}
          onClose={mockClose}
          onSubmit={mockSubmit}
        />
      );
    });

    const form = document.querySelector("form");
    expect(form).not.toBeNull();

    if (form) {
      act(() => {
        fireEvent.submit(form);
      });
    }

    expect(mockSubmit).toHaveBeenCalledWith("In Progress");
    expect(mockClose).toHaveBeenCalled();
  });

  it("does not submit when column name is whitespace only", () => {
    const mockSubmit = mock((_name: string) => undefined);
    const mockClose = mock(() => undefined);

    act(() => {
      render(
        <ColumnCreateDialog
          boardId="board-1"
          initialValue="   "
          isOpen={true}
          onClose={mockClose}
          onSubmit={mockSubmit}
        />
      );
    });

    const form = document.querySelector("form");
    expect(form).not.toBeNull();

    if (form) {
      act(() => {
        fireEvent.submit(form);
      });
    }

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Column name cannot be empty");
  });

  it("calls onClose when clicking cancel button", () => {
    const mockClose = mock(() => undefined);

    act(() => {
      render(
        <ColumnCreateDialog
          boardId="board-1"
          isOpen={true}
          onClose={mockClose}
          onSubmit={noop}
        />
      );
    });

    const cancelBtn = document.querySelector(
      '[data-testid="column-create-cancel"]'
    ) as HTMLButtonElement;
    act(() => {
      fireEvent.click(cancelBtn);
    });

    expect(mockClose).toHaveBeenCalled();
  });

  it("calls onClose when clicking close X button", () => {
    const mockClose = mock(() => undefined);

    act(() => {
      render(
        <ColumnCreateDialog
          boardId="board-1"
          isOpen={true}
          onClose={mockClose}
          onSubmit={noop}
        />
      );
    });

    const closeBtn = document.querySelector(
      '[data-testid="column-create-close"]'
    ) as HTMLButtonElement;
    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(mockClose).toHaveBeenCalled();
  });

  it("calls onClose when clicking outside the dialog", () => {
    const mockClose = mock(() => undefined);

    act(() => {
      render(
        <ColumnCreateDialog
          boardId="board-1"
          isOpen={true}
          onClose={mockClose}
          onSubmit={noop}
        />
      );
    });

    act(() => {
      document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(mockClose).toHaveBeenCalled();
  });

  it("closes when pressing Escape", () => {
    const mockClose = mock(() => undefined);

    act(() => {
      render(
        <ColumnCreateDialog
          boardId="board-1"
          isOpen={true}
          onClose={mockClose}
          onSubmit={noop}
        />
      );
    });

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });

    expect(mockClose).toHaveBeenCalled();
  });
});
