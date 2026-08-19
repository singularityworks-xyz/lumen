// Must be first - register happy-dom before any imports
import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  // Already registered, ignore
}

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";

let mockStoreState: {
  currentWorkspaceId: string | null;
  boards: {
    byId: Record<string, { id: string; name: string }>;
    allIds: string[];
  };
  workspaces: {
    byId: Record<string, { id: string; board_ids: string[] }>;
    allIds: string[];
  };
  boardConnections: {
    byId: Record<
      string,
      {
        id: string;
        source_board_id: string;
        target_board_id: string;
        sourceHandle?: string;
        targetHandle?: string;
        label?: string;
        lineStyle?: "solid" | "dotted";
        showArrow?: boolean;
      }
    >;
    allIds: string[];
  };
  textBoards: {
    byId: Record<string, { id: string; name: string }>;
    allIds: string[];
  };
} = {
  currentWorkspaceId: "ws-1",
  boards: {
    byId: {
      "board-1": { id: "board-1", name: "Board 1" },
      "board-2": { id: "board-2", name: "Board 2" },
    },
    allIds: ["board-1", "board-2"],
  },
  workspaces: {
    byId: {
      "ws-1": { id: "ws-1", board_ids: ["board-1", "board-2"] },
    },
    allIds: ["ws-1"],
  },
  boardConnections: {
    byId: {
      "conn-1": {
        id: "conn-1",
        source_board_id: "board-1",
        target_board_id: "board-2",
        sourceHandle: "bottom",
        targetHandle: "top",
        showArrow: true,
      },
    },
    allIds: ["conn-1"],
  },
  textBoards: {
    byId: {},
    allIds: [],
  },
};

mock.module("@/src/features/kanban/store/kanban-store", () => ({
  useKanbanStore: (selector: (state: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}));

import { useCanvasEdges } from "./canvas-edges";

describe("useCanvasEdges", () => {
  beforeEach(() => {
    mockStoreState = {
      currentWorkspaceId: "ws-1",
      boards: {
        byId: {
          "board-1": { id: "board-1", name: "Board 1" },
          "board-2": { id: "board-2", name: "Board 2" },
        },
        allIds: ["board-1", "board-2"],
      },
      workspaces: {
        byId: {
          "ws-1": { id: "ws-1", board_ids: ["board-1", "board-2"] },
        },
        allIds: ["ws-1"],
      },
      boardConnections: {
        byId: {
          "conn-1": {
            id: "conn-1",
            source_board_id: "board-1",
            target_board_id: "board-2",
            sourceHandle: "bottom",
            targetHandle: "top",
            showArrow: true,
          },
        },
        allIds: ["conn-1"],
      },
      textBoards: {
        byId: {},
        allIds: [],
      },
    };
  });

  it("creates an edge with sourceHandle and targetHandle matching node handles", () => {
    const { result } = renderHook(() => useCanvasEdges());

    expect(result.current).toHaveLength(1);
    const edge = result.current[0];
    expect(edge).toBeDefined();
    if (!edge) {
      return;
    }
    expect(edge.id).toBe("conn-1");
    expect(edge.source).toBe("board-1");
    expect(edge.target).toBe("board-2");
    expect(edge.sourceHandle).toBe("bottom");
    expect(edge.targetHandle).toBe("top-target");
  });

  it("handles fallback and existing suffixes cleanly", () => {
    mockStoreState.boardConnections = {
      byId: {
        "conn-2": {
          id: "conn-2",
          source_board_id: "board-1",
          target_board_id: "board-2",
          sourceHandle: "right-source",
          targetHandle: "left-target",
        },
      },
      allIds: ["conn-2"],
    };

    const { result } = renderHook(() => useCanvasEdges());

    expect(result.current).toHaveLength(1);
    const edge = result.current[0];
    expect(edge).toBeDefined();
    if (!edge) {
      return;
    }
    expect(edge.sourceHandle).toBe("right");
    expect(edge.targetHandle).toBe("left-target");
  });

  it("omits edges when one of the boards is not visible in current workspace", () => {
    mockStoreState.workspaces.byId["ws-1"] = {
      id: "ws-1",
      board_ids: ["board-1"],
    };

    const { result } = renderHook(() => useCanvasEdges());
    expect(result.current).toHaveLength(0);
  });
});
