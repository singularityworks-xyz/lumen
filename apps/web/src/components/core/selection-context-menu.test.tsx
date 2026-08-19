// Must be first - register happy-dom before any imports
import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  // Already registered, ignore
}

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  writable: true,
  configurable: true,
});

mock.module("lucide-react", () => ({
  Grid3X3: () => React.createElement("span", { "data-icon": "Grid3X3" }),
  Layers: () => React.createElement("span", { "data-icon": "Layers" }),
  X: () => React.createElement("span", { "data-icon": "X" }),
}));

const mockAddArea = mock();

mock.module("@/src/features/kanban", () => ({
  useKanbanStore: (
    selector: (state: { addArea: typeof mockAddArea }) => unknown
  ) =>
    selector({
      addArea: mockAddArea,
    }),
}));

import { SelectionContextMenu } from "./selection-context-menu";

describe("SelectionContextMenu", () => {
  const defaultProps = {
    x: 100,
    y: 100,
    width: 400,
    height: 300,
    screenX: 250,
    screenY: 250,
    onClose: mock(),
  };

  beforeEach(() => {
    document.body.innerHTML = "";
    mockAddArea.mockClear();
    defaultProps.onClose.mockClear();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("renders the selection context menu with Create Area option", () => {
    const { getByTestId, getAllByText } = render(
      <SelectionContextMenu {...defaultProps} />
    );

    expect(getByTestId("create-area-button")).toBeTruthy();
    expect(getAllByText("Create Area").length).toBeGreaterThanOrEqual(1);
  });

  it("opens 3D engraved Create Area dialog when Create Area button is clicked", () => {
    const { getByTestId, getAllByText } = render(
      <SelectionContextMenu {...defaultProps} />
    );

    const createAreaButton = getByTestId("create-area-button");
    act(() => {
      fireEvent.click(createAreaButton);
    });

    const input = getByTestId("area-name-input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("New Area");
    expect(getAllByText("Create Area").length).toBeGreaterThanOrEqual(2);
    expect(getByTestId("area-create-submit")).toBeTruthy();
  });

  it("submits the form and calls addArea with typed name and coordinates", () => {
    const { getByTestId } = render(<SelectionContextMenu {...defaultProps} />);

    act(() => {
      fireEvent.click(getByTestId("create-area-button"));
    });

    const input = document.body.querySelector(
      '[data-testid="area-name-input"]'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();

    input.value = "Frontend Team";
    act(() => {
      fireEvent.change(input, { target: { value: "Frontend Team" } });
    });

    const submitButton = document.body.querySelector(
      '[data-testid="area-create-submit"]'
    ) as HTMLButtonElement;
    expect(submitButton).not.toBeNull();

    act(() => {
      fireEvent.click(submitButton);
    });

    expect(mockAddArea).toHaveBeenCalledWith(
      "Frontend Team",
      { x: 100, y: 100 },
      { width: 400, height: 300 }
    );
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("closes the dialog on Cancel click", () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <SelectionContextMenu {...defaultProps} />
    );

    act(() => {
      fireEvent.click(getByTestId("create-area-button"));
    });

    expect(getByTestId("area-name-input")).toBeTruthy();

    const cancelButton = getByText("Cancel");
    act(() => {
      fireEvent.click(cancelButton);
    });

    expect(queryByTestId("area-name-input")).toBeNull();
  });

  it("closes the dialog on Escape key in the input", () => {
    const { getByTestId, queryByTestId } = render(
      <SelectionContextMenu {...defaultProps} />
    );

    act(() => {
      fireEvent.click(getByTestId("create-area-button"));
    });

    const input = getByTestId("area-name-input");
    act(() => {
      fireEvent.keyDown(input, { key: "Escape" });
    });

    expect(queryByTestId("area-name-input")).toBeNull();
  });
});
