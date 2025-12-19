"use client";

import { useReactFlow } from "@xyflow/react";
import { Edit3, Minus, Trash2 } from "lucide-react";
import { memo, useCallback } from "react";
import { useKanbanStore } from "../features/kanban/store";
import { BaseContextMenu, type ContextMenuItem } from "./base-context-menu";

type EdgeContextMenuProps = {
  edgeId: string;
  x: number;
  y: number;
  onClose: () => void;
};

export const EdgeContextMenu = memo(
  ({ edgeId, x, y, onClose }: EdgeContextMenuProps) => {
    const removeConnection = useKanbanStore((state) => state.removeConnection);
    const toggleConnectionLineStyle = useKanbanStore(
      (state) => state.toggleConnectionLineStyle
    );
    const { getEdge } = useReactFlow();

    const edge = getEdge(edgeId);

    const handleEditLabel = useCallback(() => {
      onClose();
    }, [onClose]);

    const handleToggleLineStyle = useCallback(() => {
      toggleConnectionLineStyle(edgeId);
      onClose();
    }, [edgeId, toggleConnectionLineStyle, onClose]);

    const handleDelete = useCallback(() => {
      removeConnection(edgeId);
      onClose();
    }, [edgeId, removeConnection, onClose]);

    const items: ContextMenuItem[] = [
      {
        id: "edit-label",
        label: "Edit Label",
        icon: Edit3,
        onClick: handleEditLabel,
      },
      {
        id: "toggle-style",
        label: edge?.data?.lineStyle === "solid" ? "Make Dotted" : "Make Solid",
        icon: Minus,
        onClick: handleToggleLineStyle,
        showDividerAfter: true,
      },
      {
        id: "delete",
        label: "Delete Connection",
        icon: Trash2,
        onClick: handleDelete,
        variant: "destructive",
      },
    ];

    return <BaseContextMenu items={items} onClose={onClose} x={x} y={y} />;
  }
);

EdgeContextMenu.displayName = "EdgeContextMenu";
