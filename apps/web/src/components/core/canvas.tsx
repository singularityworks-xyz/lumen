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
  Background,
  BackgroundVariant,
  type EdgeTypes,
  MiniMap,
  type OnNodesChange,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
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
import { CustomControls } from "@/src/components/custom-controls";
import { WelcomeScreen } from "@/src/components/dialogs/welcome-screen";
import { EdgeContextMenu } from "@/src/components/edge-context-menu";
import { RightControls } from "@/src/components/right-controls";
import { TaskDragOverlayContainer } from "@/src/components/tasks/task-drag-overlay-container";
import { CursorOverlay, useCollaboration } from "@/src/features/collab";
import { CommentClusterNode } from "@/src/features/comments/components/comment-cluster-node";
import { nodeTypes } from "@/src/features/kanban/components/board-node";
import { BulkActionsBar } from "@/src/features/kanban/components/bulk-actions-bar";
import { CollaboratorSelectionOverlayScreen } from "@/src/features/kanban/components/collaborator-selection-overlay-screen";
import { ColumnDragOverlayContainer } from "@/src/features/kanban/components/column-drag-overlay-container";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { useShowWelcomeScreen } from "@/src/features/kanban/store/selectors";
import { WorkspaceSelector } from "@/src/features/workspace/components/workspace-selector";
import { useCanvasEdges } from "./helpers/canvas-edges";
import {
  useColumnDragHandlers,
  useEdgeHandlers,
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

const DRAG_ATTACH_PADDING = 20;

export function KanbanCanvas() {
  const currentWorkspaceId = useKanbanStore((s) => s.currentWorkspaceId);
  const boards = useKanbanStore((s) => s.boards);
  const boardPositions = useKanbanStore((s) => s.boardPositions);
  const workspaces = useKanbanStore((s) => s.workspaces);
  const showMiniMap = useKanbanStore((s) => s.showMiniMap);
  const interactionMode = useKanbanStore((s) => s.interactionMode);
  const setInteractionMode = useKanbanStore((s) => s.setInteractionMode);
  const clearBoardSelection = useKanbanStore((s) => s.clearBoardSelection);
  const canvas = useKanbanStore((s) => s.canvas);
  const setViewport = useKanbanStore((s) => s.setViewport);
  const updateBoardPosition = useKanbanStore((s) => s.updateBoardPosition);
  const areas = useKanbanStore((s) => s.areas);
  const areaPositions = useKanbanStore((s) => s.areaPositions);
  const updateAreaPosition = useKanbanStore((s) => s.updateAreaPosition);
  const updateAreaDimensions = useKanbanStore((s) => s.updateAreaDimensions);
  const finalizeAreaDrag = useKanbanStore((s) => s.finalizeAreaDrag);
  const finalizeBoardDrag = useKanbanStore((s) => s.finalizeBoardDrag);
  const attachBoardToArea = useKanbanStore((s) => s.attachBoardToArea);
  const detachBoardFromArea = useKanbanStore((s) => s.detachBoardFromArea);
  const updateModalPosition = useKanbanStore((s) => s.updateModalPosition);
  const updateTaskDetailModalPosition = useKanbanStore(
    (s) => s.updateTaskDetailModalPosition
  );
  const updateComments = useKanbanStore((s) => s.updateComments);
  const finalizeCommentsDrag = useKanbanStore((s) => s.finalizeCommentsDrag);
  const moveColumn = useKanbanStore((s) => s.moveColumn);
  const moveColumnToBoard = useKanbanStore((s) => s.moveColumnToBoard);
  const columns = useKanbanStore((s) => s.columns);
  const addConnection = useKanbanStore((s) => s.addConnection);
  const removeConnection = useKanbanStore((s) => s.removeConnection);
  const updateBoardQuickActionsPosition = useKanbanStore(
    (s) => s.updateBoardQuickActionsPosition
  );
  const updateBoardDialogPosition = useKanbanStore(
    (s) => s.updateBoardDialogPosition
  );
  const updateConnectionDialogPosition = useKanbanStore(
    (s) => s.updateConnectionDialogPosition
  );
  const updateColumnDialogPosition = useKanbanStore(
    (s) => s.updateColumnDialogPosition
  );
  const updateColumnQuickActionsPosition = useKanbanStore(
    (s) => s.updateColumnQuickActionsPosition
  );
  const updateTaskQuickActionsPosition = useKanbanStore(
    (s) => s.updateTaskQuickActionsPosition
  );
  const updateAreaDialogPosition = useKanbanStore(
    (s) => s.updateAreaDialogPosition
  );
  const focusedBoardId = useKanbanStore((s) => s.canvas.focusedBoardId);
  const setFocusedBoard = useKanbanStore((s) => s.setFocusedBoard);
  const showWelcomeScreen = useShowWelcomeScreen();

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

  const { nodes, commentClusters } = useCanvasNodes();
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

  const { handleMoveEnd } = useViewportHandlers(setViewport);
  const { handleNodeDrag, handleNodeDragStop } = useNodeDragHandlers({
    isCollaborating,
    screenToFlowPosition,
    updateCursor,
    finalizeAreaDrag,
    finalizeBoardDrag,
    finalizeCommentsDrag,
    commentClusters,
  });

  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    edgeId: string;
    x: number;
    y: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevWorkspaceIdRef = useRef(currentWorkspaceId);
  const { handleEdgesChange, handleConnect } = useEdgeHandlers({
    onEdgesChange,
    addConnection,
    removeConnection,
  });

  useKeyboardHandlers({
    interactionMode,
    setInteractionMode,
    clearBoardSelection,
    localEdges,
    removeConnection,
    showWelcomeScreen,
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
      const boardPos = boardPositions.byId[workspace.lastFocusedBoardId];
      if (boardPos) {
        setReactFlowViewport(
          {
            x:
              -(boardPos.x + (boardPos.width ?? 400) / 2) +
              window.innerWidth / 2,
            y:
              -(boardPos.y + (boardPos.height ?? 300) / 2) +
              window.innerHeight / 2,
            zoom: 1,
          },
          { duration: 300 }
        );
      }
    } else {
      setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
    }
  }, [
    currentWorkspaceId,
    workspaces,
    boardPositions,
    setReactFlowViewport,
    fitView,
  ]);

  useEffect(() => {
    if (!focusedBoardId) {
      return;
    }
    const timeoutId = setTimeout(() => {
      const boardPos = boardPositions.byId[focusedBoardId];
      if (boardPos) {
        setReactFlowViewport(
          {
            x:
              -(boardPos.x + (boardPos.width ?? 400) / 2) +
              window.innerWidth / 2,
            y:
              -(boardPos.y + (boardPos.height ?? 300) / 2) +
              window.innerHeight / 2,
            zoom: 1,
          },
          { duration: 800 }
        );
      }
      setFocusedBoard(null);
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [focusedBoardId, boardPositions, setReactFlowViewport, setFocusedBoard]);

  useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes, setLocalNodes]);
  useEffect(() => {
    setLocalEdges(edges);
  }, [edges, setLocalEdges]);

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: req
  const handleNodesChange: OnNodesChange<CanvasNode> = useCallback(
    (changes) => {
      onNodesChange(changes);

      for (const change of changes) {
        if (change.type === "position" && change.position) {
          const id = change.id;

          if (id.startsWith("area_")) {
            updateAreaPosition(id, change.position);
          } else if (id.startsWith("modal-")) {
            updateModalPosition(id.replace("modal-", ""), change.position);
          } else if (id.startsWith("task-detail-modal-")) {
            updateTaskDetailModalPosition(
              id.replace("task-detail-modal-", ""),
              change.position
            );
          } else if (id.startsWith("task-quick-actions-")) {
            updateTaskQuickActionsPosition(
              id.replace("task-quick-actions-", ""),
              change.position
            );
          } else if (id.startsWith("column-quick-actions-")) {
            updateColumnQuickActionsPosition(
              id.replace("column-quick-actions-", ""),
              change.position
            );
          } else if (id.startsWith("quick-actions-")) {
            updateBoardQuickActionsPosition(
              id.replace("quick-actions-", ""),
              change.position
            );
          } else if (id.startsWith("board-dialog-")) {
            updateBoardDialogPosition(
              id.replace("board-dialog-", ""),
              change.position
            );
          } else if (id.startsWith("connection-dialog-")) {
            updateConnectionDialogPosition(change.position);
          } else if (id.startsWith("column-dialog-")) {
            updateColumnDialogPosition(
              id.replace("column-dialog-", ""),
              change.position
            );
          } else if (id.startsWith("area-dialog-")) {
            updateAreaDialogPosition(
              id.replace("area-dialog-", ""),
              change.position
            );
          } else if (id.startsWith("cluster-")) {
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
            // Board position - handle area parenting
            let absPos = change.position;
            const freshState = useKanbanStore.getState();
            for (const areaId of freshState.areas.allIds) {
              const area = freshState.areas.byId[areaId];
              if (area?.board_ids?.includes(id)) {
                const areaPos = freshState.areaPositions.byId[areaId];
                if (areaPos) {
                  absPos = {
                    x: areaPos.x + change.position.x,
                    y: areaPos.y + change.position.y,
                  };
                }
                break;
              }
            }
            updateBoardPosition(id, absPos);

            // Area attach/detach logic for boards
            if (id.startsWith("board_")) {
              const boardPos = boardPositions.byId[id];
              if (boardPos) {
                const bw = boardPos.width ?? 300,
                  bh = boardPos.height ?? 200;
                const cx = absPos.x,
                  cy = absPos.y;
                const bcx = cx + bw / 2,
                  bcy = cy + bh / 2;

                let foundAreaId: string | null = null;
                let closestDistance = Number.POSITIVE_INFINITY;
                for (const areaId of areaPositions.allIds) {
                  const ap = areaPositions.byId[areaId];
                  if (
                    ap &&
                    bcx >= ap.x - DRAG_ATTACH_PADDING &&
                    bcx <= ap.x + ap.width + DRAG_ATTACH_PADDING &&
                    bcy >= ap.y - DRAG_ATTACH_PADDING &&
                    bcy <= ap.y + ap.height + DRAG_ATTACH_PADDING
                  ) {
                    const areaCenterX = ap.x + ap.width / 2;
                    const areaCenterY = ap.y + ap.height / 2;
                    const distanceToAreaCenter = Math.hypot(
                      bcx - areaCenterX,
                      bcy - areaCenterY
                    );

                    if (distanceToAreaCenter < closestDistance) {
                      closestDistance = distanceToAreaCenter;
                      foundAreaId = areaId;
                    }
                  }
                }
                if (foundAreaId) {
                  attachBoardToArea(foundAreaId, id);
                } else {
                  for (const areaId of areas.allIds) {
                    if (areas.byId[areaId]?.board_ids?.includes(id)) {
                      detachBoardFromArea(areaId, id);
                    }
                  }
                }
              }
            }
          }
        }

        if (change.type === "dimensions" && change.dimensions) {
          // Handle mid-resize (resizing: true): skip entirely — React Flow's
          // internal state already reflects these via onNodesChange above.
          const isMidResize = "resizing" in change && change.resizing === true;
          if (isMidResize) {
            continue;
          }

          if (change.id.startsWith("area_")) {
            updateAreaDimensions(change.id, change.dimensions);
          } else if ("resizing" in change && change.resizing === false) {
            // User resize ended — persist final dimensions to store.
            useKanbanStore
              .getState()
              .updateBoardDimensions(change.id, change.dimensions, true);
          }
          // For initial measurements (no `resizing` property): skip to avoid
          // polluting the zundo undo history. Board-node auto-resize effect
          // keeps store in sync for content-driven dimension changes.
        }
      }
    },
    [onNodesChange, commentClusters, areas, areaPositions, boardPositions]
  );

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
            elementsSelectable={
              !showWelcomeScreen && interactionMode === "select"
            }
            fitView={nodes.length === 0}
            maxZoom={3}
            minZoom={0.1}
            noDragClassName="nodrag"
            nodeDragThreshold={3}
            nodeOrigin={[0, 0]}
            nodes={localNodes}
            nodesConnectable={!showWelcomeScreen}
            nodesDraggable={!showWelcomeScreen && interactionMode === "drag"}
            nodeTypes={{ ...nodeTypes, commentCluster: CommentClusterNode }}
            onConnect={handleConnect}
            onEdgeContextMenu={handleEdgeContextMenu}
            onEdgesChange={handleEdgesChange}
            onMoveEnd={handleMoveEnd}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            onNodesChange={handleNodesChange}
            onPaneClick={handlePaneClick}
            onSelectionEnd={onSelectionEndWrapper}
            onSelectionStart={handleSelectionStart}
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
            <CustomControls />
            {showMiniMap && (
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
          <WelcomeScreen />
          <WorkspaceSelector />
          <RightControls />
          <BulkActionsBar />
          {isCollaborating && collaborators.length > 0 && (
            <CursorOverlay
              collaborators={collaborators}
              flowToScreenPosition={flowToScreenPosition}
              onNavigateToUser={handleNavigateToUser}
            />
          )}
          {edgeContextMenu && (
            <EdgeContextMenu
              edgeId={edgeContextMenu.edgeId}
              onClose={() => setEdgeContextMenu(null)}
              x={edgeContextMenu.x}
              y={edgeContextMenu.y}
            />
          )}
          {selectionBox && selectionMenuProps && (
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
          {selectionMenuProps && (
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
          {isCollaborating && (
            <CollaboratorSelectionOverlayScreen
              collaborators={collaborators}
              containerRef={containerRef}
              flowToScreenPosition={flowToScreenPosition}
            />
          )}
          <TaskDragOverlayContainer />
          <ColumnDragOverlayContainer />
        </div>
      </ColumnDragContext.Provider>
      <DragOverlay dropAnimation={null}>
        {activeColumnData && (
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
