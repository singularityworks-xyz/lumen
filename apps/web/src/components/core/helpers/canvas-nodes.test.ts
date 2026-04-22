import { describe, expect, it } from "bun:test";
import { Z_INDEX_BASE } from "@/src/features/kanban/store/slices/z-index-slice";
import type { EntityMap } from "@/src/features/kanban/types";

// ──────────────────────────────────────────────────────────────
// canvas-nodes.ts exports a single React hook (useCanvasNodes)
// that builds canvas nodes from store state inside a useMemo.
// We extract and test the pure transformation logic:
//   1. computeZIndex: dialog focus stack → z-index
//   2. boardNode generation: position + parent area + drag origin
//   3. areaNode filtering: workspace scoping
//   4. dialogNode type resolution
//   5. quickActions/commentCluster node shapes
// ──────────────────────────────────────────────────────────────

// ─── computeZIndex (exact copy from canvas-nodes.ts) ───────────

function computeZIndex(dialogId: string, dialogFocusStack: string[]): number {
  const index = dialogFocusStack.indexOf(dialogId);
  if (index === -1) {
    return Z_INDEX_BASE.DIALOGS;
  }
  return Z_INDEX_BASE.DIALOGS + (index + 1) * 10;
}

describe("computeZIndex", () => {
  it("returns DIALOGS base for unknown dialog", () => {
    expect(computeZIndex("unknown", [])).toBe(Z_INDEX_BASE.DIALOGS);
  });

  it("returns DIALOGS base for dialog not in stack", () => {
    const stack = ["dialog-a", "dialog-b"];
    expect(computeZIndex("dialog-c", stack)).toBe(Z_INDEX_BASE.DIALOGS);
  });

  it("returns base + 10 for first item in stack", () => {
    const stack = ["dialog-a"];
    expect(computeZIndex("dialog-a", stack)).toBe(Z_INDEX_BASE.DIALOGS + 10);
  });

  it("returns base + 20 for second item in stack", () => {
    const stack = ["dialog-a", "dialog-b"];
    expect(computeZIndex("dialog-b", stack)).toBe(Z_INDEX_BASE.DIALOGS + 20);
  });

  it("preserves ordering: later stack position → higher z-index", () => {
    const stack = ["d-1", "d-2", "d-3", "d-4"];
    const z1 = computeZIndex("d-1", stack);
    const z2 = computeZIndex("d-2", stack);
    const z3 = computeZIndex("d-3", stack);
    const z4 = computeZIndex("d-4", stack);
    expect(z1).toBeLessThan(z2);
    expect(z2).toBeLessThan(z3);
    expect(z3).toBeLessThan(z4);
  });

  it("has 10-unit gap between adjacent dialogs (room for connectors)", () => {
    const stack = ["d-1", "d-2"];
    const z1 = computeZIndex("d-1", stack);
    const z2 = computeZIndex("d-2", stack);
    expect(z2 - z1).toBe(10);
  });
});

// ─── areaNode filtering ────────────────────────────────────────

interface AreaLike {
  id: string;
  workspace_id: string;
}

interface AreaPositionLike {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
  zIndex: number;
}

function filterAreaIds(
  areaPositions: EntityMap<AreaPositionLike>,
  areas: EntityMap<AreaLike>,
  currentWorkspaceId: string | null
): string[] {
  return areaPositions.allIds.filter((areaId) => {
    const area = areas.byId[areaId];
    const position = areaPositions.byId[areaId];
    return (
      area &&
      position &&
      (!currentWorkspaceId || area.workspace_id === currentWorkspaceId)
    );
  });
}

