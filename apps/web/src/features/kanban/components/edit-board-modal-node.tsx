"use client";

import { type Node, type NodeProps, useReactFlow } from "@xyflow/react";
import { GripHorizontal, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../store/kanban-store";

const WORD_SPLIT_REGEX = /\s+/;

const getInitials = (name: string): string =>
  name
    .split(WORD_SPLIT_REGEX)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

type EditBoardModalNodeData = {
  modalId: string;
};

type EditBoardModalNodeProps = NodeProps<Node<EditBoardModalNodeData>>;

const MODAL_WIDTH = 400;

export const EditBoardModalNodeComponent = memo<EditBoardModalNodeProps>(
  ({ id, data, selected }) => {
    const { getNode, flowToScreenPosition } = useReactFlow();
    const [mounted, setMounted] = useState(false);
    const [connectorState, setConnectorState] = useState<{
      start: { x: number; y: number };
      end: { x: number; y: number };
    } | null>(null);

    useEffect(() => {
      setMounted(true);
    }, []);

    const sourcePosition = useKanbanStore(
      (state) => state.editBoardModals[data.modalId]?.sourcePosition
    );

    useEffect(() => {
      if (!sourcePosition) {
        return;
      }

      let rAFId: number;
      const updateConnector = () => {
        const myNode = getNode(id);

        if (myNode?.measured) {
          const myScreenPos = flowToScreenPosition({
            x: myNode.position.x,
            y: myNode.position.y,
          });

          setConnectorState({
            start: sourcePosition,
            end: { x: myScreenPos.x, y: myScreenPos.y + 24 },
          });
        }
        rAFId = requestAnimationFrame(updateConnector);
      };

      updateConnector();
      return () => cancelAnimationFrame(rAFId);
    }, [id, sourcePosition, getNode, flowToScreenPosition]);
    const modalFormData = useKanbanStore(
      (state) => state.editBoardModals[data.modalId]?.formData
    );
    const modalBoardId = useKanbanStore(
      (state) => state.editBoardModals[data.modalId]?.boardId
    );
    const boardName = useKanbanStore((state) => {
      const modal = state.editBoardModals[data.modalId];
      if (!modal) {
        return "";
      }
      return state.boards.byId[modal.boardId]?.name ?? "";
    });
    const boardDescription = useKanbanStore((state) => {
      const modal = state.editBoardModals[data.modalId];
      if (!modal) {
        return "";
      }
      return state.boards.byId[modal.boardId]?.description ?? "";
    });

    const closeEditBoardModal = useKanbanStore(
      (state) => state.closeEditBoardModal
    );
    const updateEditBoardModalFormData = useKanbanStore(
      (state) => state.updateEditBoardModalFormData
    );
    const bringEditBoardModalToFront = useKanbanStore(
      (state) => state.bringEditBoardModalToFront
    );
    const updateBoard = useKanbanStore((state) => state.updateBoard);

    const [name, setName] = useState(modalFormData?.name ?? boardName);
    const [description, setDescription] = useState(
      modalFormData?.description ?? boardDescription
    );
    const [isFocused, setIsFocused] = useState(false);

    const formValuesRef = useRef({ name, description });
    formValuesRef.current = { name, description };

    useEffect(
      () => () => {
        const values = formValuesRef.current;
        updateEditBoardModalFormData(data.modalId, {
          name: values.name,
          description: values.description,
        });
      },
      [data.modalId, updateEditBoardModalFormData]
    );

    const handleSave = useCallback(() => {
      if (!modalBoardId) {
        return;
      }
      const trimmedName = name.trim() || "Untitled Board";
      const trimmedDescription = description.trim() || undefined;
      updateBoard(modalBoardId, {
        name: trimmedName,
        description: trimmedDescription,
      });
      closeEditBoardModal(data.modalId);
    }, [
      modalBoardId,
      name,
      description,
      updateBoard,
      closeEditBoardModal,
      data.modalId,
    ]);

    const handleClose = useCallback(() => {
      closeEditBoardModal(data.modalId);
    }, [closeEditBoardModal, data.modalId]);

    const handleMouseDown = useCallback(() => {
      bringEditBoardModalToFront(data.modalId);
    }, [data.modalId, bringEditBoardModalToFront]);

    if (!modalFormData) {
      return null;
    }

    if (!modalBoardId) {
      return null;
    }

    return (
      <>
        {mounted &&
          connectorState &&
          createPortal(
            <ConnectorEdge
              endX={connectorState.end.x}
              endY={connectorState.end.y}
              startX={connectorState.start.x}
              startY={connectorState.start.y}
            />,
            document.body
          )}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Node wrapper needs mouse handler */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Node wrapper needs mouse handler */}
        <div
          className={cn(
            "flex flex-col overflow-hidden rounded-lg bg-card transition-all",
            selected || isFocused
              ? "shadow-xl ring-2 ring-primary/50"
              : "shadow-lg ring-1 ring-border/50",
            "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.05)]"
          )}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsFocused(false);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onMouseDown={handleMouseDown}
          style={{ width: MODAL_WIDTH }}
        >
          <div className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 font-bold text-[10px] text-primary">
                {getInitials(boardName)}
              </span>
              <span
                className="max-w-40 truncate font-semibold text-xs"
                title={boardName}
              >
                {boardName}
              </span>
            </div>
            <button
              className="nodrag flex h-5 w-5 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              onClick={handleClose}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <form
            className="nodrag nowheel nopan flex flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor={`board-name-${data.modalId}`}>Name</Label>
                <Input
                  autoFocus
                  className="rounded-lg border-2 border-border/50 bg-background/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-input/50 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                  id={`board-name-${data.modalId}`}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Board name"
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`board-description-${data.modalId}`}>
                  Description
                  <span className="ml-1 font-normal text-muted-foreground text-xs">
                    (Optional)
                  </span>
                </Label>
                <Textarea
                  className="min-h-20 resize-none rounded-lg border-2 border-border/50 bg-background/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-input/50 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                  id={`board-description-${data.modalId}`}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a short description..."
                  rows={3}
                  value={description}
                />
              </div>
            </div>
            <div className="flex gap-2 border-t bg-muted/95 px-3 py-2 dark:bg-secondary/95">
              <Button
                className="h-7 flex-1 rounded-md bg-card/80 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
                onClick={handleClose}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                className="h-7 flex-1 rounded-md bg-primary/90 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
                type="submit"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </>
    );
  }
);

EditBoardModalNodeComponent.displayName = "EditBoardModalNode";
