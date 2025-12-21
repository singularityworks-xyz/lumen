"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { ArrowLeft, Columns, GripHorizontal, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";
import { ICON_MAP } from "../../features/kanban/utils/color-icon-utils";
import { TaskDetailForm } from "./task-detail-form";
import { TaskViewForm } from "./task-view-form";

type TaskDetailModalNodeData = {
  modalId: string;
};

type TaskDetailModalNodeProps = NodeProps<Node<TaskDetailModalNodeData>>;

const MODAL_WIDTH = 400;

export const TaskDetailModalNodeComponent = memo<TaskDetailModalNodeProps>(
  ({ data, selected }) => {
    const { screenToFlowPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [mounted, setMounted] = useState(false);

    const modalState = useKanbanStore(
      (state) => state.taskDetailModals[data.modalId]
    );
    const task = useKanbanStore((state) =>
      modalState ? state.tasks.byId[modalState.taskId] : null
    );
    const board = useKanbanStore((state) =>
      modalState ? state.boards.byId[modalState.boardId] : null
    );
    const columns = useKanbanStore((state) => state.columns);
    const closeTaskDetailModal = useKanbanStore(
      (state) => state.closeTaskDetailModal
    );
    const bringTaskDetailModalToFront = useKanbanStore(
      (state) => state.bringTaskDetailModalToFront
    );
    const shakingModalId = useKanbanStore(
      (state) => state.shakingTaskDetailModalId
    );

    const boardPosition = useKanbanStore((state) =>
      modalState?.boardId ? state.boardPositions.byId[modalState.boardId] : null
    );

    const column = task ? columns.byId[task.column_id] : null;

    useEffect(() => {
      setMounted(true);
    }, []);

    const [updateTrigger, forceUpdate] = useState(0);

    useEffect(() => {
      const handleViewportChange = () => {
        forceUpdate((n) => n + 1);
      };

      const reactFlowPane = document.querySelector(".react-flow__pane");

      if (reactFlowPane) {
        reactFlowPane.addEventListener("wheel", handleViewportChange, {
          passive: true,
        });
        reactFlowPane.addEventListener("mousedown", handleViewportChange);
        reactFlowPane.addEventListener("mousemove", handleViewportChange, {
          passive: true,
        });
      }

      window.addEventListener("resize", handleViewportChange);

      return () => {
        if (reactFlowPane) {
          reactFlowPane.removeEventListener("wheel", handleViewportChange);
          reactFlowPane.removeEventListener("mousedown", handleViewportChange);
          reactFlowPane.removeEventListener("mousemove", handleViewportChange);
        }
        window.removeEventListener("resize", handleViewportChange);
      };
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: False positive
    const connectorState = useMemo(() => {
      // Access viewport values to ensure re-calculation on transform changes
      const _vp = { vpX, vpY, vpZoom };
      // Access boardPosition to trigger recalc when board moves
      const _bp = boardPosition;

      if (!(modalState?.sourceTaskId && modalState?.position)) {
        return null;
      }

      // Find source task element via data attribute
      const sourceTaskElement = document.querySelector(
        `[data-task-id="${modalState.sourceTaskId}"]`
      );

      if (!sourceTaskElement) {
        return null;
      }

      const sourceRect = sourceTaskElement.getBoundingClientRect();

      // Convert task card's screen position to canvas position
      const taskCanvasPos = screenToFlowPosition({
        x: sourceRect.right,
        y: sourceRect.top + sourceRect.height / 2,
      });

      // Modal position is already in canvas coordinates
      const modalPos = modalState.position;

      // Calculate offset from modal's top-left corner (where the SVG will be anchored)
      // The line goes FROM the task TO the modal's left edge
      const startX = taskCanvasPos.x - modalPos.x;
      const startY = taskCanvasPos.y - modalPos.y;
      const endX = 0;
      const endY = 24;

      return { startX, startY, endX, endY };
    }, [
      modalState?.sourceTaskId,
      modalState?.position,
      boardPosition,
      screenToFlowPosition,
      vpX,
      vpY,
      vpZoom,
      updateTrigger,
    ]);

    const isShaking = shakingModalId === data.modalId;

    const [isFocused, setIsFocused] = useState(false);
    const [isEditing, setIsEditing] = useState(
      modalState?.initialIsEditing ?? false
    );

    const handleMouseDown = useCallback(() => {
      bringTaskDetailModalToFront(data.modalId);
    }, [data.modalId, bringTaskDetailModalToFront]);

    const handleBackToView = useCallback(() => {
      setIsEditing(false);
    }, []);

    if (!(modalState && task && board)) {
      return null;
    }

    const renderConnectorLine = () => {
      if (modalState?.openedFromQuickActions) {
        return null;
      }
      if (!(mounted && connectorState)) {
        return null;
      }

      const { startX, startY, endX, endY } = connectorState;
      const dx = Math.abs(endX - startX);
      const controlOffset = Math.min(dx * 0.4, 60);
      const controlX1 = startX + controlOffset;
      const controlX2 = endX - controlOffset;

      return (
        <svg
          className="pointer-events-none absolute overflow-visible"
          style={{
            left: 0,
            top: 0,
            width: 1,
            height: 1,
          }}
        >
          <title>Connector line</title>
          <path
            className={column?.accentColor ? undefined : "stroke-primary"}
            d={`M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`}
            fill="none"
            stroke={column?.accentColor}
            strokeLinecap="round"
            strokeOpacity="0.7"
            strokeWidth={2 / vpZoom}
          />
        </svg>
      );
    };

    return (
      <>
        {renderConnectorLine()}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Node wrapper needs mouse handler */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Node wrapper needs mouse handler */}
        <div
          className={cn(
            "flex flex-col overflow-hidden rounded-lg bg-card transition-all",
            selected || isFocused
              ? "shadow-xl ring-2 ring-primary/50"
              : "shadow-lg ring-1 ring-border/50",
            "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.05)]",
            isShaking && "animate-shake"
          )}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsFocused(false);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onMouseDown={handleMouseDown}
          style={{
            width: MODAL_WIDTH,
          }}
        >
          <div
            className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            style={
              column?.accentColor
                ? {
                    background: `linear-gradient(to right, ${column.accentColor}15, ${column.accentColor}08, transparent)`,
                  }
                : {}
            }
          >
            <div className="flex items-center gap-2">
              {isEditing ? (
                <button
                  className="nodrag flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-primary/20 hover:text-primary dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                  onClick={handleBackToView}
                  type="button"
                >
                  <ArrowLeft className="h-3 w-3" />
                </button>
              ) : (
                <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded font-medium text-[10px]",
                  !column?.accentColor &&
                    "bg-violet-500/20 text-violet-600 dark:text-violet-400"
                )}
                style={
                  column?.accentColor
                    ? {
                        backgroundColor: `${column.accentColor}25`,
                        color: column.accentColor,
                      }
                    : {}
                }
              >
                {(() => {
                  const IconComponent = column?.icon
                    ? ICON_MAP[column.icon]
                    : null;
                  if (IconComponent) {
                    return <IconComponent className="h-3 w-3" />;
                  }
                  return <Columns className="h-3 w-3" />;
                })()}
              </span>
              <span
                className="max-w-32 truncate font-semibold text-xs"
                title={task.title}
              >
                {task.title}
              </span>
            </div>
            <button
              className="nodrag ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              onClick={() => closeTaskDetailModal(data.modalId)}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="nodrag nowheel nopan max-h-[70vh] overflow-y-auto">
            {isEditing ? (
              <TaskDetailForm
                boardId={modalState.boardId}
                modalId={data.modalId}
                onCancel={handleBackToView}
                onSaved={handleBackToView}
                task={task}
              />
            ) : (
              <TaskViewForm
                boardId={modalState.boardId}
                modalId={data.modalId}
                onEdit={() => setIsEditing(true)}
                task={task}
              />
            )}
          </div>
        </div>
      </>
    );
  }
);

TaskDetailModalNodeComponent.displayName = "TaskDetailModalNode";
