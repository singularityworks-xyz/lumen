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

let capturedConnectorOptions: Record<string, unknown> = {};

mock.module("@/src/hooks/use-imperative-connector", () => ({
  useImperativeConnector: (opts: Record<string, unknown>) => {
    capturedConnectorOptions = opts;
  },
}));

mock.module("@/src/hooks/use-dialog-presence", () => ({
  useDialogPresenceLifecycle: () => ({
    dialogCollaborator: null,
    handleDialogPointerDown: mock(),
  }),
}));

mock.module("react-colorful", () => ({
  HexColorPicker: ({
    color,
    onChange,
  }: {
    color: string;
    onChange: (color: string) => void;
  }) =>
    React.createElement("input", {
      "data-testid": "hex-color-picker",
      value: color,
      onChange: (e) => onChange(e.target.value),
    }),
}));

mock.module("lucide-react", () => ({
  GripHorizontal: () =>
    React.createElement("span", { "data-icon": "GripHorizontal" }),
  X: () => React.createElement("span", { "data-icon": "X" }),
}));

const mockUpdateArea = mock();
const mockCloseAreaDialog = mock();
const mockRegisterDialog = mock();
const mockUnregisterDialog = mock();
const mockBringDialogToFront = mock();

const mockArea = {
  id: "area-1",
  name: "Platform Team",
  workspace_id: "ws-1",
  color: "#6366f1",
  icon: "Server",
  board_ids: ["board-1"],
  created_at: new Date().toISOString(),
};

const mockAreaDialog = {
  id: "dlg-1",
  areaId: "area-1",
  areaName: "Platform Team",
  position: { x: 150, y: 250 },
  inputValue: "Platform Team",
};

mock.module("@/src/features/kanban/store/kanban-store", () => ({
  useKanbanStore: (
    selector: (state: {
      areaDialogs: Record<string, typeof mockAreaDialog | null>;
      areas: { byId: Record<string, typeof mockArea | null>; allIds: string[] };
      areaPositions: { byId: Record<string, unknown>; allIds: string[] };
      boards: { byId: Record<string, unknown>; allIds: string[] };
      columns: { byId: Record<string, unknown>; allIds: string[] };
      tasks: { byId: Record<string, unknown>; allIds: string[] };
      boardPositions: { byId: Record<string, unknown>; allIds: string[] };
      columnUi: Record<string, unknown>;
      selectedTaskIds: string[];
      selectedBoardIds: string[];
      dialogFocusStack: string[];
      updateArea: typeof mockUpdateArea;
      closeAreaDialog: typeof mockCloseAreaDialog;
      registerDialog: typeof mockRegisterDialog;
      unregisterDialog: typeof mockUnregisterDialog;
      bringDialogToFront: typeof mockBringDialogToFront;
    }) => unknown
  ) => {
    const state = {
      areaDialogs: {
        "dlg-1": mockAreaDialog,
      },
      areas: {
        byId: { "area-1": mockArea },
        allIds: ["area-1"],
      },
      areaPositions: { byId: {}, allIds: [] },
      boards: {
        byId: { "board-1": { id: "board-1", name: "Board 1", column_ids: [] } },
        allIds: ["board-1"],
      },
      columns: { byId: {}, allIds: [] },
      tasks: { byId: {}, allIds: [] },
      boardPositions: { byId: {}, allIds: [] },
      columnUi: {},
      selectedTaskIds: [],
      selectedBoardIds: [],
      dialogFocusStack: ["area-properties-dialog-dlg-1"],
      updateArea: mockUpdateArea,
      closeAreaDialog: mockCloseAreaDialog,
      registerDialog: mockRegisterDialog,
      unregisterDialog: mockUnregisterDialog,
      bringDialogToFront: mockBringDialogToFront,
    };
    return selector(state);
  },
}));

import { AreaPropertiesDialogNodeComponent } from "./area-properties-dialog-node";

function createMockDialogProps(
  overrides: Partial<
    Parameters<typeof AreaPropertiesDialogNodeComponent>[0]
  > = {}
) {
  return {
    id: "area-dialog-dlg-1",
    data: { dialogId: "dlg-1" },
    selected: false,
    type: "areaPropertiesDialog",
    zIndex: 1000,
    isConnectable: false,
    positionAbsoluteX: 150,
    positionAbsoluteY: 250,
    dragging: false,
    draggable: true,
    selectable: true,
    deletable: true,
    ...overrides,
  };
}

describe("AreaPropertiesDialogNodeComponent", () => {
  beforeEach(() => {
    mockUpdateArea.mockClear();
    mockCloseAreaDialog.mockClear();
    mockRegisterDialog.mockClear();
    mockUnregisterDialog.mockClear();
    mockBringDialogToFront.mockClear();
    capturedConnectorOptions = {};
  });

  it("renders dialog with header, color picker, swatches, and icons", () => {
    const { container } = render(
      React.createElement(
        AreaPropertiesDialogNodeComponent,
        createMockDialogProps()
      )
    );

    expect(
      container.querySelector('[id="area-dialog-title"]')?.textContent
    ).toBe("Area Properties");
    expect(
      container.querySelector('[data-testid="hex-color-picker"]')
    ).not.toBeNull();
    expect(mockRegisterDialog).toHaveBeenCalledWith(
      "area-properties-dialog-dlg-1"
    );
  });

  it("wires useImperativeConnector to area drag handle and dialog node", () => {
    render(
      React.createElement(
        AreaPropertiesDialogNodeComponent,
        createMockDialogProps()
      )
    );

    expect(capturedConnectorOptions.sourceSelector).toBe(
      '.react-flow__node[data-id="area-1"] .area-drag-handle'
    );
    expect(capturedConnectorOptions.targetNodeId).toBe("area-dialog-dlg-1");
    expect(capturedConnectorOptions.customColor).toBe("#6366f1");
  });

  it("calls updateArea when a color swatch is clicked", () => {
    const { container } = render(
      React.createElement(
        AreaPropertiesDialogNodeComponent,
        createMockDialogProps()
      )
    );

    const swatch = container.querySelector(
      'button[aria-label="Select Rose"]'
    ) as HTMLButtonElement;
    expect(swatch).not.toBeNull();

    act(() => {
      fireEvent.click(swatch);
    });

    expect(mockUpdateArea).toHaveBeenCalledWith("area-1", {
      color: "#f43f5e",
    });
  });

  it("calls closeAreaDialog when close button is clicked", () => {
    const { container } = render(
      React.createElement(
        AreaPropertiesDialogNodeComponent,
        createMockDialogProps()
      )
    );

    const closeBtn = container.querySelector(
      'button[aria-label="Close area properties dialog"]'
    ) as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(mockCloseAreaDialog).toHaveBeenCalledWith("dlg-1");
  });

  it("calls closeAreaDialog on Escape key", () => {
    render(
      React.createElement(
        AreaPropertiesDialogNodeComponent,
        createMockDialogProps()
      )
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(mockCloseAreaDialog).toHaveBeenCalledWith("dlg-1");
  });
});
