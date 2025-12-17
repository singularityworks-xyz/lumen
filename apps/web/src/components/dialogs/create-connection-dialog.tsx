"use client";

import {
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Link2,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import type { PointerEvent } from "react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useKanbanStore } from "@/src/features/kanban/store";
import { cn } from "@/src/lib/utils";
import { ConnectorEdge } from "../ui/connector-edge";
import { ConnectionConfigSection } from "./connection-config-section";

type HandlePosition = "top" | "right" | "bottom" | "left";
type LineStyle = "solid" | "dotted";

type CreateConnectionDialogProps = {
  sourceBoardId: string;
  x: number;
  y: number;
  onClose: () => void;
  getBoardHeaderRect?: () => DOMRect | null;
  quickActionsPosition?: { x: number; y: number };
};

const DIALOG_WIDTH = 380;

export const CreateConnectionDialog = memo(
  ({
    sourceBoardId,
    x,
    y,
    onClose,
    getBoardHeaderRect,
    quickActionsPosition,
  }: CreateConnectionDialogProps) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x, y });
    const [searchQuery, setSearchQuery] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [boardRect, setBoardRect] = useState<DOMRect | null>(null);
    const [showExistingConnections, setShowExistingConnections] =
      useState(true);
    const [selectedTargetId, setSelectedTargetId] = useState<string | null>(
      null
    );
    const [editingConnectionId, setEditingConnectionId] = useState<
      string | null
    >(null);

    const [sourceHandle, setSourceHandle] = useState<HandlePosition>("bottom");
    const [targetHandle, setTargetHandle] = useState<HandlePosition>("top");
    const [lineStyle, setLineStyle] = useState<LineStyle>("solid");
    const [showArrow, setShowArrow] = useState(true);
    const [label, setLabel] = useState("");

    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionStartRef = useRef({ x: 0, y: 0 });

    const boards = useKanbanStore((state) => state.boards);
    const currentWorkspaceId = useKanbanStore(
      (state) => state.currentWorkspaceId
    );
    const workspaces = useKanbanStore((state) => state.workspaces);
    const addConnection = useKanbanStore((state) => state.addConnection);
    const removeConnection = useKanbanStore((state) => state.removeConnection);
    const updateConnection = useKanbanStore((state) => state.updateConnection);
    const boardConnections = useKanbanStore((state) => state.boardConnections);

    const sourceBoard = boards.byId[sourceBoardId];
    const currentWorkspace = currentWorkspaceId
      ? workspaces.byId[currentWorkspaceId]
      : null;
    const workspaceBoardIds = currentWorkspace?.board_ids ?? boards.allIds;

    const existingConnections = boardConnections.allIds
      .map((connId) => boardConnections.byId[connId])
      .filter((conn) => conn && conn.source_board_id === sourceBoardId);

    const existingTargetIds = new Set(
      existingConnections.map((conn) => conn?.target_board_id)
    );

    const availableBoards = workspaceBoardIds
      .map((id) => boards.byId[id])
      .filter((board) => {
        if (!board || board.id === sourceBoardId) {
          return false;
        }
        if (existingTargetIds.has(board.id)) {
          return false;
        }
        if (searchQuery) {
          return board.name.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      });

    useEffect(() => {
      setMounted(true);
      if (getBoardHeaderRect) {
        setBoardRect(getBoardHeaderRect());
      }
    }, [getBoardHeaderRect]);

    useEffect(() => {
      const updateRect = () => {
        if (getBoardHeaderRect) {
          setBoardRect(getBoardHeaderRect());
        }
      };
      window.addEventListener("resize", updateRect);
      return () => window.removeEventListener("resize", updateRect);
    }, [getBoardHeaderRect]);

    useLayoutEffect(() => {
      if (!dialogRef.current) {
        return;
      }

      const dialogRect = dialogRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + dialogRect.width > viewportWidth - 8) {
        adjustedX = viewportWidth - dialogRect.width - 8;
      }
      if (adjustedX < 8) {
        adjustedX = 8;
      }

      if (y + dialogRect.height > viewportHeight - 8) {
        adjustedY = viewportHeight - dialogRect.height - 8;
      }
      if (adjustedY < 8) {
        adjustedY = 8;
      }

      setPosition({ x: adjustedX, y: adjustedY });
    }, [x, y]);

    useEffect(() => {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onClose();
        }
      };

      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }, [onClose]);

    const handleDragStart = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        positionStartRef.current = { ...position };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      },
      [position]
    );

    const handleDragMove = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if (!isDragging) {
          return;
        }
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPosition({
          x: positionStartRef.current.x + dx,
          y: positionStartRef.current.y + dy,
        });
      },
      [isDragging]
    );

    const handleDragEnd = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if (isDragging) {
          setIsDragging(false);
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }
      },
      [isDragging]
    );

    const handleCreateConnection = useCallback(() => {
      if (!selectedTargetId) {
        return;
      }

      const connectionId = addConnection(sourceBoardId, selectedTargetId, {
        label: label || undefined,
        lineStyle,
        sourceHandle,
        targetHandle,
        showArrow,
      });

      if (connectionId) {
        setSelectedTargetId(null);
        setLabel("");
        setSourceHandle("bottom");
        setTargetHandle("top");
        setLineStyle("solid");
        setShowArrow(true);
        setSearchQuery("");
      }
    }, [
      selectedTargetId,
      sourceBoardId,
      addConnection,
      label,
      lineStyle,
      sourceHandle,
      targetHandle,
      showArrow,
    ]);

    const handleQuickConnect = useCallback((targetBoardId: string) => {
      setSelectedTargetId(targetBoardId);
    }, []);

    const handleDeleteConnection = useCallback(
      (connectionId: string) => {
        removeConnection(connectionId);
        if (editingConnectionId === connectionId) {
          setEditingConnectionId(null);
        }
      },
      [removeConnection, editingConnectionId]
    );

    const handleUpdateConnection = useCallback(
      (
        connectionId: string,
        updates: {
          label?: string;
          lineStyle?: LineStyle;
          sourceHandle?: HandlePosition;
          targetHandle?: HandlePosition;
          showArrow?: boolean;
        }
      ) => {
        updateConnection(connectionId, updates);
      },
      [updateConnection]
    );

    if (!mounted) {
      return null;
    }

    const dialogConnectionX = position.x;
    const dialogConnectionY = position.y + 24;

    const dialogContent = (
      <>
        <ConnectorEdge
          buttonRect={boardRect}
          endX={dialogConnectionX}
          endY={dialogConnectionY}
          fallbackPosition={quickActionsPosition}
        />

        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop for click capture */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Backdrop for click capture */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Backdrop for click capture */}
        <div
          className="fixed inset-0 z-9998"
          onClick={onClose}
          onContextMenu={(e) => {
            e.preventDefault();
            onClose();
          }}
        />

        <div
          className="fixed z-9999 flex flex-col overflow-hidden rounded-lg border-2 border-border/50 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
            }
          }}
          ref={dialogRef}
          style={{
            left: position.x,
            top: position.y,
            width: DIALOG_WIDTH,
          }}
        >
          <div
            className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            onPointerCancel={handleDragEnd}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <div className="flex items-center gap-1.5">
              <GripHorizontal className="h-3 w-3 text-muted-foreground" />
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                <Link2 className="h-3 w-3" />
                <span className="max-w-32 truncate">{sourceBoard?.name}</span>
              </span>
            </div>
            <button
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              onClick={onClose}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="border-border/50 border-b p-3">
            <h4 className="mb-2 font-semibold text-foreground text-xs">
              Add New Connection
            </h4>

            {selectedTargetId ? (
              <>
                <div className="mb-3 flex items-center justify-between rounded border border-primary/30 bg-primary/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-sm">
                      {boards.byId[selectedTargetId]?.name}
                    </span>
                  </div>
                  <button
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setSelectedTargetId(null)}
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <ConnectionConfigSection
                  label={label}
                  lineStyle={lineStyle}
                  onLabelChange={setLabel}
                  onLineStyleChange={setLineStyle}
                  onShowArrowChange={setShowArrow}
                  onSourceHandleChange={setSourceHandle}
                  onTargetHandleChange={setTargetHandle}
                  showArrow={showArrow}
                  sourceHandle={sourceHandle}
                  targetHandle={targetHandle}
                />

                <button
                  className="mt-3 w-full rounded bg-primary py-1.5 font-medium text-primary-foreground text-xs transition-colors hover:bg-primary/90"
                  onClick={handleCreateConnection}
                  type="button"
                >
                  Create Connection
                </button>
              </>
            ) : (
              <>
                <input
                  autoFocus
                  className="mb-2 w-full rounded border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search boards..."
                  type="text"
                  value={searchQuery}
                />
                <div className="max-h-32 overflow-y-auto">
                  {availableBoards.length === 0 ? (
                    <div className="py-4 text-center text-muted-foreground text-xs">
                      {searchQuery
                        ? "No matching boards found"
                        : "No available boards to connect"}
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {availableBoards.map((board) => {
                        if (!board) {
                          return null;
                        }
                        return (
                          <button
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                            key={board.id}
                            onClick={() => handleQuickConnect(board.id)}
                            type="button"
                          >
                            <Link2 className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate text-xs">
                              {board.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {existingConnections.length > 0 && (
            <div className="p-3">
              <button
                className="mb-2 flex w-full items-center justify-between text-left"
                onClick={() =>
                  setShowExistingConnections(!showExistingConnections)
                }
                type="button"
              >
                <h4 className="font-semibold text-foreground text-xs">
                  Existing Connections ({existingConnections.length})
                </h4>
                {showExistingConnections ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {showExistingConnections && (
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {existingConnections.map((conn) => {
                    if (!conn) {
                      return null;
                    }
                    const targetBoard = boards.byId[conn.target_board_id];
                    const isEditing = editingConnectionId === conn.id;

                    return (
                      <div
                        className="rounded border border-border bg-muted/30 p-2"
                        key={conn.id}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Link2 className="h-3 w-3 shrink-0 text-primary" />
                            <span className="truncate font-medium text-xs">
                              {targetBoard?.name ?? "Unknown Board"}
                            </span>
                            {conn.label && (
                              <span className="truncate text-[10px] text-muted-foreground">
                                "{conn.label}"
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded transition-colors",
                                isEditing
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
                              )}
                              onClick={() =>
                                setEditingConnectionId(
                                  isEditing ? null : conn.id
                                )
                              }
                              title="Edit connection"
                              type="button"
                            >
                              <Settings2 className="h-3 w-3" />
                            </button>
                            <button
                              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleDeleteConnection(conn.id)}
                              title="Delete connection"
                              type="button"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {!isEditing && (
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>
                              {conn.sourceHandle} → {conn.targetHandle}
                            </span>
                            <span>•</span>
                            <span>{conn.lineStyle}</span>
                            {!conn.showArrow && (
                              <>
                                <span>•</span>
                                <span>no arrow</span>
                              </>
                            )}
                          </div>
                        )}

                        {isEditing && (
                          <div className="mt-2 border-border/50 border-t pt-2">
                            <ConnectionConfigSection
                              compact
                              label={conn.label || ""}
                              lineStyle={conn.lineStyle}
                              onLabelChange={(val) =>
                                handleUpdateConnection(conn.id, {
                                  label: val || undefined,
                                })
                              }
                              onLineStyleChange={(val) =>
                                handleUpdateConnection(conn.id, {
                                  lineStyle: val,
                                })
                              }
                              onShowArrowChange={(val) =>
                                handleUpdateConnection(conn.id, {
                                  showArrow: val,
                                })
                              }
                              onSourceHandleChange={(val) =>
                                handleUpdateConnection(conn.id, {
                                  sourceHandle: val,
                                })
                              }
                              onTargetHandleChange={(val) =>
                                handleUpdateConnection(conn.id, {
                                  targetHandle: val,
                                })
                              }
                              showArrow={conn.showArrow}
                              sourceHandle={conn.sourceHandle}
                              targetHandle={conn.targetHandle}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </>
    );

    return createPortal(dialogContent, document.body);
  }
);

CreateConnectionDialog.displayName = "CreateConnectionDialog";
