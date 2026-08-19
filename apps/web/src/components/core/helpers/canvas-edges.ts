import { MarkerType } from "@xyflow/react";
import { useMemo } from "react";
import type { BoardEdge } from "@/src/components/core/board-edge";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";

const SOURCE_HANDLE_SUFFIX = /-source$/;
const TARGET_HANDLE_SUFFIX = /-target$/;

export function useCanvasEdges() {
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const boards = useKanbanStore((state) => state.boards);
  const textBoards = useKanbanStore((state) => state.textBoards);
  const workspaces = useKanbanStore((state) => state.workspaces);
  const boardConnections = useKanbanStore((state) => state.boardConnections);

  const edges: BoardEdge[] = useMemo(() => {
    const currentWorkspace = currentWorkspaceId
      ? workspaces.byId[currentWorkspaceId]
      : null;
    // Both kanban boards and text boards participate in connections, so a
    // connection between a board and a text board stays visible.
    const boardIds = [
      ...(currentWorkspace?.board_ids ?? boards.allIds),
      ...(currentWorkspace?.text_board_ids ?? textBoards.allIds),
    ];

    return boardConnections.allIds
      .map((connectionId) => {
        const connection = boardConnections.byId[connectionId];
        if (!connection) {
          return null;
        }

        const isSourceVisible = boardIds.includes(connection.source_board_id);
        const isTargetVisible = boardIds.includes(connection.target_board_id);
        const bothVisible = isSourceVisible && isTargetVisible;
        if (!bothVisible) {
          return null;
        }

        const rawSourceHandle = (connection.sourceHandle ?? "bottom").replace(
          SOURCE_HANDLE_SUFFIX,
          ""
        );
        const rawTargetHandle = (connection.targetHandle ?? "top").replace(
          TARGET_HANDLE_SUFFIX,
          ""
        );

        const edge: BoardEdge = {
          id: connectionId,
          source: connection.source_board_id,
          target: connection.target_board_id,
          sourceHandle: rawSourceHandle,
          targetHandle: `${rawTargetHandle}-target`,
          type: "default",
          data: {
            label: connection.label,
            lineStyle: connection.lineStyle,
          },
          markerEnd: connection.showArrow
            ? {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
                color: "#71717a",
              }
            : undefined,
        };
        return edge;
      })
      .filter((edge): edge is BoardEdge => edge !== null);
  }, [
    boardConnections,
    currentWorkspaceId,
    workspaces,
    boards.allIds,
    textBoards.allIds,
  ]);

  return edges;
}