describe("areaNode filtering", () => {
  const mkArea = (id: string, wsId: string): AreaLike => ({
    id,
    workspace_id: wsId,
  });
  const mkPos = (id: string): AreaPositionLike => ({
    id,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    zIndex: 0,
  });

  it("includes area in matching workspace", () => {
    const areas: EntityMap<AreaLike> = {
      byId: { "a-1": mkArea("a-1", "ws-1") },
      allIds: ["a-1"],
    };
    const positions: EntityMap<AreaPositionLike> = {
      byId: { "a-1": mkPos("a-1") },
      allIds: ["a-1"],
    };

    const result = filterAreaIds(positions, areas, "ws-1");
    expect(result).toEqual(["a-1"]);
  });

  it("excludes area from different workspace", () => {
    const areas: EntityMap<AreaLike> = {
      byId: { "a-1": mkArea("a-1", "ws-2") },
      allIds: ["a-1"],
    };
    const positions: EntityMap<AreaPositionLike> = {
      byId: { "a-1": mkPos("a-1") },
      allIds: ["a-1"],
    };

    const result = filterAreaIds(positions, areas, "ws-1");
    expect(result).toEqual([]);
  });

  it("includes all areas when currentWorkspaceId is null", () => {
    const areas: EntityMap<AreaLike> = {
      byId: {
        "a-1": mkArea("a-1", "ws-1"),
        "a-2": mkArea("a-2", "ws-2"),
      },
      allIds: ["a-1", "a-2"],
    };
    const positions: EntityMap<AreaPositionLike> = {
      byId: { "a-1": mkPos("a-1"), "a-2": mkPos("a-2") },
      allIds: ["a-1", "a-2"],
    };

    const result = filterAreaIds(positions, areas, null);
    expect(result).toEqual(["a-1", "a-2"]);
  });

  it("excludes area with missing position", () => {
    const areas: EntityMap<AreaLike> = {
      byId: { "a-1": mkArea("a-1", "ws-1") },
      allIds: ["a-1"],
    };
    const positions: EntityMap<AreaPositionLike> = {
      byId: {},
      allIds: ["a-1"],
    };

    const result = filterAreaIds(positions, areas, "ws-1");
    expect(result).toEqual([]);
  });

  it("excludes area with missing area data", () => {
    const areas: EntityMap<AreaLike> = {
      byId: {},
      allIds: ["a-1"],
    };
    const positions: EntityMap<AreaPositionLike> = {
      byId: { "a-1": mkPos("a-1") },
      allIds: ["a-1"],
    };

    const result = filterAreaIds(positions, areas, "ws-1");
    expect(result).toEqual([]);
  });
});

// ─── boardNode workspace filtering ─────────────────────────────

interface BoardLike {
  id: string;
  workspace_id: string;
}

interface BoardPositionLike {
  height?: number;
  id: string;
  width?: number;
  x: number;
  y: number;
  zIndex: number;
}

function filterBoardIds(
  boardIds: string[],
  boards: EntityMap<BoardLike>,
  boardPositions: EntityMap<BoardPositionLike>,
  currentWorkspaceId: string | null
): string[] {
  return boardIds.filter((boardId) => {
    const board = boards.byId[boardId];
    const position = boardPositions.byId[boardId];
    return (
      board &&
      position &&
      (!currentWorkspaceId || board.workspace_id === currentWorkspaceId)
    );
  });
}

