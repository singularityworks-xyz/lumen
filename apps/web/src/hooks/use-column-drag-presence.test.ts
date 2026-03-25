import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { Collaborator, DraggingColumnState } from "@/src/features/collab";

interface MockAwareness {
  getLocalState: ReturnType<
    typeof mock<() => { draggingColumn?: DraggingColumnState } | null>
  >;
  setLocalStateField: ReturnType<typeof mock<() => undefined>>;
}

const createMockAwareness = (): MockAwareness => ({
  setLocalStateField: mock<() => undefined>(() => undefined),
  getLocalState: mock<() => { draggingColumn?: DraggingColumnState } | null>(
    () => null
  ),
});

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

interface MockCollaborationReturn {
  awareness: MockAwareness | null;
  collaborators: Collaborator[];
  isCollaborating: boolean;
  localUser: {
    id: string;
    name: string;
    color: string;
    role: "owner" | "editor" | "viewer";
  } | null;
}

const mockUseCollaboration = mock<() => MockCollaborationReturn>(() => ({
  isCollaborating: false,
  awareness: null,
  collaborators: [],
  localUser: null,
}));

mock.module("@/src/features/collab", () => ({
  useCollaboration: mockUseCollaboration,
}));

describe("use-column-drag-presence", () => {
  it("publishes column drag metadata to collaborators", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
    }));

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result } = renderHook(() => useColumnDragPresence());

    act(() => {
      result.current.startDragging("col-1", "board-1", 150, 250);
    });

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
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
    }));

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result } = renderHook(() => useColumnDragPresence());

    act(() => {
      result.current.startDragging("col-1", "board-1", 100, 100);
    });

    mockAwareness.getLocalState.mockImplementation(() => ({
      draggingColumn: {
        columnId: "col-1",
        sourceBoardId: "board-1",
        cursorX: 100,
        cursorY: 100,
      },
    }));

    act(() => {
      result.current.updateDragPosition(300, 400);
    });

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingColumn",
      expect.objectContaining({
        cursorX: 300,
        cursorY: 400,
      })
    );
  });

  it("stops dragging and clears state", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
    }));

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result } = renderHook(() => useColumnDragPresence());

    act(() => {
      result.current.startDragging("col-1", "board-1", 100, 100);
    });

    act(() => {
      result.current.stopDragging();
    });

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingColumn",
      null
    );
  });

  it("cleanup removes lingering drag presence", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
    }));

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result, unmount } = renderHook(() => useColumnDragPresence());

    act(() => {
      result.current.startDragging("col-1", "board-1", 100, 100);
    });

    unmount();

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingColumn",
      null
    );
  });

  it("returns dragging collaborators", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: mockCollaborators,
      localUser: null,
    }));

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result } = renderHook(() => useColumnDragPresence());

    expect(result.current.draggingCollaborators).toHaveLength(1);
    expect(result.current.draggingCollaborators[0]!.id).toBe("user-1");
  });

  it("returns dragged columns data", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: mockCollaborators,
      localUser: null,
    }));

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result } = renderHook(() => useColumnDragPresence());

    expect(result.current.draggedColumns).toHaveLength(1);
    expect(result.current.draggedColumns[0]!.dragState.columnId).toBe("col-1");
    expect(result.current.draggedColumns[0]!.collaborator.id).toBe("user-1");
  });

  it("does nothing when not collaborating", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: false,
      awareness: mockAwareness,
      collaborators: [],
      localUser: null,
    }));

    const { useColumnDragPresence } = await import(
      "@/src/hooks/use-column-drag-presence"
    );
    const { result } = renderHook(() => useColumnDragPresence());

    act(() => {
      result.current.startDragging("col-1", "board-1", 100, 100);
    });

    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled();
  });
});
