"use client";

import {
  Handle,
  type Node,
  type NodeProps,
  Position,
  NodeResizer as Resizer,
  useReactFlow,
} from "@xyflow/react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { GripVerticalIcon } from "@/src/components/animated/icons/grip-vertical";
import { PlusIcon } from "@/src/components/animated/icons/plus";
import { SquarePenIcon } from "@/src/components/animated/icons/square-pen";
import { XIcon } from "@/src/components/animated/icons/x";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { useCollaboration } from "@/src/features/collab";
import { useKanbanStore } from "../store/kanban-store";
import {
  TEXT_BOARD_MIN_HEIGHT,
  TEXT_BOARD_MIN_WIDTH,
} from "../store/slices/text-board-slice";
import type { TextBoardNode } from "../types";
import styles from "./styles/text-board-editor.module.css";
import { addTextBoardTask, TextBoardEditor } from "./text-board-editor";

export type TextBoardNodeProps = NodeProps<Node<TextBoardNode["data"]>>;

export const TextBoardNodeComponent = memo<TextBoardNodeProps>(
  ({ id, data, selected, isConnectable }) => {
    const { textBoardId, isSelected } = data as TextBoardNode["data"];

    const textBoard = useKanbanStore(
      (s) => s.textBoards.byId[textBoardId] ?? null
    );
    const setSelectedBoard = useKanbanStore((s) => s.setSelectedBoard);
    const bringTextBoardToFront = useKanbanStore(
      (s) => s.bringTextBoardToFront
    );
    const updateTextBoard = useKanbanStore((s) => s.updateTextBoard);
    const removeTextBoard = useKanbanStore((s) => s.removeTextBoard);
    const interactionMode = useKanbanStore((s) => s.interactionMode);
    const selectedBoardIds = useKanbanStore((s) => s.selectedBoardIds);
    const toggleBoardSelection = useKanbanStore((s) => s.toggleBoardSelection);
    const openBoardQuickActions = useKanbanStore(
      (s) => s.openBoardQuickActions
    );
    const openBoardDialog = useKanbanStore((s) => s.openBoardDialog);

    const { isCollaborating, updateSelection } = useCollaboration();
    const { screenToFlowPosition, setViewport, getViewport, setCenter } =
      useReactFlow();

    const [isEditingName, setIsEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState(textBoard?.name ?? "");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const headerRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const isMultiSelected = selectedBoardIds.includes(id);

    useEffect(() => {
      if (isEditingName) {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }
    }, [isEditingName]);

    const commitName = useCallback(() => {
      setIsEditingName(false);
      const trimmed = nameDraft.trim();
      if (trimmed && trimmed !== textBoard?.name) {
        updateTextBoard(textBoardId, { name: trimmed });
      } else {
        setNameDraft(textBoard?.name ?? "");
      }
    }, [nameDraft, textBoard?.name, textBoardId, updateTextBoard]);

    const handleClick = useCallback(
      (e: {
        metaKey: boolean;
        ctrlKey: boolean;
        shiftKey?: boolean;
        stopPropagation: () => void;
      }) => {
        bringTextBoardToFront(id);

        if (interactionMode === "select") {
          e.stopPropagation();
          if (e.metaKey || e.ctrlKey) {
            toggleBoardSelection(id);
          } else {
            useKanbanStore.getState().clearBoardSelection();
            toggleBoardSelection(id);
          }
        } else {
          setSelectedBoard(id);
          if (isCollaborating) {
            updateSelection([id]);
          }
        }
      },
      [
        bringTextBoardToFront,
        id,
        interactionMode,
        isCollaborating,
        setSelectedBoard,
        toggleBoardSelection,
        updateSelection,
      ]
    );

    const handleRemove = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setShowDeleteConfirm(true);
    }, []);

    const handleConfirmDelete = useCallback(() => {
      setShowDeleteConfirm(false);
      removeTextBoard(id);
    }, [id, removeTextBoard]);

    const handleAddTask = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        addTextBoardTask(textBoardId);
      },
      [textBoardId]
    );

    const handleWheel = useCallback((e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        return;
      }
      e.stopPropagation();
    }, []);

    // Keep dialogs opened from the context menu inside the viewport
    const VIEWPORT_PADDING = 100;
    const ensureDialogVisible = useCallback(
      (
        dialogX: number,
        dialogY: number,
        dialogWidth: number,
        dialogHeight: number
      ) => {
        const viewport = getViewport();
        const { x: vpX, y: vpY, zoom } = viewport;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        const dialogScreenX = dialogX * zoom + vpX;
        const dialogScreenY = dialogY * zoom + vpY;
        const dialogScreenRight = (dialogX + dialogWidth) * zoom + vpX;
        const dialogScreenBottom = (dialogY + dialogHeight) * zoom + vpY;

        let newVpX = vpX;
        let newVpY = vpY;
        let needsPan = false;

        if (dialogScreenX < VIEWPORT_PADDING) {
          newVpX = vpX + (VIEWPORT_PADDING - dialogScreenX);
          needsPan = true;
        } else if (dialogScreenRight > screenWidth - VIEWPORT_PADDING) {
          newVpX = vpX - (dialogScreenRight - (screenWidth - VIEWPORT_PADDING));
          needsPan = true;
        }

        if (dialogScreenY < VIEWPORT_PADDING) {
          newVpY = vpY + (VIEWPORT_PADDING - dialogScreenY);
          needsPan = true;
        } else if (dialogScreenBottom > screenHeight - VIEWPORT_PADDING) {
          newVpY =
            vpY - (dialogScreenBottom - (screenHeight - VIEWPORT_PADDING));
          needsPan = true;
        }

        if (needsPan) {
          setViewport({ x: newVpX, y: newVpY, zoom }, { duration: 0 });
        }
      },
      [getViewport, setViewport]
    );

    // Right-click opens the same quick actions menu + rename (properties)
    // dialog that kanban boards open, so text boards get full board parity.
    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!textBoard) {
          return;
        }
        const headerRect = headerRef.current?.getBoundingClientRect();
        const screenX = headerRect ? headerRect.right + 20 : e.clientX;
        const screenY = headerRect ? headerRect.top : e.clientY;
        const flowPos = screenToFlowPosition({ x: screenX, y: screenY });
        openBoardQuickActions(textBoardId, flowPos);

        setTimeout(
          () => ensureDialogVisible(flowPos.x, flowPos.y, 220, 280),
          50
        );

        // If a rename dialog is already open for this text board, don't
        // create a duplicate - bring it to front and pan to it instead.
        const existingRenameDialog = Object.values(
          useKanbanStore.getState().boardDialogs
        ).find((d) => d.boardId === textBoardId && d.type === "rename");

        if (existingRenameDialog) {
          useKanbanStore
            .getState()
            .bringDialogToFront(
              `text-board-rename-dialog-${existingRenameDialog.id}`
            );
          setCenter(
            existingRenameDialog.position.x + 150,
            existingRenameDialog.position.y + 150,
            { duration: 500, zoom: 1 }
          );
          return;
        }

        const QUICK_ACTIONS_WIDTH = 220;
        const renamePos = {
          x: flowPos.x + QUICK_ACTIONS_WIDTH + 40,
          y: flowPos.y,
        };
        openBoardDialog({
          type: "rename",
          boardId: textBoardId,
          boardName: textBoard.name,
          boardDescription: textBoard.description,
          inputValue: textBoard.name,
          descriptionValue: textBoard.description,
          position: renamePos,
        });
        setTimeout(
          () => ensureDialogVisible(renamePos.x, renamePos.y, 320, 280),
          100
        );
      },
      [
        textBoard,
        textBoardId,
        screenToFlowPosition,
        openBoardQuickActions,
        openBoardDialog,
        ensureDialogVisible,
        setCenter,
      ]
    );

    if (!textBoard) {
      return null;
    }

    return (
      <>
        <Resizer
          handleClassName="w-8! h-8! opacity-0!"
          isVisible={selected || isSelected || isMultiSelected}
          lineClassName="border-0!"
          lineStyle={{
            borderWidth: 0,
            opacity: 0,
          }}
          maxHeight={1200}
          maxWidth={700}
          minHeight={TEXT_BOARD_MIN_HEIGHT}
          minWidth={TEXT_BOARD_MIN_WIDTH}
        />

        {/** biome-ignore lint/a11y/useSemanticElements: skip */}
        <div
          aria-pressed={isSelected || selected || isMultiSelected}
          className={`group/textboard relative flex h-full w-full flex-col rounded bg-card transition-all ${
            isMultiSelected
              ? "border-2 border-gray-500 shadow-[0_0_20px_rgba(128,128,128,0.4),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] ring-2 ring-gray-500/20 dark:shadow-[0_0_20px_rgba(128,128,128,0.4),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
              : isSelected || selected
                ? "border-2 border-primary shadow-[0_0_20px_rgba(128,128,128,0.3),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_0_20px_rgba(128,128,128,0.3),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
                : "border-2 border-border/50 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          }`}
          data-selected={isSelected || selected ? "true" : "false"}
          data-testid="text-board-node"
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              handleClick({
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                stopPropagation: () => e.stopPropagation(),
              });
            }
          }}
          role="button"
          tabIndex={0}
        >
          <Handle
            className="border-0! bg-transparent! opacity-0!"
            data-testid="textboard-handle-top-target"
            id="top-target"
            isConnectable={isConnectable}
            position={Position.Top}
            type="target"
          />
          <Handle
            className="border-0! bg-transparent! opacity-0!"
            data-testid="textboard-handle-right-target"
            id="right-target"
            isConnectable={isConnectable}
            position={Position.Right}
            type="target"
          />
          <Handle
            className="border-0! bg-transparent! opacity-0!"
            data-testid="textboard-handle-bottom-target"
            id="bottom-target"
            isConnectable={isConnectable}
            position={Position.Bottom}
            type="target"
          />
          <Handle
            className="border-0! bg-transparent! opacity-0!"
            data-testid="textboard-handle-left-target"
            id="left-target"
            isConnectable={isConnectable}
            position={Position.Left}
            type="target"
          />
          <Handle
            className="border-0! bg-transparent! opacity-0!"
            data-testid="textboard-handle-top"
            id="top"
            isConnectable={isConnectable}
            position={Position.Top}
            type="source"
          />
          <Handle
            className="border-0! bg-transparent! opacity-0!"
            data-testid="textboard-handle-right"
            id="right"
            isConnectable={isConnectable}
            position={Position.Right}
            type="source"
          />
          <Handle
            className="border-0! bg-transparent! opacity-0!"
            data-testid="textboard-handle-bottom"
            id="bottom"
            isConnectable={isConnectable}
            position={Position.Bottom}
            type="source"
          />
          <Handle
            className="border-0! bg-transparent! opacity-0!"
            data-testid="textboard-handle-left"
            id="left"
            isConnectable={isConnectable}
            position={Position.Left}
            type="source"
          />

          {/** biome-ignore lint/a11y/noStaticElementInteractions: context menu on draggable handle */}
          {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: context menu on draggable handle */}
          <div
            className="group flex w-full shrink-0 cursor-move items-center justify-between gap-1.5 rounded-t border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] transition-colors hover:bg-muted dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)] dark:hover:bg-secondary"
            data-testid="text-board-header"
            onContextMenu={handleContextMenu}
            ref={headerRef}
            style={
              textBoard.accentColor
                ? {
                    background: `linear-gradient(to right, ${textBoard.accentColor}15, ${textBoard.accentColor}08, transparent)`,
                  }
                : {}
            }
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <GripVerticalIcon
                className="shrink-0 text-muted-foreground"
                size={14}
              />
              {isEditingName ? (
                <input
                  autoFocus
                  className="nodrag h-6 min-w-0 flex-1 rounded border border-border/50 bg-card px-1.5 font-semibold text-xs focus:outline-none"
                  data-testid="text-board-name-input"
                  onBlur={commitName}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      commitName();
                    } else if (e.key === "Escape") {
                      setNameDraft(textBoard.name);
                      setIsEditingName(false);
                    }
                  }}
                  ref={nameInputRef}
                  value={nameDraft}
                />
              ) : (
                <h3 className="truncate font-semibold text-foreground text-xs">
                  {textBoard.name}
                </h3>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                className="nodrag flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-all hover:bg-accent group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setNameDraft(textBoard.name);
                  setIsEditingName(true);
                }}
                title="Rename text board"
                type="button"
              >
                <SquarePenIcon className="text-muted-foreground" size={10} />
              </button>
            </div>
            {textBoard.description && (
              <p className="mr-2 hidden truncate text-[10px] text-muted-foreground md:block">
                {textBoard.description}
              </p>
            )}
            <div className="flex items-center gap-1.5">
              <button
                className="nodrag flex h-6 items-center gap-1 rounded-full bg-primary/90 px-2.5 font-medium text-[10px] text-primary-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] transition-colors hover:bg-primary dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.4)]"
                data-testid="text-board-add-task"
                onClick={handleAddTask}
                title="Add todo item"
                type="button"
              >
                <PlusIcon size={14} />
                <span>Add Task</span>
              </button>
              <Popover
                onOpenChange={setShowDeleteConfirm}
                open={showDeleteConfirm}
              >
                <PopoverTrigger asChild>
                  <button
                    className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                    data-testid="text-board-delete"
                    onClick={handleRemove}
                    type="button"
                  >
                    <XIcon size={14} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="center"
                  className="nodrag w-auto border-border/50 bg-card px-3 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
                  side="top"
                  sideOffset={8}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      Delete text board?
                    </span>
                    <button
                      className="flex h-5 w-5 items-center justify-center rounded text-destructive transition-colors hover:bg-destructive/10"
                      data-testid="text-board-confirm-delete"
                      onClick={handleConfirmDelete}
                      type="button"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div
            className={`nodrag flex-1 overflow-y-auto overflow-x-hidden p-3 ${styles.editor}`}
            data-testid="text-board-content"
            onWheel={handleWheel}
            onWheelCapture={handleWheel}
          >
            <TextBoardEditor textBoardId={textBoardId} />
          </div>
        </div>
      </>
    );
  }
);

TextBoardNodeComponent.displayName = "TextBoardNode";