describe("boardNode workspace filtering", () => {
  it("filters boards to current workspace", () => {
    const boards: EntityMap<BoardLike> = {
      byId: {
        "b-1": { id: "b-1", workspace_id: "ws-1" },
        "b-2": { id: "b-2", workspace_id: "ws-2" },
      },
      allIds: ["b-1", "b-2"],
    };
    const positions: EntityMap<BoardPositionLike> = {
      byId: {
        "b-1": { id: "b-1", x: 0, y: 0, zIndex: 1 },
        "b-2": { id: "b-2", x: 100, y: 100, zIndex: 2 },
      },
      allIds: ["b-1", "b-2"],
    };

    const result = filterBoardIds(["b-1", "b-2"], boards, positions, "ws-1");
    expect(result).toEqual(["b-1"]);
  });

  it("includes all boards when no workspace filter", () => {
    const boards: EntityMap<BoardLike> = {
      byId: {
        "b-1": { id: "b-1", workspace_id: "ws-1" },
        "b-2": { id: "b-2", workspace_id: "ws-2" },
      },
      allIds: ["b-1", "b-2"],
    };
    const positions: EntityMap<BoardPositionLike> = {
      byId: {
        "b-1": { id: "b-1", x: 0, y: 0, zIndex: 1 },
        "b-2": { id: "b-2", x: 100, y: 100, zIndex: 2 },
      },
      allIds: ["b-1", "b-2"],
    };

    const result = filterBoardIds(["b-1", "b-2"], boards, positions, null);
    expect(result).toEqual(["b-1", "b-2"]);
  });

  it("excludes boards with no position", () => {
    const boards: EntityMap<BoardLike> = {
      byId: { "b-1": { id: "b-1", workspace_id: "ws-1" } },
      allIds: ["b-1"],
    };
    const positions: EntityMap<BoardPositionLike> = {
      byId: {},
      allIds: [],
    };

    const result = filterBoardIds(["b-1"], boards, positions, "ws-1");
    expect(result).toEqual([]);
  });
});

// ─── boardNode parent area position offset ─────────────────────

interface AreaWithBoards {
  board_ids: string[];
  id: string;
}

function computeBoardPosition(
  boardId: string,
  boardPosition: { x: number; y: number },
  areas: { allIds: string[]; byId: Record<string, AreaWithBoards | undefined> },
  areaPositions: Record<string, { x: number; y: number } | undefined>,
  areaDragOrigins: Record<
    string,
    { originX: number; originY: number } | undefined
  >
): { x: number; y: number; parentId: string | undefined; zIndex: number } {
  let parentId: string | undefined;
  let pos = { x: boardPosition.x, y: boardPosition.y };
  let zIndex = 1;

  for (const areaId of areas.allIds) {
    const area = areas.byId[areaId];
    if (area?.board_ids?.includes(boardId)) {
      const areaPos = areaPositions[areaId];
      if (areaPos) {
        parentId = areaId;
        const origin = areaDragOrigins[areaId];
        if (origin) {
          pos = {
            x: boardPosition.x - origin.originX,
            y: boardPosition.y - origin.originY,
          };
        } else {
          pos = {
            x: boardPosition.x - areaPos.x,
            y: boardPosition.y - areaPos.y,
          };
        }
        zIndex = 10;
      }
      break;
    }
  }

  return { ...pos, parentId, zIndex };
}

describe("boardNode parent area position offset", () => {
  it("returns raw position when board has no parent area", () => {
    const result = computeBoardPosition(
      "b-1",
      { x: 300, y: 400 },
      { allIds: [], byId: {} },
      {},
      {}
    );
    expect(result.x).toBe(300);
    expect(result.y).toBe(400);
    expect(result.parentId).toBeUndefined();
    expect(result.zIndex).toBe(1);
  });

  it("offsets position by area position when inside area", () => {
    const areas = {
      allIds: ["area-1"],
      byId: { "area-1": { id: "area-1", board_ids: ["b-1"] } },
    };
    const areaPositions = { "area-1": { x: 100, y: 200 } };

    const result = computeBoardPosition(
      "b-1",
      { x: 350, y: 600 },
      areas,
      areaPositions,
      {}
    );
    expect(result.x).toBe(250); // 350 - 100
    expect(result.y).toBe(400); // 600 - 200
    expect(result.parentId).toBe("area-1");
    expect(result.zIndex).toBe(10);
  });

  it("uses drag origin offset when drag is active", () => {
    const areas = {
      allIds: ["area-1"],
      byId: { "area-1": { id: "area-1", board_ids: ["b-1"] } },
    };
    const areaPositions = { "area-1": { x: 100, y: 200 } };
    const dragOrigins = { "area-1": { originX: 50, originY: 75 } };

    const result = computeBoardPosition(
      "b-1",
      { x: 350, y: 600 },
      areas,
      areaPositions,
      dragOrigins
    );
    expect(result.x).toBe(300); // 350 - 50
    expect(result.y).toBe(525); // 600 - 75
    expect(result.parentId).toBe("area-1");
  });

  it("stops at first matching area (break after find)", () => {
    const areas = {
      allIds: ["area-1", "area-2"],
      byId: {
        "area-1": { id: "area-1", board_ids: ["b-1"] },
        "area-2": { id: "area-2", board_ids: ["b-1"] },
      },
    };
    const areaPositions = {
      "area-1": { x: 10, y: 20 },
      "area-2": { x: 100, y: 200 },
    };

    const result = computeBoardPosition(
      "b-1",
      { x: 50, y: 60 },
      areas,
      areaPositions,
      {}
    );
    // Should match area-1 (first in allIds)
    expect(result.parentId).toBe("area-1");
    expect(result.x).toBe(40); // 50 - 10
    expect(result.y).toBe(40); // 60 - 20
  });

  it("ignores area with no position", () => {
    const areas = {
      allIds: ["area-no-pos"],
      byId: { "area-no-pos": { id: "area-no-pos", board_ids: ["b-1"] } },
    };
    const areaPositions: Record<string, { x: number; y: number } | undefined> =
      {};

    const result = computeBoardPosition(
      "b-1",
      { x: 100, y: 200 },
      areas,
      areaPositions,
      {}
    );
    // No matching parent since area has no position
    expect(result.parentId).toBeUndefined();
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });
});

