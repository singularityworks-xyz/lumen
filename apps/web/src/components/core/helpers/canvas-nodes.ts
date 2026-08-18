import { useMemo, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { useCommentClusters } from "@/src/features/comments/hooks/use-comment-clusters";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { Z_INDEX_BASE } from "@/src/features/kanban/store/slices/z-index-slice";
import { calculateBoardWidth } from "@/src/features/kanban/utils/board-resize-rules";
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

function styleEqual(
  a: { zIndex?: string | number } | undefined,
  b: { zIndex?: string | number } | undefined
): boolean {
  // Only zIndex is ever set as a style property on canvas nodes
  return a?.zIndex === b?.zIndex;
}

function dataEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): boolean {
  // Fast path: compare known scalar fields that all node data objects use.
  // All data objects are flat records with string/boolean/number values
  // plus occasionally a shallow array (comments in cluster nodes).
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    const av = a[key];
    const bv = b[key];
    if (av === bv) {
      continue;
    }
    // Handle arrays (e.g. comments in cluster nodes) — compare by length + reference
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (av.length !== bv.length) {
        return false;
      }
      for (let i = 0; i < av.length; i++) {
        if (av[i] !== bv[i]) {
          return false;
        }
      }
      continue;
    }
    // Handle nested plain objects (e.g. centroid {x, y})
    if (
      av !== null &&
      bv !== null &&
      typeof av === "object" &&
      typeof bv === "object" &&
      !Array.isArray(av) &&
      !Array.isArray(bv)
    ) {
      const aObj = av as Record<string, unknown>;
      const bObj = bv as Record<string, unknown>;
      const aObjKeys = Object.keys(aObj);
      if (aObjKeys.length !== Object.keys(bObj).length) {
        return false;
      }
      for (const k of aObjKeys) {
        if (aObj[k] !== bObj[k]) {
          return false;
        }
      }
      continue;
    }
    return false;
  }
  return true;
}

function nodeDataEqual(a: CanvasNode, b: CanvasNode): boolean {
  if (a.id !== b.id || a.type !== b.type) {
    return false;
  }
  if (a.position.x !== b.position.x || a.position.y !== b.position.y) {
    return false;
  }
  if (a.width !== b.width || a.height !== b.height) {
    return false;
  }
  if ((a.parentId ?? undefined) !== (b.parentId ?? undefined)) {
    return false;
  }
  if ((a.draggable ?? undefined) !== (b.draggable ?? undefined)) {
    return false;
  }
  if (!styleEqual(a.style, b.style)) {
    return false;
  }
  if (!dataEqual(a.data, b.data)) {
    return false;
  }
  return true;
}

function useStableNodeFactory<T extends CanvasNode>(
  factory: () => T[],
  deps: React.DependencyList
): T[] {
  const cacheRef = useRef<Map<string, T>>(new Map());
  const prevDepsRef = useRef<React.DependencyList>([]);
  const resultRef = useRef<T[]>([]);
  // Reuse scratch set to avoid allocating a new Set every run
  const scratchKeysRef = useRef<Set<string>>(new Set());

  let depsChanged = false;
  if (deps.length === prevDepsRef.current.length) {
    for (let i = 0; i < deps.length; i++) {
      if (!Object.is(deps[i], prevDepsRef.current[i])) {
        depsChanged = true;
        break;
      }
    }
  } else {
    depsChanged = true;
  }

  if (depsChanged) {
    prevDepsRef.current = deps;
    const next = factory();
    const cache = cacheRef.current;
    const result: T[] = [];
    const nextKeys = scratchKeysRef.current;
    nextKeys.clear();

    for (const node of next) {
      const key = node.id;
      nextKeys.add(key);
      const cached = cache.get(key);
      if (cached && nodeDataEqual(cached, node)) {
        result.push(cached);
      } else {
        result.push(node);
        cache.set(key, node);
      }
    }

    // Remove stale entries without allocating Array.from
    for (const key of cache.keys()) {
      if (!nextKeys.has(key)) {
        cache.delete(key);
      }
    }

    resultRef.current = result;
  }

  return resultRef.current;
}

