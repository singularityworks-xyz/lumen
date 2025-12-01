"use client";

import {
  Background,
  BackgroundVariant,
  MiniMap,
  type Node,
  type OnMove,
  type OnNodesChange,
  ReactFlow,
  SelectionMode,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/shallow";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "../../features/kanban/components/board-node";
import { BulkActionsBar } from "../../features/kanban/components/bulk-actions-bar";
import {
  canRedo,
  canUndo,
  redo,
  undo,
  useKanbanStore,
} from "../../features/kanban/store/kanban-store";
import { useShowWelcomeScreen } from "../../features/kanban/store/selectors";
import type { BoardNode } from "../../features/kanban/types";
import { CustomControls } from "../custom-controls";
import { WelcomeScreen } from "../dialogs/welcome-screen";
import { RightControls } from "../right-controls";
import { WorkspaceSelector } from "../workspace-selector";
import { MiniMapNode } from "./minimap-node";

type KanbanNode = Node<BoardNode["data"]>;
type TaskModalNode = Node<{ modalId: string }>;
type EditBoardModalNode = Node<{ modalId: string }>;
type TaskDetailModalNode = Node<{ modalId: string }>;
type CanvasNode =
  | KanbanNode
  | TaskModalNode
  | EditBoardModalNode
  | TaskDetailModalNode;

export function KanbanCanvas() {
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const boards = useKanbanStore((state) => state.boards);
  const boardPositions = useKanbanStore((state) => state.boardPositions);
  const workspaces = useKanbanStore((state) => state.workspaces);
  const showMiniMap = useKanbanStore((state) => state.showMiniMap);
  const interactionMode = useKanbanStore((state) => state.interactionMode);
  const setInteractionMode = useKanbanStore(
    (state) => state.setInteractionMode
  );
  const clearBoardSelection = useKanbanStore(
    (state) => state.clearBoardSelection
  );
  const canvas = useKanbanStore((state) => state.canvas);
  const setViewport = useKanbanStore((state) => state.setViewport);
  const updateBoardPosition = useKanbanStore(
    (state) => state.updateBoardPosition
  );
  const updateBoardDimensions = useKanbanStore(
    (state) => state.updateBoardDimensions
  );
  const updateModalPosition = useKanbanStore(
    (state) => state.updateModalPosition
  );
  const selectedBoardId = useKanbanStore((state) => state.selectedBoardId);
  // Get modal IDs to track which modals exist (shallow compare will work on string[])
  const modalIds = useKanbanStore(
    useShallow((state) => Object.keys(state.createTaskModals))
  );
  // Get the full createTaskModals to access position data in useMemo
  // This won't cause re-renders by itself since we use modalIds for the dependency
  const createTaskModals = useKanbanStore((state) => state.createTaskModals);
  // Get edit board modal IDs
  const editBoardModalIds = useKanbanStore(
    useShallow((state) => Object.keys(state.editBoardModals))
  );
  const editBoardModals = useKanbanStore((state) => state.editBoardModals);
  const updateEditBoardModalPosition = useKanbanStore(
    (state) => state.updateEditBoardModalPosition
  );
  // Get task detail modal IDs
  const taskDetailModalIds = useKanbanStore(
    useShallow((state) => Object.keys(state.taskDetailModals))
  );
  const taskDetailModals = useKanbanStore((state) => state.taskDetailModals);
  const updateTaskDetailModalPosition = useKanbanStore(
    (state) => state.updateTaskDetailModalPosition
  );
  const showWelcomeScreen = useShowWelcomeScreen();

  const { setViewport: setReactFlowViewport, fitView } = useReactFlow();
  const prevWorkspaceIdRef = useRef(currentWorkspaceId);

  // Animate viewport when switching workspaces
  useEffect(() => {
    const prevWorkspaceId = prevWorkspaceIdRef.current;
    if (currentWorkspaceId === prevWorkspaceId) {
      return;
    }
    prevWorkspaceIdRef.current = currentWorkspaceId;

    // Skip animation on initial mount or if no workspace selected
    if (!currentWorkspaceId || prevWorkspaceId === null) {
      return;
    }

    const workspace = workspaces.byId[currentWorkspaceId];
    if (!workspace) {
      return;
    }

    // Priority 1: Restore last viewport if available
    if (workspace.lastViewport) {
      setReactFlowViewport(workspace.lastViewport, { duration: 300 });
      return;
    }

    // Priority 2: Center on last focused board
    if (workspace.lastFocusedBoardId) {
      const boardPos = boardPositions.byId[workspace.lastFocusedBoardId];
      if (boardPos) {
        // Center on board with offset for board dimensions
        const centerX = boardPos.x + (boardPos.width ?? 400) / 2;
        const centerY = boardPos.y + (boardPos.height ?? 300) / 2;
        setReactFlowViewport(
          {
            x: -centerX + window.innerWidth / 2,
            y: -centerY + window.innerHeight / 2,
            zoom: 1,
          },
          { duration: 300 }
        );
        return;
      }
    }

    // Priority 3: Fit view to show all boards in workspace
    // Use setTimeout to ensure nodes are rendered before fitting
    setTimeout(() => {
      fitView({ padding: 0.3, duration: 300 });
    }, 50);
  }, [
    currentWorkspaceId,
    workspaces,
    boardPositions,
    setReactFlowViewport,
    fitView,
  ]);

  const nodes: CanvasNode[] = useMemo(() => {
    const currentWorkspace = currentWorkspaceId
      ? workspaces.byId[currentWorkspaceId]
      : null;

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
        const node: KanbanNode = {
          id: boardId,
          type: "board",
          position: { x: position.x, y: position.y },
          data: {
            boardId,
            isSelected: boardId === selectedBoardId,
          },
          style: { zIndex: position.zIndex },
          width: position.width,
          height: position.height,
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
          style: { zIndex: 1000 + modal.zIndex },
          draggable: true,
        };
        return node;
      })
      .filter((node): node is TaskModalNode => node !== null);

    const editBoardModalNodes: EditBoardModalNode[] = editBoardModalIds
      .map((id) => {
        const modal = editBoardModals[id];
        if (!modal) {
          return null;
        }
        const node: EditBoardModalNode = {
          id: `edit-board-modal-${modal.id}`,
          type: "editBoardModal",
          position: { x: modal.position.x, y: modal.position.y },
          data: { modalId: modal.id },
          style: { zIndex: 1000 + modal.zIndex },
          draggable: true,
        };
        return node;
      })
      .filter((node): node is EditBoardModalNode => node !== null);

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
          style: { zIndex: 1000 + modal.zIndex },
          draggable: true,
        };
        return node;
      })
      .filter((node): node is TaskDetailModalNode => node !== null);

    return [
      ...boardNodes,
      ...modalNodes,
      ...editBoardModalNodes,
      ...taskDetailModalNodes,
    ];
  }, [
    boards,
    boardPositions,
    currentWorkspaceId,
    workspaces,
    selectedBoardId,
    modalIds,
    createTaskModals,
    editBoardModalIds,
    editBoardModals,
    taskDetailModalIds,
    taskDetailModals,
  ]);

  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const isUpdatingFromStore = useRef(false);

  const handleToggleMode = useCallback(
    (event: KeyboardEvent) => {
      const isVKey = event.key.toLowerCase() === "v";
      const hasNoModifiers = !(event.metaKey || event.ctrlKey);
      if (!event.repeat && isVKey && hasNoModifiers) {
        event.preventDefault();
        setInteractionMode(interactionMode === "drag" ? "select" : "drag");
      }
    },
    [interactionMode, setInteractionMode]
  );

  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && interactionMode === "select") {
        event.preventDefault();
        clearBoardSelection();
      }
    },
    [interactionMode, clearBoardSelection]
  );

  const handleUndoRedo = useCallback((event: KeyboardEvent) => {
    const hasModifier = event.metaKey || event.ctrlKey;
    if (!hasModifier) {
      return;
    }
    const key = event.key.toLowerCase();
    const isRedo = (key === "z" && event.shiftKey) || key === "y";
    const isUndo = key === "z" && !event.shiftKey;

    if (isUndo && canUndo()) {
      event.preventDefault();
      undo();
    } else if (isRedo && canRedo()) {
      event.preventDefault();
      redo();
    }
  }, []);

  useEffect(() => {
    if (showWelcomeScreen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isEditableElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (isEditableElement) {
        handleUndoRedo(event);
        return;
      }

      handleToggleMode(event);
      handleEscapeKey(event);
      handleUndoRedo(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showWelcomeScreen, handleToggleMode, handleEscapeKey, handleUndoRedo]);

  const handleNodesChange: OnNodesChange<CanvasNode> = useCallback(
    (changes) => {
      onNodesChange(changes);

      for (const change of changes) {
        if (change.type === "position" && change.position) {
          if (change.id.startsWith("modal-")) {
            const modalId = change.id.replace("modal-", "");
            updateModalPosition(modalId, change.position);
          } else if (change.id.startsWith("edit-board-modal-")) {
            const modalId = change.id.replace("edit-board-modal-", "");
            updateEditBoardModalPosition(modalId, change.position);
          } else if (change.id.startsWith("task-detail-modal-")) {
            const modalId = change.id.replace("task-detail-modal-", "");
            updateTaskDetailModalPosition(modalId, change.position);
          } else {
            updateBoardPosition(change.id, change.position);
          }
        }
        if (change.type === "dimensions" && change.dimensions) {
          updateBoardDimensions(change.id, change.dimensions);
        }
      }
    },
    [
      onNodesChange,
      updateBoardPosition,
      updateBoardDimensions,
      updateModalPosition,
      updateEditBoardModalPosition,
      updateTaskDetailModalPosition,
    ]
  );

  const handleMoveEnd: OnMove = useCallback(
    (_event, viewportState) => {
      if (!viewportState) {
        return;
      }
      setViewport(viewportState);
    },
    [setViewport]
  );

  useEffect(() => {
    isUpdatingFromStore.current = true;
    setLocalNodes(nodes);
  }, [nodes, setLocalNodes]);

  useEffect(() => {
    const handleWheel = (e: Event) => {
      const wheelEvent = e as WheelEvent;
      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        e.preventDefault();
      }
    };

    const reactFlowCanvas = document.querySelector(".react-flow");
    if (reactFlowCanvas) {
      reactFlowCanvas.addEventListener("wheel", handleWheel, {
        passive: false,
      });
      return () => {
        reactFlowCanvas.removeEventListener("wheel", handleWheel);
      };
    }
  }, []);

  return (
    <div className="h-full w-full">
      <ReactFlow
        className="bg-background"
        defaultViewport={canvas.viewport}
        elementsSelectable={!showWelcomeScreen && interactionMode === "select"}
        fitView={nodes.length === 0}
        maxZoom={3}
        minZoom={0.1}
        nodeOrigin={[0, 0]}
        nodes={localNodes}
        nodesConnectable={false}
        nodesDraggable={!showWelcomeScreen && interactionMode === "drag"}
        nodeTypes={nodeTypes}
        onMoveEnd={handleMoveEnd}
        onNodesChange={handleNodesChange}
        panOnDrag={!showWelcomeScreen && interactionMode === "drag"}
        panOnScroll={!showWelcomeScreen && interactionMode === "drag"}
        proOptions={{ hideAttribution: true }}
        selectionKeyCode={interactionMode === "select" ? null : "Meta"}
        selectionMode={
          interactionMode === "select" ? SelectionMode.Partial : undefined
        }
        selectionOnDrag={!showWelcomeScreen && interactionMode === "select"}
        zoomActivationKeyCode={showWelcomeScreen ? null : "Control"}
        zoomOnScroll={!showWelcomeScreen}
      >
        <Background
          className="opacity-30"
          color="currentColor"
          gap={20}
          variant={BackgroundVariant.Dots}
        />
        <CustomControls />
        {showMiniMap && (
          <MiniMap
            className="rounded-lg! border-2! border-border/50! bg-card/95! shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]! backdrop-blur-md! dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]!"
            maskColor="var(--background)"
            nodeColor={(node) => {
              if (
                ("isSelected" in node.data && node.data.isSelected) ||
                node.selected
              ) {
                return "var(--primary)";
              }
              return "var(--secondary)";
            }}
            nodeComponent={MiniMapNode}
            pannable
            position="top-right"
            zoomable
          />
        )}
      </ReactFlow>
      <WelcomeScreen />
      <WorkspaceSelector />
      <RightControls />
      <BulkActionsBar />
    </div>
  );
}