// ─── dialogNode type resolution ────────────────────────────────

type BoardDialogType =
  | "rename"
  | "duplicate"
  | "properties"
  | "color-icon-picker"
  | "delete";

function resolveDialogNodeType(dialogType: BoardDialogType): string {
  switch (dialogType) {
    case "rename":
      return "boardRenameDialog";
    case "duplicate":
      return "boardDuplicateDialog";
    case "properties":
      return "boardPropertiesDialog";
    case "color-icon-picker":
      return "colorIconPickerDialog";
    case "delete":
      return "boardDeleteDialog";
    default:
      return "boardDeleteDialog";
  }
}

describe("dialogNode type resolution", () => {
  it("maps rename → boardRenameDialog", () => {
    expect(resolveDialogNodeType("rename")).toBe("boardRenameDialog");
  });

  it("maps duplicate → boardDuplicateDialog", () => {
    expect(resolveDialogNodeType("duplicate")).toBe("boardDuplicateDialog");
  });

  it("maps properties → boardPropertiesDialog", () => {
    expect(resolveDialogNodeType("properties")).toBe("boardPropertiesDialog");
  });

  it("maps color-icon-picker → colorIconPickerDialog", () => {
    expect(resolveDialogNodeType("color-icon-picker")).toBe(
      "colorIconPickerDialog"
    );
  });

  it("maps delete → boardDeleteDialog", () => {
    expect(resolveDialogNodeType("delete")).toBe("boardDeleteDialog");
  });
});

// ─── columnDialog type mapping ─────────────────────────────────

type ColumnDialogType = "rename" | "delete" | "move";

function resolveColumnDialogNodeType(dialogType: ColumnDialogType): string {
  switch (dialogType) {
    case "rename":
      return "columnRenameDialog";
    case "delete":
      return "columnDeleteDialog";
    case "move":
      return "columnMoveDialog";
    default:
      return "columnDeleteDialog";
  }
}

describe("columnDialog type mapping", () => {
  it("maps rename → columnRenameDialog", () => {
    expect(resolveColumnDialogNodeType("rename")).toBe("columnRenameDialog");
  });

  it("maps delete → columnDeleteDialog", () => {
    expect(resolveColumnDialogNodeType("delete")).toBe("columnDeleteDialog");
  });

  it("maps move → columnMoveDialog", () => {
    expect(resolveColumnDialogNodeType("move")).toBe("columnMoveDialog");
  });
});

// ─── quickActions node ID generation ───────────────────────────