export function useCanvasNodes() {
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const boards = useKanbanStore((state) => state.boards);
  const workspaces = useKanbanStore((state) => state.workspaces);
  const areas = useKanbanStore((state) => state.areas);
  // Only subscribe to area position IDs, not the full positions object.
  // Position data is read lazily via getState() to avoid drag re-renders.
  const areaPositionIds = useKanbanStore(
    useShallow((state) => state.areaPositions.allIds)
  );
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

  const computeZIndex = useMemo(
    () => (dialogId: string) => {
      const index = dialogFocusStack.indexOf(dialogId);
      if (index === -1) {
        return Z_INDEX_BASE.DIALOGS;
      }
      return Z_INDEX_BASE.DIALOGS + (index + 1) * 10;
    },
    [dialogFocusStack]
  );

  const currentWorkspace = currentWorkspaceId
    ? workspaces.byId[currentWorkspaceId]
    : null;

  // Structural signatures: only rebuild nodes when IDs, dimensions, or zIndex change
  // NOT on position changes — React Flow handles position via local state during drag
  const areaStructuralSig = useKanbanStore(
    useShallow((state) =>
      state.areaPositions.allIds
        .map((id) => {
          const ap = state.areaPositions.byId[id];
          return `${id}:${Math.round(ap?.width ?? 0)}:${Math.round(ap?.height ?? 0)}:${ap?.zIndex ?? 0}`;
        })
        .join("|")
    )
  );

  const boardStructuralSig = useKanbanStore(
    useShallow((state) =>
      (currentWorkspace?.board_ids ?? state.boards.allIds)
        .map((id) => {
          const bp = state.boardPositions.byId[id];
          const b = state.boards.byId[id];
          const colCount = b?.column_ids?.length ?? 0;
          return `${id}:${colCount}:${Math.round(bp?.height ?? 0)}:${bp?.zIndex ?? 0}`;
        })
        .join("|")
    )
  );

  const areaNodes = useStableNodeFactory<AreaNode>(() => {
    // Read areaPositions lazily to avoid subscribing to position changes
    const areaPositions = useKanbanStore.getState().areaPositions;
    return areaPositionIds
      .filter((areaId) => {
        const area = areas.byId[areaId];
        return (
          area &&
          (!currentWorkspaceId || area.workspace_id === currentWorkspaceId)
        );
      })
      .map((areaId) => {
        const position = areaPositions.byId[areaId];
        if (!position) {
          return null as unknown as AreaNode;
        }
        return {
          id: areaId,
          type: "area" as const,
          position: { x: position.x, y: position.y },
          data: { areaId },
          style: { zIndex: position.zIndex },
          width: position.width,
          height: position.height,
        };
      })
      .filter((node): node is AreaNode => node != null);
  }, [areaStructuralSig, areas, areaPositionIds.join(","), currentWorkspaceId]);

  const boardIds = currentWorkspace?.board_ids ?? boards.allIds;

  const boardNodes = useStableNodeFactory<KanbanNode>(
    () =>
      boardIds
        .filter((boardId) => {
          const board = boards.byId[boardId];
          return (
            board &&
            (!currentWorkspaceId || board.workspace_id === currentWorkspaceId)
          );
        })
        .map((boardId) => {
          // Read boardPositions lazily to avoid subscribing to position changes
          const position =
            useKanbanStore.getState().boardPositions.byId[boardId];
          if (!position) {
            return null as unknown as KanbanNode;
          }

          const board = boards.byId[boardId];
          const columnCount = board?.column_ids?.length ?? 0;
          const exactWidth = calculateBoardWidth(columnCount);

          let parentId: string | undefined;
          let pPos = { x: position.x, y: position.y };
          let zIndex = position.zIndex;

          for (const areaId of areas.allIds) {
            const area = areas.byId[areaId];
            if (area?.board_ids?.includes(boardId)) {
              // Read area positions lazily
              const areaPos =
                useKanbanStore.getState().areaPositions.byId[areaId];
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

          return {
            id: boardId,
            type: "board" as const,
            position: pPos,
            data: {
              boardId,
              isSelected: boardId === selectedBoardId,
            },
            style: { zIndex },
            width: exactWidth,
            height: position.height,
            parentId,
          };
        })
        .filter((node): node is KanbanNode => node != null),
    [
      boardStructuralSig,
      boardIds.join(","),
      boards,
      areas.allIds.join(","),
      areas,
      areaPositionIds.join(","),
      areaDragOrigins,
      currentWorkspaceId,
      selectedBoardId,
    ]
  );

  const modalNodes = useStableNodeFactory<TaskModalNode>(
    () =>
      modalIds
        .map((id) => {
          const modal = createTaskModals[id];
          if (!modal) {
            return null as unknown as TaskModalNode;
          }
          return {
            id: `modal-${modal.id}`,
            type: "taskModal" as const,
            position: { x: modal.position.x, y: modal.position.y },
            data: { modalId: modal.id },
            style: { zIndex: computeZIndex(`task-modal-${modal.id}`) },
            draggable: true,
          };
        })
        .filter((node): node is TaskModalNode => node != null),
    [modalIds.join(","), createTaskModals, computeZIndex]
  );

  const commentClusterNodes = useStableNodeFactory(
    () =>
      commentClusters.map((cluster) => ({
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
      })),
    [commentClusters]
  );

  const taskDetailModalNodes = useStableNodeFactory<TaskDetailModalNode>(
    () =>
      taskDetailModalIds
        .map((id) => {
          const modal = taskDetailModals[id];
          if (!modal) {
            return null as unknown as TaskDetailModalNode;
          }
          return {
            id: `task-detail-modal-${modal.id}`,
            type: "taskDetailModal" as const,
            position: { x: modal.position.x, y: modal.position.y },
            data: { modalId: modal.id },
            style: {
              zIndex: computeZIndex(`task-detail-modal-${modal.id}`),
            },
            draggable: true,
            width: 400,
            height: 1,
          };
        })
        .filter((node): node is TaskDetailModalNode => node != null),
    [taskDetailModalIds.join(","), taskDetailModals, computeZIndex]
  );

  const quickActionsNodes = useStableNodeFactory<BoardQuickActionsNode>(
    () =>
      Object.values(boardQuickActions)
        .filter(
          (qa): qa is NonNullable<typeof qa> =>
            qa != null && qa.position != null
        )
        .map((qa) => ({
          id: `quick-actions-${qa.boardId}`,
          type: "boardQuickActions" as const,
          position: {
            x: qa.position.x,
            y: qa.position.y,
          },
          data: { boardId: qa.boardId },
          style: {
            zIndex: computeZIndex(`board-quick-actions-${qa.boardId}`),
          },
          draggable: true,
        })),
    [boardQuickActions, computeZIndex]
  );

  const dialogNodes = useStableNodeFactory<BoardDialogNode>(
    () =>
      boardDialogIds
        .map((id) => {
          const dialog = boardDialogs[id];
          if (!dialog) {
            return null as unknown as BoardDialogNode;
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

          return {
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
        })
        .filter((node): node is BoardDialogNode => node != null),
    [boardDialogIds.join(","), boardDialogs, computeZIndex]
  );

  const connectionDialogNodes =
    useStableNodeFactory<ConnectionDialogNode>(() => {
      if (!connectionDialog) {
        return [];
      }
      return [
        {
          id: `connection-dialog-${connectionDialog.boardId}`,
          type: "connectionDialog" as const,
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
        },
      ];
    }, [connectionDialog, computeZIndex]);

  const shareDialogNodes = useStableNodeFactory<ShareDialogNode>(() => {
    if (!shareDialog) {
      return [];
    }
    return [
      {
        id: `share-dialog-${shareDialog.boardId}`,
        type: "shareDialog" as const,
        position: {
          x: shareDialog.position.x,
          y: shareDialog.position.y,
        },
        data: { boardId: shareDialog.boardId },
        style: {
          zIndex: computeZIndex(`share-dialog-${shareDialog.boardId}`),
        },
        draggable: true,
      },
    ];
  }, [shareDialog, computeZIndex]);

  const columnDialogNodes = useStableNodeFactory<ColumnDialogNode>(() => {
    const nodes: ColumnDialogNode[] = [];
    if (!columnDialogs) {
      return nodes;
    }
    for (const dialog of Object.values(columnDialogs)) {
      if (!dialog) {
        continue;
      }
      if (dialog.type === "rename") {
        nodes.push({
          id: `column-dialog-${dialog.id}`,
          type: "columnRenameDialog" as const,
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
        nodes.push({
          id: `column-dialog-${dialog.id}`,
          type: "columnDeleteDialog" as const,
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
        nodes.push({
          id: `column-dialog-${dialog.id}`,
          type: "columnMoveDialog" as const,
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
    }
    return nodes;
  }, [columnDialogs, computeZIndex]);

  const taskQuickActionsNodes = useStableNodeFactory<TaskQuickActionsNode>(
    () =>
      Object.values(taskQuickActions)
        .filter(
          (qa): qa is NonNullable<typeof qa> =>
            qa != null && qa.position != null
        )
        .map((qa) => ({
          id: `task-quick-actions-${qa.taskId}`,
          type: "taskQuickActions" as const,
          position: {
            x: qa.position.x,
            y: qa.position.y,
          },
          data: { taskId: qa.taskId },
          style: {
            zIndex: computeZIndex(`task-quick-actions-${qa.taskId}`),
          },
          draggable: true,
        })),
    [taskQuickActions, computeZIndex]
  );

  const columnQuickActionsNodes = useStableNodeFactory<ColumnQuickActionsNode>(
    () =>
      Object.values(columnQuickActions ?? {})
        .filter(
          (qa): qa is NonNullable<typeof qa> =>
            qa != null && qa.position != null
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
        })),
    [columnQuickActions, computeZIndex]
  );

  const areaDialogNodes = useStableNodeFactory(
    () =>
      Object.values(areaDialogs).map((dialog) => ({
        id: `area-dialog-${dialog.id}`,
        type: "areaPropertiesDialog" as const,
        position: dialog.position,
        data: { dialogId: dialog.id },
        style: {
          zIndex: computeZIndex(`area-properties-dialog-${dialog.id}`),
        },
        width: 300,
        height: 400,
        draggable: true,
      })),
    [areaDialogs, computeZIndex]
  );

  const nodes: CanvasNode[] = useMemo(
    () => [
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
    ],
    [
      areaNodes,
      boardNodes,
      modalNodes,
      taskDetailModalNodes,
      quickActionsNodes,
      taskQuickActionsNodes,
      columnQuickActionsNodes,
      dialogNodes,
      connectionDialogNodes,
      shareDialogNodes,
      columnDialogNodes,
      areaDialogNodes,
      commentClusterNodes,
    ]
  );

  return { nodes, commentClusters };
}
