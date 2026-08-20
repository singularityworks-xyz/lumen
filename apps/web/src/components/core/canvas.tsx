"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type EdgeChange,
  type EdgeTypes,
  MiniMap,
  type OnNodesChange,
  ReactFlow,
  SelectionMode,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// biome-ignore lint/suspicious/noTsIgnore: added because of CSS import & VSCode false positive
// @ts-ignore: False positive due to CSS import
import "@xyflow/react/dist/style.css";
import {
  type BoardEdge,
  BoardEdgeComponent,
} from "@/src/components/core/board-edge";
import { nodeTypes } from "@/src/components/core/node-types";
import { CustomControls } from "@/src/components/custom-controls";
import { EdgeContextMenu } from "@/src/components/edge-context-menu";
import { RightControls } from "@/src/components/right-controls";
import { TaskDragOverlayContainer } from "@/src/components/tasks/task-drag-overlay-container";
import { CursorOverlay, useCollaboration } from "@/src/features/collab";
import { CommentClusterNode } from "@/src/features/comments/components/comment-cluster-node";
import { BulkActionsBar } from "@/src/features/kanban/components/bulk-actions-bar";
import { CollaboratorSelectionOverlayScreen } from "@/src/features/kanban/components/collaborator-selection-overlay-screen";
import { ColumnDragOverlayContainer } from "@/src/features/kanban/components/column-drag-overlay-container";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { useShowWelcomeScreen } from "@/src/features/kanban/store/selectors";
import { calculateBoardWidth } from "@/src/features/kanban/utils/board-resize-rules";
import { WorkspaceSelector } from "@/src/features/workspace/components/workspace-selector";
import { useCanvasEdges } from "./helpers/canvas-edges";
import {
  useColumnDragHandlers,
  useKeyboardHandlers,
  useNodeDragHandlers,
  useSelectionHandlers,
  useViewportHandlers,
} from "./helpers/canvas-handlers";
import { useCanvasNodes } from "./helpers/canvas-nodes";
import {
  type CanvasNode,
  ColumnDragContext,
  ColumnDragOverlay,
} from "./helpers/canvas-types";
import { MiniMapNode } from "./minimap-node";
import { SelectionContextMenu } from "./selection-context-menu";
import { TaskConnectionLayer } from "./task-connection-layer";
import { WELCOME_NODE_ID, WelcomeNode } from "./welcome-node";

const TARGET_HANDLE_SUFFIX = /-target$/;
const SOURCE_HANDLE_SUFFIX = /-source$/;