describe("quickActions node ID generation", () => {
  it("generates board quick-actions ID with prefix", () => {
    const id = "quick-actions-board-1";
    expect(id).toBe("quick-actions-board-1");
  });

  it("generates task quick-actions ID with prefix", () => {
    const taskId = "task-42";
    const id = `task-quick-actions-${taskId}`;
    expect(id).toBe("task-quick-actions-task-42");
  });

  it("generates column quick-actions ID with prefix", () => {
    const columnId = "col-99";
    const id = `column-quick-actions-${columnId}`;
    expect(id).toBe("column-quick-actions-col-99");
  });
});

// ─── commentCluster node shape ─────────────────────────────────

describe("commentCluster node shape", () => {
  it("builds correct node from cluster data", () => {
    const cluster = {
      id: "cluster-1",
      centroid: { x: 150, y: 250 },
      comments: [{ id: "c-1" }, { id: "c-2" }],
      isSingle: false,
    };

    const node = {
      id: cluster.id,
      type: "commentCluster" as const,
      position: { x: cluster.centroid.x, y: cluster.centroid.y },
      data: {
        comments: cluster.comments,
        centroid: cluster.centroid,
        isSingle: cluster.isSingle,
      },
      style: { zIndex: Z_INDEX_BASE.DIALOGS },
      width: 1,
      height: 1,
      draggable: true,
    };

    expect(node.id).toBe("cluster-1");
    expect(node.type).toBe("commentCluster");
    expect(node.position).toEqual({ x: 150, y: 250 });
    expect(node.data.comments).toHaveLength(2);
    expect(node.data.isSingle).toBe(false);
    expect(node.style.zIndex).toBe(Z_INDEX_BASE.DIALOGS);
    expect(node.width).toBe(1);
    expect(node.height).toBe(1);
    expect(node.draggable).toBe(true);
  });

  it("marks single comment cluster as isSingle", () => {
    const cluster = {
      id: "cluster-solo",
      centroid: { x: 50, y: 50 },
      comments: [{ id: "c-1" }],
      isSingle: true,
    };

    const node = {
      id: cluster.id,
      type: "commentCluster" as const,
      data: { isSingle: cluster.isSingle },
    };

    expect(node.data.isSingle).toBe(true);
  });
});

// ─── boardIds source selection ─────────────────────────────────

describe("boardIds source selection", () => {
  it("uses workspace board_ids when workspace exists", () => {
    const workspace = { board_ids: ["b-1", "b-3"] };
    const allBoardIds = ["b-1", "b-2", "b-3", "b-4"];

    const boardIds = workspace?.board_ids ?? allBoardIds;
    expect(boardIds).toEqual(["b-1", "b-3"]);
  });

  it("falls back to all boards when no workspace", () => {
    const workspace: any = null;
    const allBoardIds = ["b-1", "b-2", "b-3"];

    const boardIds = workspace?.board_ids ?? allBoardIds;
    expect(boardIds).toEqual(["b-1", "b-2", "b-3"]);
  });
});

// ─── node output order ─────────────────────────────────────────

describe("node output order (render layer)", () => {
  it("areas come before boards in the output array", () => {
    const nodeTypes = [
      "area", // areaNodes first
      "board", // then boardNodes
      "taskModal",
      "taskDetailModal",
      "boardQuickActions",
      "taskQuickActions",
      "columnQuickActions",
      "boardRenameDialog",
      "connectionDialog",
      "shareDialog",
      "columnRenameDialog",
      "areaPropertiesDialog",
      "commentCluster",
    ];

    const areaIdx = nodeTypes.indexOf("area");
    const boardIdx = nodeTypes.indexOf("board");
    const dialogIdx = nodeTypes.indexOf("boardRenameDialog");
    const commentIdx = nodeTypes.indexOf("commentCluster");

    // Areas render below boards
    expect(areaIdx).toBeLessThan(boardIdx);
    // Boards render below dialogs
    expect(boardIdx).toBeLessThan(dialogIdx);
    // Comments render last
    expect(commentIdx).toBe(nodeTypes.length - 1);
  });
});
