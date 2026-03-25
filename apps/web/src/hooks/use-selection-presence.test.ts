import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";

const createMockAwareness = () => ({
  setLocalStateField: mock(() => undefined) as any,
  getLocalState: mock(() => null) as any,
});

const mockCollaborators = [
  {
    id: "user-1",
    name: "User 1",
    color: "#ff0000",
    role: "editor" as const,
    selectionBox: { x: 10, y: 20, width: 100, height: 50 },
  },
] as any;

const mockUseCollaboration = mock(() => ({
  isCollaborating: false,
  awareness: null,
  collaborators: [],
})) as any;

mock.module("@/src/features/collab", () => ({
  useCollaboration: mockUseCollaboration,
}));

describe("use-selection-presence", () => {
  it("reflects current board selection state", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: mockCollaborators,
    }));

    const { useSelectionPresence } = await import(
      "@/src/hooks/use-selection-presence"
    );
    const { result } = renderHook(() => useSelectionPresence());

    act(() => {
      result.current.setSelectionBox({ x: 5, y: 10, width: 200, height: 100 });
    });

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "selectionBox",
      { x: 5, y: 10, width: 200, height: 100 }
    );
  });

  it("reflects task selection state from collaborators", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [
        {
          id: "user-2",
          name: "User 2",
          color: "#00ff00",
          role: "owner" as const,
          selection: ["task-1", "task-2"],
        },
      ],
    }));

    const { useSelectionPresence } = await import(
      "@/src/hooks/use-selection-presence"
    );
    const { result } = renderHook(() => useSelectionPresence());

    act(() => {
      result.current.setSelectionBox({ x: 0, y: 0, width: 50, height: 30 });
    });

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "selectionBox",
      { x: 0, y: 0, width: 50, height: 30 }
    );
  });

  it("cleanup clears shared selection presence", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [],
    }));

    const { useSelectionPresence } = await import(
      "@/src/hooks/use-selection-presence"
    );
    const { result, unmount } = renderHook(() => useSelectionPresence());

    act(() => {
      result.current.setSelectionBox({ x: 10, y: 20, width: 100, height: 50 });
    });

    unmount();

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "selectionBox",
      null
    );
  });

  it("does not update when not collaborating", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: false,
      awareness: mockAwareness,
      collaborators: [],
    }));

    const { useSelectionPresence } = await import(
      "@/src/hooks/use-selection-presence"
    );
    const { result } = renderHook(() => useSelectionPresence());

    act(() => {
      result.current.setSelectionBox({ x: 10, y: 20, width: 100, height: 50 });
    });

    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled();
  });

  it("returns collaborators for external observation", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: mockCollaborators,
    }));

    const { useSelectionPresence } = await import(
      "@/src/hooks/use-selection-presence"
    );
    const { result } = renderHook(() => useSelectionPresence());

    expect(result.current.collaborators).toEqual(mockCollaborators);
  });
});
