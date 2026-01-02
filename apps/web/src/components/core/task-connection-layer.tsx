"use client";

import { useNodes, useReactFlow, useViewport } from "@xyflow/react";
import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useKanbanStore } from "@/src/features/kanban/store";

export const TaskConnectionLayer = memo(() => {
  const { flowToScreenPosition } = useReactFlow();
  const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
  const nodes = useNodes();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById("board-connector-layer"));
  }, []);

  const taskDetailModals = useKanbanStore((state) => state.taskDetailModals);
  const tasks = useKanbanStore((state) => state.tasks);
  const columns = useKanbanStore((state) => state.columns);
  const boardPositions = useKanbanStore((state) => state.boardPositions);

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

      result.push({
        id: modal.id,
        startX: taskScreenPos.x,
        startY: taskScreenPos.y,
        endX: modalScreenPos.x,
        endY: modalScreenPos.y,
        color: accentColor,
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
  ]);

  if (connections.length === 0 || !portalTarget) {
    return null;
  }

  return createPortal(
    <svg
      className="pointer-events-none fixed top-0 left-0"
      height="100vh"
      style={{ zIndex: 1500 }}
      width="100vw"
    >
      <title>Connection lines between tasks and their detail modals</title>
      {connections.map((conn) => {
        const dx = Math.abs(conn.endX - conn.startX);
        const controlOffset = Math.min(dx * 0.4, 60);
        const controlX1 = conn.startX + controlOffset;
        const controlX2 = conn.endX - controlOffset;
        const path = `M ${conn.startX} ${conn.startY} C ${controlX1} ${conn.startY}, ${controlX2} ${conn.endY}, ${conn.endX} ${conn.endY}`;

        return (
          <path
            className={conn.color ? undefined : "stroke-primary"}
            d={path}
            fill="none"
            key={conn.id}
            stroke={conn.color}
            strokeLinecap="round"
            strokeOpacity={0.7}
            strokeWidth={2}
          />
        );
      })}
    </svg>,
    portalTarget
  );
});

TaskConnectionLayer.displayName = "TaskConnectionLayer";
