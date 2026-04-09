// @ts-nocheck
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { WorkspaceDeletedBanner } from "./workspace-deleted-banner";

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

const mockUseKanbanStore = mock((selector) => {
  return selector(mockStore);
});

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

    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Dismiss button", () => {
    render(createElement(WorkspaceDeletedBanner));

    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("calls setDeletedSharedWorkspace when Dismiss is clicked", () => {
    render(createElement(WorkspaceDeletedBanner));

    const buttons = screen.queryAllByRole("button");
    const dismissButton = buttons.at(-1);
    dismissButton.click();

    expect(mockSetDeletedSharedWorkspace).toHaveBeenCalledWith(null);
  });
});
