"use client";

import {
  MiniMap,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import "@xyflow/react/dist/style.css";
import { useKanbanStore } from "../store/kanban-store";
import type { BoardNode } from "../types";
import { nodeTypes } from "./board-node";
import { CustomControls } from "./custom-controls";

type KanbanNode = Node<BoardNode["data"]>;

export function KanbanCanvas() {
  const nodes = useKanbanStore((state) => state.nodes);
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
  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);
  const isUpdatingFromStore = useRef(false);

  useHotkeys(
    "v",
    () => {
      setInteractionMode(interactionMode === "drag" ? "select" : "drag");
    },
    { preventDefault: true }
  );

  useHotkeys(
    "escape",
    () => {
      if (interactionMode === "select") {
        clearBoardSelection();
      }
    },
    { preventDefault: true }
  );

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
  }, [nodes, setLocalNodes]);

  useEffect(() => {
    setLocalEdges(edges);
  }, [edges, setLocalEdges]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        className="bg-background"
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        edges={localEdges}
        elementsSelectable={interactionMode === "select"}
        fitView
        maxZoom={3}
        minZoom={0.1}
        nodeOrigin={[0, 0]}
        nodes={localNodes}
        nodesConnectable={false}
        nodesDraggable={interactionMode === "drag"}
        nodeTypes={nodeTypes}
        onEdgesChange={handleEdgesChange}
        onNodesChange={handleNodesChange}
        panOnDrag={interactionMode === "drag"}
        panOnScroll={interactionMode === "drag"}
        proOptions={{ hideAttribution: true }}
        selectionKeyCode={interactionMode === "select" ? null : "Meta"}
        selectionMode={
          interactionMode === "select" ? SelectionMode.Partial : undefined
        }
        selectionOnDrag={interactionMode === "select"}
        zoomActivationKeyCode={interactionMode === "drag" ? "Space" : null}
        zoomOnScroll={interactionMode === "drag"}
      >
        <CustomControls />
        {showMiniMap && (
          <MiniMap
            className="border! rounded-lg! border-border/50! bg-card/95! shadow-xl! backdrop-blur-md!"
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
    </div>
  );
}