export function KanbanCanvas() {
  const currentWorkspaceId = useKanbanStore((s) => s.currentWorkspaceId);
  const isGuestMode = useKanbanStore((s) => s.isGuestMode);
  const boards = useKanbanStore((s) => s.boards);
  const workspaces = useKanbanStore((s) => s.workspaces);
  const showMiniMap = useKanbanStore((s) => s.showMiniMap);
  const interactionMode = useKanbanStore((s) => s.interactionMode);
  const setInteractionMode = useKanbanStore((s) => s.setInteractionMode);
  const clearBoardSelection = useKanbanStore((s) => s.clearBoardSelection);
  const canvas = useKanbanStore((s) => s.canvas);
  const setViewport = useKanbanStore((s) => s.setViewport);
  const _updateBoardPosition = useKanbanStore((s) => s.updateBoardPosition);
  const updateAreaDimensions = useKanbanStore((s) => s.updateAreaDimensions);
  const finalizeAreaDrag = useKanbanStore((s) => s.finalizeAreaDrag);
  const finalizeBoardDrag = useKanbanStore((s) => s.finalizeBoardDrag);
  const updateComments = useKanbanStore((s) => s.updateComments);
  const finalizeCommentsDrag = useKanbanStore((s) => s.finalizeCommentsDrag);
  const moveColumn = useKanbanStore((s) => s.moveColumn);
  const moveColumnToBoard = useKanbanStore((s) => s.moveColumnToBoard);
  const columns = useKanbanStore((s) => s.columns);
  const addConnection = useKanbanStore((s) => s.addConnection);
  const removeConnection = useKanbanStore((s) => s.removeConnection);
  const focusedBoardId = useKanbanStore((s) => s.canvas.focusedBoardId);
  const setFocusedBoard = useKanbanStore((s) => s.setFocusedBoard);
  const showWelcomeScreen = useShowWelcomeScreen();
  const hasBoardsInCurrentWorkspace = currentWorkspaceId
    ? (workspaces.byId[currentWorkspaceId]?.board_ids?.length ?? 0) > 0
    : boards.allIds.length > 0;

  const {
    screenToFlowPosition,
    flowToScreenPosition,
    setViewport: setReactFlowViewport,
    fitView,
  } = useReactFlow();
  const {
    collaborators,
    updateCursor,
    isCollaborating,
    updateSelection,
    updateOpenDialogs,
  } = useCollaboration();

  const { nodes: storeNodes, commentClusters } = useCanvasNodes();
  const edges = useCanvasEdges();

  const {
    activeColumnData,
    activeColumnDataRef,
    handleColumnDragStart,
    handleColumnDragEnd,
    updateColumnDragPosition,
  } = useColumnDragHandlers({ columns, boards, moveColumn, moveColumnToBoard });

  const {
    selectionBox,
    isSelectingRef,
    selectionStartRef,
    setPresenceSelectionBox,
    handleSelectionStart,
    handleCloseSelectionMenu,
    onSelectionEndWrapper,
  } = useSelectionHandlers(screenToFlowPosition);

  // Refs for zero-store-update drag strategy:
  // pendingPositionsRef accumulates node positions during drag.
  // isDraggingRef tracks active drag state to gate store sync.
  const pendingPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );
  const isDraggingRef = useRef(false);

  const { handleMoveEnd } = useViewportHandlers(setViewport);
  const { handleNodeDragStart, handleNodeDrag, handleNodeDragStop } =
    useNodeDragHandlers({
      isCollaborating,
      screenToFlowPosition,
      updateCursor,
      finalizeAreaDrag,
      finalizeBoardDrag,
      finalizeCommentsDrag,
      commentClusters,
      pendingPositionsRef,
      isDraggingRef,
    });

  // Local state for smooth React Flow interactions during drag/resize.
  // Sync with store nodes only when structural changes happen.
  const [localNodes, setLocalNodes] = useState<CanvasNode[]>(storeNodes);
  const [localEdges, setLocalEdges] = useState<BoardEdge[]>(edges);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    edgeId: string;
    x: number;
    y: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevWorkspaceIdRef = useRef(currentWorkspaceId);
  const prevNodeCountRef = useRef(storeNodes.length);
  const prevHasBoardsRef = useRef(hasBoardsInCurrentWorkspace);

  // When the workspace empties out (all boards deleted), bring the viewport
  // back to the welcome card so it is not left off-screen.
  useEffect(() => {
    if (
      !hasBoardsInCurrentWorkspace &&
      prevHasBoardsRef.current &&
      showWelcomeScreen
    ) {
      const timeoutId = setTimeout(() => {
        fitView({
          nodes: [{ id: WELCOME_NODE_ID }],
          padding: 0.2,
          duration: 300,
          maxZoom: 1,
        });
      }, 50);
      prevHasBoardsRef.current = false;
      return () => clearTimeout(timeoutId);
    }
    prevHasBoardsRef.current = hasBoardsInCurrentWorkspace;
  }, [hasBoardsInCurrentWorkspace, showWelcomeScreen, fitView]);

  // Track the previous storeNodes reference to detect changes.
  const prevStoreNodesRef = useRef(storeNodes);

  useEffect(() => {
    // Skip sync while dragging — React Flow handles visuals via localNodes
    if (isDraggingRef.current) {
      return;
    }

    // storeNodes reference only changes when useCanvasNodes produces genuinely new data.
    if (prevStoreNodesRef.current === storeNodes) {
      return;
    }
    prevStoreNodesRef.current = storeNodes;
    prevNodeCountRef.current = storeNodes.length;

    // Adopt store positions directly. Structural sigs now include x/y, so
    // cached factories rebuild with fresh positions; preserving stale local
    // positions would hide remote (guest) board movements.
    setLocalNodes(storeNodes);
  }, [storeNodes]);

  useEffect(() => {
    setLocalEdges(edges);
  }, [edges]);

  useEffect(() => {
    const handleWheel = (e: Event) => {
      const we = e as WheelEvent;
      if (we.ctrlKey || we.metaKey) {
        e.preventDefault();
      }
    };
    const reactFlowCanvas = document.querySelector(".react-flow");
    reactFlowCanvas?.addEventListener("wheel", handleWheel, { passive: false });
    return () => reactFlowCanvas?.removeEventListener("wheel", handleWheel);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: req
  useEffect(() => {
    if (!isCollaborating) {
      return;
    }
    let lastUpdateTime = 0;
    const THROTTLE_MS = 16;

    const handleMouseMove = (event: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdateTime < THROTTLE_MS) {
        return;
      }
      lastUpdateTime = now;

      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      updateCursor({ x: flowPos.x, y: flowPos.y });

      if (activeColumnDataRef.current) {
        updateColumnDragPosition(event.clientX, event.clientY);
      }

      if (isSelectingRef.current && selectionStartRef.current) {
        const currentFlowPos = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const x = Math.min(selectionStartRef.current.x, currentFlowPos.x);
        const y = Math.min(selectionStartRef.current.y, currentFlowPos.y);
        const width = Math.abs(currentFlowPos.x - selectionStartRef.current.x);
        const height = Math.abs(currentFlowPos.y - selectionStartRef.current.y);
        if (width > 0 && height > 0) {
          setPresenceSelectionBox({ x, y, width, height });
        }
      }
    };

    const handleMouseLeave = () => updateCursor(null);

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [
    isCollaborating,
    screenToFlowPosition,
    updateCursor,
    updateColumnDragPosition,
    setPresenceSelectionBox,
  ]);

  // During drag: accumulate positions in ref only, zero store writes.
  // On drag stop: flush happens in handleNodeDragStop.
  // React Flow handles smooth drag visuals via applyNodeChanges on local state.
  const handleNodesChange: OnNodesChange<CanvasNode> = useCallback(
    (changes) => {
      // Apply changes locally for smooth React Flow drag/resize visuals
      setLocalNodes((nds) => applyNodeChanges(changes, nds) as CanvasNode[]);

      for (const change of changes) {
        if (change.type === "position" && change.position) {
          const id = change.id;

          if (id.startsWith("cluster-")) {
            // Comment clusters need immediate update for delta tracking
            const cluster = commentClusters.find((c) => c.id === id);
            if (cluster) {
              const deltaX = change.position.x - cluster.centroid.x;
              const deltaY = change.position.y - cluster.centroid.y;
              updateComments(
                cluster.comments.map((c) => ({
                  id: c.id,
                  changes: { x: c.x + deltaX, y: c.y + deltaY },
                }))
              );
            }
          } else {
            // Accumulate in ref — NO store write during drag
            pendingPositionsRef.current.set(id, change.position);
          }
        }

        if (change.type === "dimensions" && change.dimensions) {
          const isMidResize = "resizing" in change && change.resizing === true;
          if (isMidResize) {
            continue;
          }

          if (change.id.startsWith("area_")) {
            updateAreaDimensions(change.id, change.dimensions);
          } else if (change.id.startsWith("tb_")) {
            useKanbanStore
              .getState()
              .updateTextBoardDimensions(change.id, change.dimensions, true);
          } else if ("resizing" in change && change.resizing === false) {
            const board = useKanbanStore.getState().boards.byId[change.id];
            const columnCount = board?.column_ids.length ?? 0;
            const exactWidth = calculateBoardWidth(columnCount);
            useKanbanStore
              .getState()
              .updateBoardDimensions(
                change.id,
                { width: exactWidth, height: change.dimensions.height },
                true
              );
          }
        }
      }
    },
    [commentClusters, updateComments, updateAreaDimensions]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<BoardEdge>[]) => {
      setLocalEdges((eds) => applyEdgeChanges(changes, eds) as BoardEdge[]);
      for (const change of changes) {
        if (change.type === "remove") {
          removeConnection(change.id);
        }
      }
    },
    [removeConnection]
  );

  const handleConnect = useCallback(
    (connection: {
      source: string | null;
      target: string | null;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (source && target) {
        const normalizeHandlePosition = (
          handle: string | null | undefined
        ): "top" | "right" | "bottom" | "left" | undefined => {
          if (!handle) {
            return;
          }
          const normalized = handle
            .replace(TARGET_HANDLE_SUFFIX, "")
            .replace(SOURCE_HANDLE_SUFFIX, "");
          if (
            normalized === "top" ||
            normalized === "right" ||
            normalized === "bottom" ||
            normalized === "left"
          ) {
            return normalized;
          }
          return;
        };
        addConnection(source, target, {
          sourceHandle: normalizeHandlePosition(sourceHandle),
          targetHandle: normalizeHandlePosition(targetHandle),
        });
      }
    },
    [addConnection]
  );

  useKeyboardHandlers({
    interactionMode,
    setInteractionMode,
    clearBoardSelection,
    localEdges,
    removeConnection,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const edgeTypes: EdgeTypes = useMemo(
    () => ({ default: BoardEdgeComponent }),
    []
  );
  const columnDragContextValue = useMemo(
    () => ({ activeColumnData }),
    [activeColumnData]
  );

  useEffect(() => {
    const prevWorkspaceId = prevWorkspaceIdRef.current;
    if (currentWorkspaceId === prevWorkspaceId) {
      return;
    }
    prevWorkspaceIdRef.current = currentWorkspaceId;
    if (!currentWorkspaceId || prevWorkspaceId === null) {
      return;
    }

    const workspace = workspaces.byId[currentWorkspaceId];
    if (!workspace) {
      return;
    }

    if (workspace.lastViewport) {
      setReactFlowViewport(workspace.lastViewport, { duration: 300 });
    } else if (workspace.lastFocusedBoardId) {
      // Read boardPositions lazily to avoid subscribing to position changes
      const bp =
        useKanbanStore.getState().boardPositions.byId[
          workspace.lastFocusedBoardId
        ];
      if (bp) {
        setReactFlowViewport(
          {
            x: -(bp.x + (bp.width ?? 400) / 2) + window.innerWidth / 2,
            y: -(bp.y + (bp.height ?? 300) / 2) + window.innerHeight / 2,
            zoom: 1,
          },
          { duration: 300 }
        );
      }
    } else {
      setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
    }
  }, [currentWorkspaceId, workspaces, setReactFlowViewport, fitView]);

  useEffect(() => {
    if (!focusedBoardId) {
      return;
    }
    const timeoutId = setTimeout(() => {
      // Read boardPositions lazily to avoid subscribing to position changes
      const bp = useKanbanStore.getState().boardPositions.byId[focusedBoardId];
      if (bp) {
        setReactFlowViewport(
          {
            x: -(bp.x + (bp.width ?? 400) / 2) + window.innerWidth / 2,
            y: -(bp.y + (bp.height ?? 300) / 2) + window.innerHeight / 2,
            zoom: 1,
          },
          { duration: 800 }
        );
      }
      setFocusedBoard(null);
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [focusedBoardId, setReactFlowViewport, setFocusedBoard]);

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: BoardEdge) => {
      event.preventDefault();
      setEdgeContextMenu({
        edgeId: edge.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isCollaborating) {
        return;
      }
      updateCursor(
        screenToFlowPosition({ x: event.clientX, y: event.clientY })
      );
    },
    [isCollaborating, screenToFlowPosition, updateCursor]
  );

  const handleCanvasMouseLeave = useCallback(() => {
    if (isCollaborating) {
      updateCursor(null);
    }
  }, [isCollaborating, updateCursor]);

  const handlePaneClick = useCallback(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      selectionStartRef.current = null;
    }
    if (isCollaborating) {
      updateSelection([]);
      updateOpenDialogs([]);
    }
  }, [
    isCollaborating,
    updateSelection,
    updateOpenDialogs,
    isSelectingRef,
    selectionStartRef,
  ]);

  const handleNavigateToUser = useCallback(
    (pos: { x: number; y: number }) => {
      setReactFlowViewport(
        {
          x: -pos.x + window.innerWidth / 2,
          y: -pos.y + window.innerHeight / 2,
          zoom: 1,
        },
        { duration: 500 }
      );
    },
    [setReactFlowViewport]
  );

  const selectionMenuProps = useMemo(() => {
    if (!(selectionBox && containerRef.current)) {
      return null;
    }
    const cr = containerRef.current.getBoundingClientRect();
    const tl = flowToScreenPosition({ x: selectionBox.x, y: selectionBox.y });
    const br = flowToScreenPosition({
      x: selectionBox.x + selectionBox.width,
      y: selectionBox.y + selectionBox.height,
    });
    return {
      x: selectionBox.x,
      y: selectionBox.y,
      width: selectionBox.width,
      height: selectionBox.height,
      screenX: br.x + 10,
      screenY: tl.y,
      ghostLeft: tl.x - cr.left,
      ghostTop: tl.y - cr.top,
      ghostWidth: br.x - tl.x,
      ghostHeight: br.y - tl.y,
    };
  }, [selectionBox, flowToScreenPosition]);

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleColumnDragEnd}
      onDragStart={handleColumnDragStart}
      sensors={sensors}
    >
      <ColumnDragContext.Provider value={columnDragContextValue}>
        {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: cursor tracking */}
        {/** biome-ignore lint/a11y/noStaticElementInteractions: cursor tracking */}
        <div
          className="relative h-full w-full"
          onMouseLeave={handleCanvasMouseLeave}
          onMouseMove={handleCanvasMouseMove}
          ref={containerRef}
        >
          <div className="fixed inset-0 -z-10 bg-background" />
          <ReactFlow
            className="relative bg-transparent"
            defaultViewport={canvas.viewport}
            edges={localEdges}
            edgeTypes={edgeTypes}
            elementsSelectable={!isGuestMode && interactionMode === "select"}
            fitView={!hasBoardsInCurrentWorkspace}
            fitViewOptions={{
              nodes: [{ id: WELCOME_NODE_ID }],
              padding: 0.2,
              maxZoom: 1,
            }}
            maxZoom={3}
            minZoom={0.1}
            noDragClassName="nodrag"
            nodeDragThreshold={3}
            nodeOrigin={[0, 0]}
            nodes={localNodes}
            nodesConnectable={!isGuestMode}
            nodesDraggable={!isGuestMode && interactionMode === "drag"}
            nodeTypes={{
              ...nodeTypes,
              commentCluster: CommentClusterNode,
              welcome: WelcomeNode,
            }}
            onConnect={isGuestMode ? undefined : handleConnect}
            onEdgeContextMenu={isGuestMode ? undefined : handleEdgeContextMenu}
            onEdgesChange={isGuestMode ? undefined : handleEdgesChange}
            onMoveEnd={handleMoveEnd}
            onNodeDrag={isGuestMode ? undefined : handleNodeDrag}
            onNodeDragStart={isGuestMode ? undefined : handleNodeDragStart}
            onNodeDragStop={isGuestMode ? undefined : handleNodeDragStop}
            onNodesChange={isGuestMode ? undefined : handleNodesChange}
            onPaneClick={isGuestMode ? undefined : handlePaneClick}
            onSelectionEnd={isGuestMode ? undefined : onSelectionEndWrapper}
            onSelectionStart={isGuestMode ? undefined : handleSelectionStart}
            panOnDrag={true}
            panOnScroll={true}
            proOptions={{ hideAttribution: true }}
            selectionKeyCode={
              !isGuestMode && interactionMode === "select" ? null : "Meta"
            }
            selectionMode={
              !isGuestMode && interactionMode === "select"
                ? SelectionMode.Partial
                : undefined
            }
            selectionOnDrag={!isGuestMode && interactionMode === "select"}
            zoomActivationKeyCode="Control"
            zoomOnScroll
          >
            <div
              className="pointer-events-none fixed inset-0"
              id="board-connector-layer"
              style={{ zIndex: 0 }}
            />
            <Background
              className="opacity-30"
              color="currentColor"
              gap={20}
              variant={BackgroundVariant.Dots}
            />
            <TaskConnectionLayer />
            {!isGuestMode && <CustomControls />}
            {!isGuestMode && showMiniMap && (
              <MiniMap
                className="rounded-lg! border-2! border-border/50! bg-card/95! shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]! backdrop-blur-md! dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]!"
                maskColor="var(--background)"
                nodeColor={(node) =>
                  ("isSelected" in node.data && node.data.isSelected) ||
                  node.selected
                    ? "var(--primary)"
                    : "var(--secondary)"
                }
                nodeComponent={MiniMapNode}
                pannable
                position="top-right"
                zoomable
              />
            )}
          </ReactFlow>
          {!isGuestMode && <WorkspaceSelector />}
          {!isGuestMode && <RightControls />}
          {!isGuestMode && <BulkActionsBar />}
          {isCollaborating && collaborators.length > 0 && (
            <CursorOverlay
              collaborators={collaborators}
              flowToScreenPosition={flowToScreenPosition}
              onNavigateToUser={handleNavigateToUser}
            />
          )}
          {!isGuestMode && edgeContextMenu && (
            <EdgeContextMenu
              edgeId={edgeContextMenu.edgeId}
              onClose={() => setEdgeContextMenu(null)}
              x={edgeContextMenu.x}
              y={edgeContextMenu.y}
            />
          )}
          {!isGuestMode && selectionBox && selectionMenuProps && (
            <SelectionContextMenu
              height={selectionMenuProps.height}
              onClose={handleCloseSelectionMenu}
              screenX={selectionMenuProps.screenX}
              screenY={selectionMenuProps.screenY}
              width={selectionMenuProps.width}
              x={selectionMenuProps.x}
              y={selectionMenuProps.y}
            />
          )}
          {!isGuestMode && selectionMenuProps && (
            <div
              className="pointer-events-none absolute z-10 rounded border-2 border-dashed bg-primary/10"
              style={{
                left: selectionMenuProps.ghostLeft,
                top: selectionMenuProps.ghostTop,
                width: selectionMenuProps.ghostWidth,
                height: selectionMenuProps.ghostHeight,
                borderColor: "var(--primary)",
              }}
            />
          )}
          {!isGuestMode && isCollaborating && (
            <CollaboratorSelectionOverlayScreen
              collaborators={collaborators}
              containerRef={containerRef}
              flowToScreenPosition={flowToScreenPosition}
            />
          )}
          {!isGuestMode && <TaskDragOverlayContainer />}
          {!isGuestMode && <ColumnDragOverlayContainer />}
        </div>
      </ColumnDragContext.Provider>
      <DragOverlay dropAnimation={null}>
        {!isGuestMode && activeColumnData && (
          <ColumnDragOverlay
            columnName={activeColumnData.columnName}
            taskCount={activeColumnData.taskCount}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

// Re-export for backwards compatibility
// biome-ignore lint/performance/noBarrelFile: Legacy export
export {
  ColumnDragContext,
  useColumnDragContext,
} from "./helpers/canvas-types";
