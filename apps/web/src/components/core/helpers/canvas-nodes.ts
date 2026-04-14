import { useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { useCommentClusters } from "@/src/features/comments/hooks/use-comment-clusters";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { Z_INDEX_BASE } from "@/src/features/kanban/store/slices/z-index-slice";
import type {
  AreaNode,
  BoardDialogNode,
  BoardQuickActionsNode,
  CanvasNode,
  ColumnDialogNode,
  ColumnQuickActionsNode,
  ConnectionDialogNode,
  KanbanNode,
  ShareDialogNode,
  TaskDetailModalNode,
  TaskModalNode,
  TaskQuickActionsNode,
} from "./canvas-types";

export function useCanvasNodes() {
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const boards = useKanbanStore((state) => state.boards);
  const boardPositions = useKanbanStore((state) => state.boardPositions);
  const workspaces = useKanbanStore((state) => state.workspaces);
  const areas = useKanbanStore((state) => state.areas);
  const areaPositions = useKanbanStore((state) => state.areaPositions);
  const areaDragOrigins = useKanbanStore((state) => state.areaDragOrigins);
  const selectedBoardId = useKanbanStore((state) => state.selectedBoardId);
  const modalIds = useKanbanStore(
    useShallow((state) => Object.keys(state.createTaskModals))
  );
  const createTaskModals = useKanbanStore((state) => state.createTaskModals);
  const taskDetailModalIds = useKanbanStore(
    useShallow((state) => Object.keys(state.taskDetailModals))
  );
  const taskDetailModals = useKanbanStore((state) => state.taskDetailModals);
  const boardQuickActions = useKanbanStore((state) => state.boardQuickActions);
  const boardDialogs = useKanbanStore((state) => state.boardDialogs);
  const boardDialogIds = useKanbanStore(
    useShallow((state) => Object.keys(state.boardDialogs))
  );
  const connectionDialog = useKanbanStore((state) => state.connectionDialog);
  const shareDialog = useKanbanStore((state) => state.shareDialog);
  const columnDialogs = useKanbanStore((state) => state.columnDialogs);
  const columnQuickActions = useKanbanStore(
    (state) => state.columnQuickActions
  );
  const taskQuickActions = useKanbanStore((state) => state.taskQuickActions);
  const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
  const areaDialogs = useKanbanStore((state) => state.areaDialogs);
  const commentClusters = useCommentClusters();

  const nodes: CanvasNode[] = useMemo(() => {
    const computeZIndex = (dialogId: string) => {
      const index = dialogFocusStack.indexOf(dialogId);
      if (index === -1) {
        return Z_INDEX_BASE.DIALOGS;
      }
      return Z_INDEX_BASE.DIALOGS + (index + 1) * 10;
    };

    const currentWorkspace = currentWorkspaceId
      ? workspaces.byId[currentWorkspaceId]
      : null;

    const areaNodes: AreaNode[] = areaPositions.allIds
      .filter((areaId) => {
        const area = areas.byId[areaId];
        const position = areaPositions.byId[areaId];
        return (
          area &&
          position &&
          (!currentWorkspaceId || area.workspace_id === currentWorkspaceId)
        );
      })
      .map((areaId) => {
        const position = areaPositions.byId[areaId];
        if (!position) {
          return null;
        }
        const node: AreaNode = {
          id: areaId,
          type: "area",
          position: { x: position.x, y: position.y },
          data: { areaId },
          style: { zIndex: position.zIndex },
          width: position.width,
          height: position.height,
        };
        return node;
      })
      .filter((node): node is AreaNode => node !== null);

    const boardIds = currentWorkspace?.board_ids ?? boards.allIds;

    const boardNodes: KanbanNode[] = boardIds
      .filter((boardId) => {
        const board = boards.byId[boardId];
        const position = boardPositions.byId[boardId];
        return (
          board &&
          position &&
          (!currentWorkspaceId || board.workspace_id === currentWorkspaceId)
        );
      })
      .map((boardId) => {
        const position = boardPositions.byId[boardId];
        if (!position) {
          return null;
        }

        let parentId: string | undefined;
        let pPos = { x: position.x, y: position.y };
        let zIndex = position.zIndex;

        for (const areaId of areas.allIds) {
          const area = areas.byId[areaId];
          if (area?.board_ids?.includes(boardId)) {
            const areaPos = areaPositions.byId[areaId];
            if (areaPos) {
              parentId = areaId;

              const origin = areaDragOrigins[areaId];

              if (origin) {
                pPos = {
                  x: position.x - origin.originX,
                  y: position.y - origin.originY,
                };
              } else {
                pPos = {
                  x: position.x - areaPos.x,
                  y: position.y - areaPos.y,
                };
              }

              zIndex = 10;
            }
            break;
          }
        }

        const node: KanbanNode = {
          id: boardId,
          type: "board",
          position: pPos,
          data: {
            boardId,
            isSelected: boardId === selectedBoardId,
          },
          style: { zIndex },
          width: position.width,
          height: position.height,
          parentId,
        };

        return node;
      })
      .filter((node): node is KanbanNode => node !== null);

    const modalNodes: TaskModalNode[] = modalIds
      .map((id) => {
        const modal = createTaskModals[id];
        if (!modal) {
          return null;
        }
        const node: TaskModalNode = {
          id: `modal-${modal.id}`,
          type: "taskModal",
          position: { x: modal.position.x, y: modal.position.y },
          data: { modalId: modal.id },
          style: { zIndex: computeZIndex(`task-modal-${modal.id}`) },
          draggable: true,
        };
        return node;
      })
      .filter((node): node is TaskModalNode => node !== null);

    const commentClusterNodes = commentClusters.map((cluster) => ({
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
    }));

    const taskDetailModalNodes: TaskDetailModalNode[] = taskDetailModalIds
      .map((id) => {
        const modal = taskDetailModals[id];
        if (!modal) {
          return null;
        }
        const node: TaskDetailModalNode = {
          id: `task-detail-modal-${modal.id}`,
          type: "taskDetailModal",
          position: { x: modal.position.x, y: modal.position.y },
          data: { modalId: modal.id },
          style: { zIndex: computeZIndex(`task-detail-modal-${modal.id}`) },
          draggable: true,
          width: 400,
          height: 1,
        };
        return node;
      })
      .filter((node): node is TaskDetailModalNode => node !== null);

    const quickActionsNodes: BoardQuickActionsNode[] = Object.values(
      boardQuickActions
    )
      .filter(
        (qa): qa is NonNullable<typeof qa> => qa != null && qa.position != null
      )
      .map((qa) => ({
        id: `quick-actions-${qa.boardId}`,
        type: "boardQuickActions" as const,
        position: {
          x: qa.position.x,
          y: qa.position.y,
        },
        data: { boardId: qa.boardId },
        style: { zIndex: computeZIndex(`board-quick-actions-${qa.boardId}`) },
        draggable: true,
      }));

    const dialogNodes: BoardDialogNode[] = boardDialogIds
      .map((id) => {
        const dialog = boardDialogs[id];
        if (!dialog) {
          return null;
        }
        const nodeType =
          dialog.type === "rename"
            ? "boardRenameDialog"
            : dialog.type === "duplicate"
              ? "boardDuplicateDialog"
              : dialog.type === "properties"
                ? "boardPropertiesDialog"
                : dialog.type === "color-icon-picker"
                  ? "colorIconPickerDialog"
                  : "boardDeleteDialog";

        const dialogZIndexId = `${dialog.type}-board-dialog-${dialog.id}`;
        const computedZIndex = computeZIndex(dialogZIndexId);

        const node: BoardDialogNode = {
          id: `board-dialog-${dialog.id}`,
          type: nodeType,
          position: { x: dialog.position.x, y: dialog.position.y },
          data: {
            dialogId: dialog.id,
            ...(dialog.type === "color-icon-picker"
              ? {
                  columnId: dialog.columnId,
                  sourceDialogId: dialog.sourceDialogId,
                  targetType: dialog.targetType,
                }
              : {}),
          },
          style: { zIndex: computedZIndex },
          draggable: true,
        };
        return node;
      })
      .filter((node): node is BoardDialogNode => node !== null);

    const connectionDialogNodes: ConnectionDialogNode[] = [];
    if (connectionDialog) {
      connectionDialogNodes.push({
        id: `connection-dialog-${connectionDialog.boardId}`,
        type: "connectionDialog",
        position: {
          x: connectionDialog.position.x,
          y: connectionDialog.position.y,
        },
        data: { boardId: connectionDialog.boardId },
        style: {
          zIndex: computeZIndex(
            `connection-dialog-${connectionDialog.boardId}`
          ),
        },
        draggable: true,
      });
    }

    const shareDialogNodes: ShareDialogNode[] = [];
    if (shareDialog) {
      shareDialogNodes.push({
        id: `share-dialog-${shareDialog.boardId}`,
        type: "shareDialog",
        position: {
          x: shareDialog.position.x,
          y: shareDialog.position.y,
        },
        data: { boardId: shareDialog.boardId },
        style: {
          zIndex: computeZIndex(`share-dialog-${shareDialog.boardId}`),
        },
        draggable: true,
      });
    }

    const columnDialogNodes: ColumnDialogNode[] = [];
    if (columnDialogs) {
      // biome-ignore lint/complexity/noForEach: skip
      Object.values(columnDialogs).forEach((dialog) => {
        if (dialog.type === "rename") {
          columnDialogNodes.push({
            id: `column-dialog-${dialog.id}`,
            type: "columnRenameDialog",
            position: {
              x: dialog.position.x,
              y: dialog.position.y,
            },
            data: { columnId: dialog.columnId, dialogId: dialog.id },
            style: {
              zIndex: computeZIndex(`rename-column-dialog-${dialog.id}`),
            },
            draggable: true,
          });
        } else if (dialog.type === "delete") {
          columnDialogNodes.push({
            id: `column-dialog-${dialog.id}`,
            type: "columnDeleteDialog",
            position: {
              x: dialog.position.x,
              y: dialog.position.y,
            },
            data: { columnId: dialog.columnId, dialogId: dialog.id },
            style: {
              zIndex: computeZIndex(`delete-column-dialog-${dialog.id}`),
            },
            draggable: true,
          });
        } else if (dialog.type === "move") {
          columnDialogNodes.push({
            id: `column-dialog-${dialog.id}`,
            type: "columnMoveDialog",
            position: {
              x: dialog.position.x,
              y: dialog.position.y,
            },
            data: { columnId: dialog.columnId, dialogId: dialog.id },
            style: {
              zIndex: computeZIndex(`move-column-dialog-${dialog.id}`),
            },
            draggable: true,
          });
        }
      });
    }

    const taskQuickActionsNodes: TaskQuickActionsNode[] = Object.values(
      taskQuickActions
    )
      .filter(
        (qa): qa is NonNullable<typeof qa> => qa != null && qa.position != null
      )
      .map((qa) => ({
        id: `task-quick-actions-${qa.taskId}`,
        type: "taskQuickActions" as const,
        position: {
          x: qa.position.x,
          y: qa.position.y,
        },
        data: { taskId: qa.taskId },
        style: { zIndex: computeZIndex(`task-quick-actions-${qa.taskId}`) },
        draggable: true,
      }));

    const columnQuickActionsNodes: ColumnQuickActionsNode[] = Object.values(
      columnQuickActions ?? {}
    )
      .filter(
        (qa): qa is NonNullable<typeof qa> => qa != null && qa.position != null
      )
      .map((qa) => ({
        id: `column-quick-actions-${qa.columnId}`,
        type: "columnQuickActions" as const,
        position: {
          x: qa.position.x,
          y: qa.position.y,
        },
        data: { columnId: qa.columnId },
        style: {
          zIndex: computeZIndex(`column-quick-actions-${qa.columnId}`),
        },
        draggable: true,
      }));

    const areaDialogNodes = Object.values(areaDialogs).map((dialog) => ({
      id: `area-dialog-${dialog.id}`,
      type: "areaPropertiesDialog" as const,
      position: dialog.position,
      data: { dialogId: dialog.id },
      style: { zIndex: computeZIndex(`area-properties-dialog-${dialog.id}`) },
      width: 300,
      height: 400,
      draggable: true,
    }));

    return [
      ...areaNodes,
      ...boardNodes,
      ...modalNodes,
      ...taskDetailModalNodes,
      ...quickActionsNodes,
      ...taskQuickActionsNodes,
      ...columnQuickActionsNodes,
      ...dialogNodes,
      ...connectionDialogNodes,
      ...shareDialogNodes,
      ...columnDialogNodes,
      ...areaDialogNodes,
      ...commentClusterNodes,
    ];
  }, [
    areas,
    areaPositions,
    boards,
    boardPositions,
    commentClusters,
    currentWorkspaceId,
    workspaces,
    selectedBoardId,
    modalIds,
    createTaskModals,
    taskDetailModalIds,
    taskDetailModals,
    boardQuickActions,
    boardDialogIds,
    boardDialogs,
    connectionDialog,
    shareDialog,
    columnDialogs,
    taskQuickActions,
    columnQuickActions,
    dialogFocusStack,
    areaDialogs,
    areaDragOrigins,
  ]);

  return { nodes, commentClusters };
}
