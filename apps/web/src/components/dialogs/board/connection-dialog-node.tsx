"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import {
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Link2,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { cn } from "@/src/lib/utils";
import { ConnectionConfigSection } from "./connection-config-section";

type HandlePosition = "top" | "right" | "bottom" | "left";
type LineStyle = "solid" | "dotted";

type ConnectionDialogNodeData = {
  boardId: string;
};

type ConnectionDialogNodeProps = NodeProps<Node<ConnectionDialogNodeData>>;

const DIALOG_WIDTH = 380;

export const ConnectionDialogNodeComponent = memo<ConnectionDialogNodeProps>(
  ({ data, selected }) => {
    const { flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);
    const [showExistingConnections, setShowExistingConnections] =
      useState(true);

    const boardId = data.boardId;
    const connectionDialog = useKanbanStore((state) => state.connectionDialog);
    const closeConnectionDialog = useKanbanStore(
      (state) => state.closeConnectionDialog
    );
    const updateConnectionDialogConfig = useKanbanStore(
      (state) => state.updateConnectionDialogConfig
    );
    const boards = useKanbanStore((state) => state.boards);
    const currentWorkspaceId = useKanbanStore(
      (state) => state.currentWorkspaceId
    );
    const workspaces = useKanbanStore((state) => state.workspaces);
    const addConnection = useKanbanStore((state) => state.addConnection);
    const removeConnection = useKanbanStore((state) => state.removeConnection);
    const updateConnection = useKanbanStore((state) => state.updateConnection);
    const boardConnections = useKanbanStore((state) => state.boardConnections);
    const boardQuickActions = useKanbanStore(
      (state) => state.boardQuickActions[boardId]
    );
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
    const zIndexDialogId = `connection-dialog-${boardId}`;
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    // Get config values from store (synced across collaborators)
    const searchQuery = connectionDialog?.searchQuery ?? "";
    const selectedTargetId = connectionDialog?.selectedTargetId ?? null;
    const editingConnectionId = connectionDialog?.editingConnectionId ?? null;
    const sourceHandle = connectionDialog?.sourceHandle ?? "bottom";
    const targetHandle = connectionDialog?.targetHandle ?? "top";
    const lineStyle = connectionDialog?.lineStyle ?? "solid";
    const showArrow = connectionDialog?.showArrow ?? true;
    const label = connectionDialog?.label ?? "";

    // Setter functions that update store (syncing to collaborators)
    const setSearchQuery = useCallback(
      (value: string) => updateConnectionDialogConfig({ searchQuery: value }),
      [updateConnectionDialogConfig]
    );
    const setSelectedTargetId = useCallback(
      (value: string | null) =>
        updateConnectionDialogConfig({ selectedTargetId: value }),
      [updateConnectionDialogConfig]
    );
    const setEditingConnectionId = useCallback(
      (value: string | null) =>
        updateConnectionDialogConfig({ editingConnectionId: value }),
      [updateConnectionDialogConfig]
    );
    const setSourceHandle = useCallback(
      (value: HandlePosition) =>
        updateConnectionDialogConfig({ sourceHandle: value }),
      [updateConnectionDialogConfig]
    );
    const setTargetHandle = useCallback(
      (value: HandlePosition) =>
        updateConnectionDialogConfig({ targetHandle: value }),
      [updateConnectionDialogConfig]
    );
    const setLineStyle = useCallback(
      (value: LineStyle) => updateConnectionDialogConfig({ lineStyle: value }),
      [updateConnectionDialogConfig]
    );
    const setShowArrow = useCallback(
      (value: boolean) => updateConnectionDialogConfig({ showArrow: value }),
      [updateConnectionDialogConfig]
    );
    const setLabel = useCallback(
      (value: string) => updateConnectionDialogConfig({ label: value }),
      [updateConnectionDialogConfig]
    );

    // Dialog presence
    const { dialogCollaborator, handleDialogPointerDown } =
      useDialogPresenceLifecycle(zIndexDialogId, "connection-dialog", boardId);

    useEffect(() => {
      setPortalTarget(document.getElementById("board-connector-layer"));
    }, []);
    useEffect(() => {
      registerDialog(zIndexDialogId);
      return () => unregisterDialog(zIndexDialogId);
    }, [zIndexDialogId, registerDialog, unregisterDialog]);
    const isTopmost = dialogFocusStack.at(-1) === zIndexDialogId;

    const connectorZIndex = useMemo(() => {
      const index = dialogFocusStack.indexOf(zIndexDialogId);
      if (index === -1) {
        return 1000;
      }
      return 1000 + (index + 1) * 10;
    }, [dialogFocusStack, zIndexDialogId]);
    const sourceBoard = boards.byId[boardId];
    const currentWorkspace = currentWorkspaceId
      ? workspaces.byId[currentWorkspaceId]
      : null;
    const workspaceBoardIds = currentWorkspace?.board_ids ?? boards.allIds;

    const existingConnections = boardConnections.allIds
      .map((connId) => boardConnections.byId[connId])
      .filter((conn) => conn && conn.source_board_id === boardId);

    const existingTargetIds = new Set(
      existingConnections.map((conn) => conn?.target_board_id)
    );

    const availableBoards = workspaceBoardIds
      .map((id) => boards.byId[id])
      .filter((board) => {
        if (!board || board.id === boardId) {
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

    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };

      if (!(boardQuickActions && connectionDialog?.position)) {
        return null;
      }

      const myScreenPos = flowToScreenPosition({
        x: connectionDialog.position.x,
        y: connectionDialog.position.y,
      });

      const sourceWidth = 220;
      const sourceScreenPos = flowToScreenPosition({
        x: boardQuickActions.position.x + sourceWidth,
        y: boardQuickActions.position.y + 120,
      });

      return {
        start: sourceScreenPos,
        end: { x: myScreenPos.x, y: myScreenPos.y + 24 },
      };
    }, [
      connectionDialog?.position,
      boardQuickActions,
      flowToScreenPosition,
      vpX,
      vpY,
      vpZoom,
    ]);

    const handleCreateConnection = useCallback(() => {
      if (!selectedTargetId) {
        return;
      }

      const connectionId = addConnection(boardId, selectedTargetId, {
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
      boardId,
      addConnection,
      label,
      lineStyle,
      sourceHandle,
      targetHandle,
      showArrow,
      setSelectedTargetId,
      setLabel,
      setSourceHandle,
      setTargetHandle,
      setLineStyle,
      setShowArrow,
      setSearchQuery,
    ]);

    const handleQuickConnect = useCallback(
      (targetBoardId: string) => {
        setSelectedTargetId(targetBoardId);
      },
      [setSelectedTargetId]
    );

    const handleDeleteConnection = useCallback(
      (connectionId: string) => {
        removeConnection(connectionId);
        if (editingConnectionId === connectionId) {
          setEditingConnectionId(null);
        }
      },
      [removeConnection, editingConnectionId, setEditingConnectionId]
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

    const handleClose = useCallback(() => {
      closeConnectionDialog();
    }, [closeConnectionDialog]);

    if (!sourceBoard) {
      return null;
    }

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip
      // biome-ignore lint/a11y/noStaticElementInteractions: skip
      <div
        className={cn(
          "relative rounded-lg transition-all duration-200",
          selected || isFocused || isTopmost
            ? "scale-[1.02] shadow-xl"
            : "shadow-lg",
          "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.05)]"
        )}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsFocused(false);
          }
        }}
        onFocus={() => setIsFocused(true)}
        onPointerDown={() => {
          bringDialogToFront(zIndexDialogId);
          handleDialogPointerDown();
        }}
        style={{ width: DIALOG_WIDTH }}
      >
        {connectorState &&
          portalTarget &&
          createPortal(
            <ConnectorEdge
              customColor={sourceBoard?.accentColor}
              endX={connectorState.end.x}
              endY={connectorState.end.y}
              startX={connectorState.start.x}
              startY={connectorState.start.y}
              zIndex={connectorZIndex}
            />,
            portalTarget
          )}

        {dialogCollaborator && (
          <DialogPresenceIndicator activeCollaborator={dialogCollaborator} />
        )}

        <div
          aria-labelledby={`dialog-title-connection-${boardId}`}
          className={cn(
            "flex flex-col overflow-hidden rounded-lg bg-card",
            selected || isFocused || isTopmost
              ? "ring-2 ring-primary/50"
              : "ring-1 ring-border/50"
          )}
          role="dialog"
        >
          <div
            className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            style={
              sourceBoard?.accentColor
                ? {
                    background: `linear-gradient(to right, ${sourceBoard.accentColor}15, ${sourceBoard.accentColor}08, transparent)`,
                  }
                : {}
            }
          >
            <div className="flex items-center gap-1.5">
              <GripHorizontal className="h-3 w-3 text-muted-foreground" />
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-primary text-xs",
                  !sourceBoard?.accentColor && "bg-primary/10"
                )}
                style={
                  sourceBoard?.accentColor
                    ? {
                        backgroundColor: `${sourceBoard.accentColor}25`,
                        color: sourceBoard.accentColor,
                      }
                    : {}
                }
              >
                <Link2 className="h-3 w-3" />
                <span className="max-w-32 truncate">{sourceBoard?.name}</span>
              </span>
            </div>
            <button
              className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              onClick={handleClose}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="nodrag border-border/50 border-b p-3">
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
                  className="mt-3 w-full rounded-md bg-primary/90 px-3 py-1.5 font-medium text-primary-foreground text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors hover:bg-primary dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
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
                  className="mb-2 w-full rounded-lg border border-border/30 bg-muted/80 px-3 py-1.5 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] focus:outline-none dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
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
            <div className="nodrag p-3">
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
      </div>
    );
  }
);

ConnectionDialogNodeComponent.displayName = "ConnectionDialogNode";
