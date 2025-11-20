"use client";

import {
  Background,
  BackgroundVariant,
  MiniMap,
  type Node,
  type OnEdgesChange,
  type OnMove,
  type OnNodesChange,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import "@xyflow/react/dist/style.css";
import { useKanbanStore } from "../store/kanban-store";
import type { Board, BoardNode } from "../types";
import { nodeTypes } from "./board-node";
import { BulkActionsBar } from "./bulk-actions-bar";
import { CustomControls } from "./custom-controls";
import { RightControls } from "./right-controls";
import { WelcomeScreen } from "./welcome-screen";
import { WorkspaceSelector } from "./workspace-selector";

type KanbanNode = Node<BoardNode["data"]>;

export function KanbanCanvas() {
  const workspaceId = useKanbanStore(
    (state) => state.currentWorkspace?.id ?? null
  );
  const allNodes = useKanbanStore((state) => state.nodes);
  const boards = useKanbanStore((state) => state.boards);
  const edges = useKanbanStore((state) => state.edges);
  const showMiniMap = useKanbanStore((state) => state.showMiniMap);
  const setNodes = useKanbanStore((state) => state.setNodes);
  const setEdges = useKanbanStore((state) => state.setEdges);
  const interactionMode = useKanbanStore((state) => state.interactionMode);
  const setInteractionMode = useKanbanStore(
    (state) => state.setInteractionMode
  );
  const clearBoardSelection = useKanbanStore(
    (state) => state.clearBoardSelection
  );
  const viewport = useKanbanStore((state) => state.viewport);
  const setViewport = useKanbanStore((state) => state.setViewport);
  const nodes = useMemo(() => {
    if (!workspaceId) {
      return allNodes;
    }

    const workspaceBoardIds = new Set(
      boards
        .filter((board: Board) => {
          const boardWorkspaceId = board.workspace_id;
          return !boardWorkspaceId || boardWorkspaceId === workspaceId;
        })
        .map((board) => board.id)
    );

    return allNodes.filter((node) => workspaceBoardIds.has(node.id));
  }, [allNodes, boards, workspaceId]);

  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);
  const isUpdatingFromStore = useRef(false);

  useEffect(() => {
    const handleToggleMode = (event: KeyboardEvent) => {
      if (
        !event.repeat &&
        event.key.toLowerCase() === "v" &&
        !(event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setInteractionMode(interactionMode === "drag" ? "select" : "drag");
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && interactionMode === "select") {
        event.preventDefault();
        clearBoardSelection();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      handleToggleMode(event);
      handleEscape(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [interactionMode, clearBoardSelection, setInteractionMode]);

  const handleNodesChange: OnNodesChange<KanbanNode> = useCallback(
    (changes) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  useEffect(() => {
    if (isUpdatingFromStore.current) {
      isUpdatingFromStore.current = false;
      return;
    }

    const updatedNodes = localNodes.map((node) => {
      const updatedNode: KanbanNode = {
        ...node,
        data: { ...node.data },
        position: { ...node.position },
      } as KanbanNode;

      if (node.width !== undefined) {
        updatedNode.width = node.width;
      }
      if (node.height !== undefined) {
        updatedNode.height = node.height;
      }
      if (node.style) {
        updatedNode.style = { ...node.style };
      }
      if (node.measured) {
        updatedNode.measured = {
          width: node.measured.width,
          height: node.measured.height,
        };
      }

      return updatedNode;
    });
    setNodes(updatedNodes);
  }, [localNodes, setNodes]);

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      setEdges(localEdges);
    },
    [onEdgesChange, setEdges, localEdges]
  );

  const handleMoveEnd: OnMove = useCallback(
    (_event, viewportState) => {
      if (!viewportState) {
        return;
      }
      setViewport(viewportState);
    },
    [setViewport]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: required
  useEffect(() => {
    isUpdatingFromStore.current = true;
    const mutableNodes = nodes.map((node) => {
      const mutableNode: KanbanNode = {
        ...node,
        data: { ...node.data },
        position: { ...node.position },
      } as KanbanNode;

      if (node.width !== undefined) {
        mutableNode.width = node.width;
      }
      if (node.height !== undefined) {
        mutableNode.height = node.height;
      }
      if (node.style) {
        mutableNode.style = { ...node.style };
      }
      if (node.measured) {
        mutableNode.measured = {
          width: node.measured.width,
          height: node.measured.height,
        };
      }

      return mutableNode;
    });
    setLocalNodes(mutableNodes);
  }, [nodes]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: required
  useEffect(() => {
    setLocalEdges(edges);
  }, [edges]);

  useEffect(() => {
    const handleWheel = (e: Event) => {
      const wheelEvent = e as WheelEvent;
      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        e.preventDefault();
      }
    };

    const canvas = document.querySelector(".react-flow");
    if (canvas) {
      canvas.addEventListener("wheel", handleWheel, { passive: false });
      return () => {
        canvas.removeEventListener("wheel", handleWheel);
      };
    }
  }, []);

  return (
    <div className="h-full w-full">
      <ReactFlow
        className="bg-background"
        defaultViewport={viewport}
        edges={localEdges}
        elementsSelectable={interactionMode === "select"}
        fitView={nodes.length === 0}
        maxZoom={3}
        minZoom={0.1}
        nodeOrigin={[0, 0]}
        nodes={localNodes}
        nodesConnectable={false}
        nodesDraggable={interactionMode === "drag"}
        nodeTypes={nodeTypes}
        onEdgesChange={handleEdgesChange}
        onMoveEnd={handleMoveEnd}
        onNodesChange={handleNodesChange}
        panOnDrag={interactionMode === "drag"}
        panOnScroll={interactionMode === "drag"}
        proOptions={{ hideAttribution: true }}
        selectionKeyCode={interactionMode === "select" ? null : "Meta"}
        selectionMode={
          interactionMode === "select" ? SelectionMode.Partial : undefined
        }
        selectionOnDrag={interactionMode === "select"}
        zoomActivationKeyCode="Control"
        zoomOnScroll
      >
        <Background
          className="opacity-30"
          color="currentColor"
          gap={20}
          variant={BackgroundVariant.Dots}
        />
        <CustomControls />
        {showMiniMap && (
          <MiniMap
            className="rounded-lg! border-2! border-border/50! bg-card/95! shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]! backdrop-blur-md! dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]!"
            maskColor="var(--background)"
            nodeColor={(node) => {
              if (node.data?.isSelected || node.selected) {
                return "var(--primary)";
              }
              return "var(--secondary)";
            }}
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
    </div>
  );
}
