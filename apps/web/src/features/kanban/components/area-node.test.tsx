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

let capturedResizerProps: Record<string, unknown> = {};

mock.module("@xyflow/react", () => ({
  NodeResizer: (props: Record<string, unknown>) => {
    capturedResizerProps = props;
    return props.isVisible
      ? React.createElement("div", { "data-testid": "mock-node-resizer" })
      : null;
  },
}));

mock.module("lucide-react", () => ({
  Edit2: () => React.createElement("span", { "data-icon": "Edit2" }),
  GripVertical: () =>
    React.createElement("span", { "data-icon": "GripVertical" }),
  Layout: () => React.createElement("span", { "data-icon": "Layout" }),
  Palette: () => React.createElement("span", { "data-icon": "Palette" }),
  Trash2: () => React.createElement("span", { "data-icon": "Trash2" }),
}));

const mockUpdateArea = mock();
const mockRemoveArea = mock();
const mockOpenAreaDialog = mock();
const mockUpdateAreaPosition = mock();
const mockUpdateAreaDimensions = mock();

const mockArea = {
  id: "area-1",
  name: "Backend Services",
  workspace_id: "ws-1",
  color: "#6366f1",
  board_ids: ["board-1", "board-2"],
  created_at: new Date().toISOString(),
};

const mockAreaPosition = {
  id: "area-1",
  x: 100,
  y: 200,
  width: 500,
  height: 400,
  zIndex: 0,
};

mock.module("../store/kanban-store", () => ({
  useKanbanStore: (
    selector: (state: {
      areas: { byId: Record<string, typeof mockArea | null>; allIds: string[] };
      areaPositions: {
        byId: Record<string, typeof mockAreaPosition | null>;
        allIds: string[];
      };
      updateArea: typeof mockUpdateArea;
      removeArea: typeof mockRemoveArea;
      openAreaDialog: typeof mockOpenAreaDialog;
      updateAreaPosition: typeof mockUpdateAreaPosition;
      updateAreaDimensions: typeof mockUpdateAreaDimensions;
    }) => unknown
  ) => {
    const state = {
      areas: {
        byId: { "area-1": mockArea },
        allIds: ["area-1"],
      },
      areaPositions: {
        byId: { "area-1": mockAreaPosition },
        allIds: ["area-1"],
      },
      updateArea: mockUpdateArea,
      removeArea: mockRemoveArea,
      openAreaDialog: mockOpenAreaDialog,
      updateAreaPosition: mockUpdateAreaPosition,
      updateAreaDimensions: mockUpdateAreaDimensions,
    };
    return selector(state);
  },
}));

import { AreaNodeComponent } from "./area-node";

function createMockAreaProps(
  overrides: Partial<Parameters<typeof AreaNodeComponent>[0]> = {}
) {
  return {
    id: "area-1",
    data: { areaId: "area-1" },
    selected: false,
    type: "area",
    zIndex: 0,
    isConnectable: false,
    positionAbsoluteX: 100,
    positionAbsoluteY: 200,
    dragging: false,
    draggable: true,
    selectable: true,
    deletable: true,
    dragHandle: ".area-drag-handle",
    ...overrides,
  };
}

describe("AreaNodeComponent", () => {
  beforeEach(() => {
    mockUpdateArea.mockClear();
    mockRemoveArea.mockClear();
    mockOpenAreaDialog.mockClear();
    mockUpdateAreaPosition.mockClear();
    mockUpdateAreaDimensions.mockClear();
    capturedResizerProps = {};
  });

  it("renders area name, board count, and action buttons", () => {
    const { container } = render(
      React.createElement(AreaNodeComponent, createMockAreaProps())
    );

    expect(container.querySelector('[data-testid="area-node"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="area-header"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="area-name"]')?.textContent
    ).toBe("Backend Services");
    expect(
      container.querySelector('[data-testid="area-board-count"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="area-rename-btn"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="area-customize-btn"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="area-delete-btn"]')
    ).not.toBeNull();
  });

  it("handles resize events and updates dimensions in store", () => {
    render(
      React.createElement(
        AreaNodeComponent,
        createMockAreaProps({ selected: true })
      )
    );

    expect(capturedResizerProps.isVisible).toBe(true);

    const onResizeEnd = capturedResizerProps.onResizeEnd as (
      event: unknown,
      params: { x: number; y: number; width: number; height: number }
    ) => void;
    expect(onResizeEnd).toBeDefined();

    act(() => {
      onResizeEnd(null, { x: 120, y: 220, width: 600, height: 450 });
    });

    expect(mockUpdateAreaDimensions).toHaveBeenCalledWith("area-1", {
      width: 600,
      height: 450,
    });
    expect(mockUpdateAreaPosition).toHaveBeenCalledWith("area-1", {
      x: 120,
      y: 220,
    });
  });

  it("calls removeArea when delete button is clicked", () => {
    const { container } = render(
      React.createElement(AreaNodeComponent, createMockAreaProps())
    );

    const deleteBtn = container.querySelector(
      '[data-testid="area-delete-btn"]'
    ) as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();

    act(() => {
      fireEvent.click(deleteBtn);
    });

    expect(mockRemoveArea).toHaveBeenCalledWith("area-1");
  });

  it("calls openAreaDialog when customize button is clicked", () => {
    const { container } = render(
      React.createElement(AreaNodeComponent, createMockAreaProps())
    );

    const customizeBtn = container.querySelector(
      '[data-testid="area-customize-btn"]'
    ) as HTMLButtonElement;
    expect(customizeBtn).not.toBeNull();

    act(() => {
      fireEvent.click(customizeBtn);
    });

    expect(mockOpenAreaDialog).toHaveBeenCalledWith({
      areaId: "area-1",
      areaName: "Backend Services",
      position: { x: 120, y: 240 },
    });
  });

  it("allows renaming through the rename button and submitting input", () => {
    const { container } = render(
      React.createElement(AreaNodeComponent, createMockAreaProps())
    );

    const renameBtn = container.querySelector(
      '[data-testid="area-rename-btn"]'
    ) as HTMLButtonElement;
    expect(renameBtn).not.toBeNull();

    act(() => {
      fireEvent.click(renameBtn);
    });

    const input = container.querySelector(
      '[data-testid="area-name-input"]'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();

    act(() => {
      fireEvent.change(input, { target: { value: "Frontend Services" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mockUpdateArea).toHaveBeenCalledWith("area-1", {
      name: "Frontend Services",
    });
  });

  it("allows renaming by double clicking the name", () => {
    const { container } = render(
      React.createElement(AreaNodeComponent, createMockAreaProps())
    );

    const nameSpan = container.querySelector(
      '[data-testid="area-name"]'
    ) as HTMLElement;
    expect(nameSpan).not.toBeNull();

    act(() => {
      fireEvent.doubleClick(nameSpan);
    });

    const input = container.querySelector(
      '[data-testid="area-name-input"]'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
  });
});
