"use client";

import { useNodes, useReactFlow, useViewport } from "@xyflow/react";
import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useKanbanStore } from "@/src/features/kanban/store";
import { Z_INDEX_BASE } from "@/src/features/kanban/store/slices/z-index-slice";

export const TaskConnectionLayer = memo(() => {
  const { flowToScreenPosition } = useReactFlow();
  const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
  const nodes = useNodes();
  const [mounted, setMounted] = useState(false);
  const [connectorLayerTarget, setConnectorLayerTarget] =
    useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setConnectorLayerTarget(document.getElementById("board-connector-layer"));
  }, []);

  const taskDetailModals = useKanbanStore((state) => state.taskDetailModals);
  const tasks = useKanbanStore((state) => state.tasks);
  const columns = useKanbanStore((state) => state.columns);
  const boardPositions = useKanbanStore((state) => state.boardPositions);
  const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);

  const connections = useMemo(() => {
    const _vp = { vpX, vpY, vpZoom };
    const _nodes = nodes;

    const result: Array<{
      id: string;
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      color: string | undefined;
      zIndex: number;
      isTopmost: boolean;
    }> = [];

    for (const modal of Object.values(taskDetailModals)) {
      if (modal.openedFromQuickActions) {
        continue;
      }

      const task = tasks.byId[modal.sourceTaskId];
      if (!task) {
        continue;
      }

      const column = columns.byId[task.column_id];
      const accentColor = column?.accentColor;
      const boardPosition = boardPositions.byId[task.board_id];
      if (!boardPosition) {
        continue;
      }

      const boardNode = nodes.find((n) => n.id === task.board_id);
      const boardFlowX = boardNode?.position.x ?? boardPosition.x;
      const boardFlowY = boardNode?.position.y ?? boardPosition.y;

      const taskElement = document.querySelector(
        `[data-task-id="${task.id}"]`
      ) as HTMLElement | null;
      const boardElement = document.querySelector(
        `.react-flow__node[data-id="${task.board_id}"]`
      ) as HTMLElement | null;

      if (!(taskElement && boardElement)) {
        continue;
      }

      const taskRect = taskElement.getBoundingClientRect();
      const boardRect = boardElement.getBoundingClientRect();

      if (
        taskRect.width === 0 ||
        taskRect.height === 0 ||
        boardRect.width === 0
      ) {
        continue;
      }

      const taskOffsetX = (taskRect.right - boardRect.left) / vpZoom;
      const taskOffsetY =
        (taskRect.top + taskRect.height / 2 - boardRect.top) / vpZoom;
      const taskFlowX = boardFlowX + taskOffsetX;
      const taskFlowY = boardFlowY + taskOffsetY;
      const taskScreenPos = flowToScreenPosition({
        x: taskFlowX,
        y: taskFlowY,
      });

      const modalNode = nodes.find(
        (n) => n.id === `task-detail-modal-${modal.id}`
      );
      const modalFlowPos = modalNode
        ? { x: modalNode.position.x, y: modalNode.position.y + 24 }
        : { x: modal.position.x, y: modal.position.y + 24 };

      const modalScreenPos = flowToScreenPosition(modalFlowPos);

      if (
        !(
          Number.isFinite(taskScreenPos.x) &&
          Number.isFinite(taskScreenPos.y) &&
          Number.isFinite(modalScreenPos.x) &&
          Number.isFinite(modalScreenPos.y)
        )
      ) {
        continue;
      }

      const dialogId = `task-detail-modal-${modal.id}`;
      const isTopmost = dialogFocusStack.at(-1) === dialogId;

      // Z-index for focused state (rendered to document.body)
      const connectorZIndex =
        Z_INDEX_BASE.DIALOGS + dialogFocusStack.length * 10 + 5;

      result.push({
        id: modal.id,
        startX: taskScreenPos.x,
        startY: taskScreenPos.y,
        endX: modalScreenPos.x,
        endY: modalScreenPos.y,
        color: accentColor,
        zIndex: connectorZIndex,
        isTopmost,
      });
    }

    return result;
  }, [
    taskDetailModals,
    tasks,
    columns,
    boardPositions,
    nodes,
    flowToScreenPosition,
    vpX,
    vpY,
    vpZoom,
    dialogFocusStack,
  ]);

  if (!mounted || connections.length === 0) {
    return null;
  }

  const focusedConnections = connections.filter((c) => c.isTopmost);
  const unfocusedConnections = connections.filter((c) => !c.isTopmost);

  const renderConnection = (conn: (typeof connections)[0]) => {
    const dx = Math.abs(conn.endX - conn.startX);
    const controlOffset = Math.min(dx * 0.4, 60);
    const controlX1 = conn.startX + controlOffset;
    const controlX2 = conn.endX - controlOffset;
    const path = `M ${conn.startX} ${conn.startY} C ${controlX1} ${conn.startY}, ${controlX2} ${conn.endY}, ${conn.endX} ${conn.endY}`;

    return (
      <svg
        className="pointer-events-none fixed top-0 left-0"
        height="100vh"
        key={conn.id}
        style={{ zIndex: conn.isTopmost ? conn.zIndex : 0 }}
        width="100vw"
      >
        <title>Connection to task detail modal</title>
        <path
          className={conn.color ? undefined : "stroke-primary"}
          d={path}
          fill="none"
          stroke={conn.color}
          strokeLinecap="round"
          strokeOpacity={conn.isTopmost ? 0.7 : 0.4}
          strokeWidth={2}
        />
      </svg>
    );
  };

  return (
    <>
      {/* Focused connections: portal to document.body for high z-index */}
      {focusedConnections.length > 0 &&
        createPortal(focusedConnections.map(renderConnection), document.body)}

      {/* Unfocused connections: portal to board-connector-layer (inside React Flow, lower z-index) */}
      {unfocusedConnections.length > 0 &&
        connectorLayerTarget &&
        createPortal(
          unfocusedConnections.map(renderConnection),
          connectorLayerTarget
        )}
    </>
  );
});

TaskConnectionLayer.displayName = "TaskConnectionLayer";
