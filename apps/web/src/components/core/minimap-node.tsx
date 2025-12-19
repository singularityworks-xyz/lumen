"use client";

import type { MiniMapNodeProps } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { memo, useCallback } from "react";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";

const WORD_SPLIT_REGEX = /\s+/;

const getInitials = (name: string): string => {
  const words = name.trim().split(WORD_SPLIT_REGEX);
  if (words.length >= 2) {
    return (words[0]?.[0] ?? "") + (words[1]?.[0] ?? "");
  }
  return name.slice(0, 2);
};

type NodeInfo =
  | { type: "board"; boardId: string }
  | { type: "createTaskModal"; modalId: string }
  | { type: "editBoardModal"; modalId: string }
  | { type: "taskDetailModal"; modalId: string }
  | { type: "unknown" };

const parseNodeId = (id: string): NodeInfo => {
  if (id.startsWith("modal-")) {
    return { type: "createTaskModal", modalId: id.replace("modal-", "") };
  }
  if (id.startsWith("edit-board-modal-")) {
    return {
      type: "editBoardModal",
      modalId: id.replace("edit-board-modal-", ""),
    };
  }
  if (id.startsWith("task-detail-modal-")) {
    return {
      type: "taskDetailModal",
      modalId: id.replace("task-detail-modal-", ""),
    };
  }
  return { type: "board", boardId: id };
};

export const MiniMapNode = memo(
  ({
    id,
    x,
    y,
    width,
    height,
    color,
    strokeColor,
    strokeWidth,
    borderRadius,
    selected,
  }: MiniMapNodeProps) => {
    const { setViewport, getNode } = useReactFlow();
    const boardsById = useKanbanStore((state) => state.boards.byId);
    const tasksById = useKanbanStore((state) => state.tasks.byId);
    const createTaskModals = useKanbanStore((state) => state.createTaskModals);
    const taskDetailModals = useKanbanStore((state) => state.taskDetailModals);

    const handleClick = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        const targetNode = getNode(id);
        if (!targetNode) {
          return;
        }

        const nodeWidth = targetNode.measured?.width ?? width;
        const nodeHeight = targetNode.measured?.height ?? height;
        const centerX = targetNode.position.x + nodeWidth / 2;
        const centerY = targetNode.position.y + nodeHeight / 2;

        setViewport(
          {
            x: -centerX + window.innerWidth / 2,
            y: -centerY + window.innerHeight / 2,
            zoom: 1,
          },
          { duration: 300 }
        );
      },
      [id, getNode, setViewport, width, height]
    );

    const nodeInfo = parseNodeId(id);

    let initials = "";
    let nodeColor = color ?? "var(--secondary)";

    if (nodeInfo.type === "board") {
      const board = boardsById[nodeInfo.boardId];
      if (board) {
        initials = getInitials(board.name).toUpperCase();
      }
    } else if (nodeInfo.type === "createTaskModal") {
      const modal = createTaskModals[nodeInfo.modalId];
      if (modal) {
        const board = boardsById[modal.boardId];
        initials = board ? getInitials(board.name).toUpperCase() : "NT";
        nodeColor = "var(--primary)";
      }
    } else if (nodeInfo.type === "taskDetailModal") {
      const modal = taskDetailModals[nodeInfo.modalId];
      if (modal) {
        const task = tasksById[modal.taskId];
        initials = task ? getInitials(task.title).toUpperCase() : "TD";
        nodeColor = "var(--primary)";
      }
    }

    const fillColor = selected ? "var(--primary)" : nodeColor;
    const fontSize = Math.max(Math.min(width, height) * 0.3, 8);
    const textX = x + width / 2;
    const textY = y + height / 2;

    if (!initials) {
      return (
        // biome-ignore lint/a11y/useSemanticElements: SVG elements cannot be replaced with semantic HTML
        <rect
          className="cursor-pointer"
          fill={fillColor}
          height={height}
          onClick={handleClick}
          role="button"
          rx={borderRadius}
          ry={borderRadius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          width={width}
          x={x}
          y={y}
        />
      );
    }

    return (
      // biome-ignore lint/a11y/useSemanticElements: SVG elements cannot be replaced with semantic HTML
      <g className="cursor-pointer" onClick={handleClick} role="button">
        <rect
          fill={fillColor}
          height={height}
          rx={borderRadius}
          ry={borderRadius}
          stroke={selected ? "var(--primary)" : strokeColor}
          strokeWidth={selected ? 2 : strokeWidth}
          width={width}
          x={x}
          y={y}
        />
        <text
          dominantBaseline="central"
          fill="white"
          fontSize={fontSize}
          fontWeight="700"
          pointerEvents="none"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
          textAnchor="middle"
          x={textX}
          y={textY}
        >
          {initials}
        </text>
      </g>
    );
  }
);

MiniMapNode.displayName = "MiniMapNode";
