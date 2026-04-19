import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  /* ignore */
}

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";
import type { Collaborator } from "@/src/features/collab";

let timeCounter = 1_000_000;
Date.now = () => ++timeCounter;

const mockAwareness = {
  setLocalStateField: mock(() => undefined),
  getLocalState: mock(() => null as any),
};

const mockCollaborators: Collaborator[] = [
  {
    id: "user-1",
    name: "User 1",
    color: "#ff0000",
    role: "editor" as const,
    draggingColumn: {
      columnId: "col-1",
      sourceBoardId: "board-1",
      cursorX: 100,
      cursorY: 200,
    },
  },
];

const collabState = {
  isCollaborating: false as boolean,
  awareness: null as any,
  collaborators: [] as any[],
  localUser: null as any,
};

mock.module("@/src/features/collab", () => ({
  useCollaboration: () => collabState,
}));

beforeEach(() => {
  mockAwareness.setLocalStateField.mockClear();
  mockAwareness.getLocalState.mockClear();
  mockAwareness.getLocalState.mockImplementation(() => null);
  collabState.isCollaborating = false;
  collabState.awareness = null;
  collabState.collaborators = [];
  collabState.localUser = null;
  timeCounter = 1_000_000;
  Date.now = () => ++timeCounter;
});

describe("use-column-drag-presence", () => {
  it("publishes column drag metadata to collaborators", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.localUser = {
      id: "local-user",
      name: "Local",
      color: "#fff",
      role: "editor",
    };

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result } = renderHook(() => useColumnDragPresence());

    result.current.startDragging("col-1", "board-1", 150, 250);

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingColumn",
      expect.objectContaining({
        columnId: "col-1",
        sourceBoardId: "board-1",
        cursorX: 150,
        cursorY: 250,
      })
    );
  });

  it("updates cursor position during drag", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.localUser = {
      id: "local-user",
      name: "Local",
      color: "#fff",
      role: "editor",
    };

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result } = renderHook(() => useColumnDragPresence());

    result.current.startDragging("col-1", "board-1", 100, 100);

    mockAwareness.getLocalState.mockImplementation(() => ({
      draggingColumn: {
        columnId: "col-1",
        sourceBoardId: "board-1",
        cursorX: 100,
        cursorY: 100,
      },
    }));

    result.current.updateDragPosition(300, 400);

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingColumn",
      expect.objectContaining({
        cursorX: 300,
        cursorY: 400,
      })
    );
  });

  it("stops dragging and clears state", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.localUser = {
      id: "local-user",
      name: "Local",
      color: "#fff",
      role: "editor",
    };

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result } = renderHook(() => useColumnDragPresence());

    result.current.startDragging("col-1", "board-1", 100, 100);
    result.current.stopDragging();

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingColumn",
      null
    );
  });

  it("cleanup removes lingering drag presence", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.localUser = {
      id: "local-user",
      name: "Local",
      color: "#fff",
      role: "editor",
    };

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result, unmount } = renderHook(() => useColumnDragPresence());

    result.current.startDragging("col-1", "board-1", 100, 100);
    unmount();

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingColumn",
      null
    );
  });

  it("returns dragging collaborators", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.collaborators = mockCollaborators;

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result } = renderHook(() => useColumnDragPresence());

    expect(result.current.draggingCollaborators).toHaveLength(1);
    expect(result.current.draggingCollaborators[0]?.id).toBe("user-1");
  });

  it("returns dragged columns data", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.collaborators = mockCollaborators;

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result } = renderHook(() => useColumnDragPresence());

    expect(result.current.draggedColumns).toHaveLength(1);
    expect(result.current.draggedColumns[0]?.dragState.columnId).toBe("col-1");
    expect(result.current.draggedColumns[0]?.collaborator.id).toBe("user-1");
  });

  it("does nothing when not collaborating", async () => {
    collabState.isCollaborating = false;
    collabState.awareness = mockAwareness;

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result } = renderHook(() => useColumnDragPresence());

    result.current.startDragging("col-1", "board-1", 100, 100);

    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled();
  });
});
