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
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import "@xyflow/react/dist/style.css";
import { CustomControls } from "../../../components/custom-controls";
import { WelcomeScreen } from "../../../components/dialogs/welcome-screen";
import { RightControls } from "../../../components/right-controls";
import { WorkspaceSelector } from "../../../components/workspace-selector";
import {
  canRedo,
  canUndo,
  redo,
  undo,
  useKanbanStore,
} from "../store/kanban-store";
import { useShowWelcomeScreen } from "../store/selectors";
import type { BoardNode } from "../types";
import { nodeTypes } from "./board-node";
import { BulkActionsBar } from "./bulk-actions-bar";

type KanbanNode = Node<BoardNode["data"]>;
type TaskModalNode = Node<{ modalId: string }>;
type CanvasNode = KanbanNode | TaskModalNode;

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
  const createTaskModals = useKanbanStore((state) => state.createTaskModals);
  const showWelcomeScreen = useShowWelcomeScreen();

  // Build nodes from normalized state (boards + modal nodes)
  const nodes: CanvasNode[] = useMemo(() => {
    // Get board IDs for current workspace
    const currentWorkspace = currentWorkspaceId
      ? workspaces.byId[currentWorkspaceId]
      : null;

    const boardIds = currentWorkspace?.board_ids ?? boards.allIds;

    const boardNodes: KanbanNode[] = boardIds
      .filter((boardId) => {
        const board = boards.byId[boardId];
        const position = boardPositions.byId[boardId];
        // Must have both board and position, and match workspace if set
        return (
          board &&
          position &&
          (!currentWorkspaceId || board.workspace_id === currentWorkspaceId)
        );
      })
      .map((boardId) => {
        const position = boardPositions.byId[boardId];
        // position is guaranteed to exist by the filter above, but TypeScript doesn't know
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

    // Create modal nodes
    const modalNodes: TaskModalNode[] = Object.values(createTaskModals).map(
      (modal) => ({
        id: `modal-${modal.id}`,
        type: "taskModal",
        position: { x: modal.position.x, y: modal.position.y },
        data: { modalId: modal.id },
        style: { zIndex: 1000 + modal.zIndex },
        draggable: true,
      })
    );

    return [...boardNodes, ...modalNodes];
  }, [
    boards,
    boardPositions,
    currentWorkspaceId,
    workspaces,
    selectedBoardId,
    createTaskModals,
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
    // Don't register keyboard handlers when welcome screen is visible
    if (showWelcomeScreen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
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

      // Sync position and dimension changes back to the store
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          // Check if it's a modal node (id starts with "modal-")
          if (change.id.startsWith("modal-")) {
            const modalId = change.id.replace("modal-", "");
            updateModalPosition(modalId, change.position);
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

  // Sync nodes from store when they change
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
              if (node.data?.isSelected || node.selected) {
                return "var(--primary)";
              }
              return "var(--secondary)";
            }}
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
