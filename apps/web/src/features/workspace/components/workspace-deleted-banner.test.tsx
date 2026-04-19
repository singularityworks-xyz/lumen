import { beforeEach, describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { WorkspaceDeletedBanner } from "./workspace-deleted-banner";

const SAVE_BUTTON_REGEX = /save as local workspace/i;
const DISMISS_BUTTON_REGEX = /dismiss/i;

const mockSetDeletedSharedWorkspace = mock(() => undefined);

const mockStore = {
  deletedSharedWorkspaceId: "deleted-ws-1",
  workspaces: {
    byId: {
      "deleted-ws-1": {
        id: "deleted-ws-1",
        name: "Deleted Workspace",
      },
    },
    allIds: ["deleted-ws-1"],
  },
  duplicateWorkspace: mock(() => "new-ws-id"),
  deleteWorkspace: mock(() => Promise.resolve()),
  setCurrentWorkspace: mock(() => undefined),
  setDeletedSharedWorkspace: mockSetDeletedSharedWorkspace,
};

const mockUseKanbanStore = mock((selector) => selector(mockStore));

mock.module("@/src/features/kanban/store/kanban-store", () => ({
  useKanbanStore: mockUseKanbanStore,
}));

mock.module("@lumen/logger", () => ({
  logger: {
    error: mock(() => undefined),
  },
}));

mock.module("sonner", () => ({
  toast: {
    success: mock(() => undefined),
    error: mock(() => undefined),
  },
}));

describe("WorkspaceDeletedBanner", () => {
  beforeEach(() => {
    mockSetDeletedSharedWorkspace.mockClear();
  });

  it("renders banner with workspace name", () => {
    render(createElement(WorkspaceDeletedBanner));

    expect(screen.queryByText("Workspace Deleted by Owner")).not.toBeNull();
  });

  it("renders Save as Local Workspace button", () => {
    render(createElement(WorkspaceDeletedBanner));

    expect(
      screen.getByRole("button", { name: SAVE_BUTTON_REGEX })
    ).toBeDefined();
  });

  it("renders Dismiss button", () => {
    render(createElement(WorkspaceDeletedBanner));

    expect(
      screen.getByRole("button", { name: DISMISS_BUTTON_REGEX })
    ).toBeDefined();
  });

  it("calls setDeletedSharedWorkspace when Dismiss is clicked", () => {
    render(createElement(WorkspaceDeletedBanner));

    const dismissButton = screen.getByRole("button", {
      name: DISMISS_BUTTON_REGEX,
    });
    fireEvent.click(dismissButton);

    expect(mockSetDeletedSharedWorkspace).toHaveBeenCalledWith(null);
  });
});
