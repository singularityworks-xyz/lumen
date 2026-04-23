"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { useKanbanStore } from "@/src/features/kanban/store";
import { Z_INDEX_BASE } from "@/src/features/kanban/store/slices/z-index-slice";

// Computes a cubic bezier SVG path between two screen-space points.
function computePath(sx: number, sy: number, ex: number, ey: number): string {
  const dx = Math.abs(ex - sx);
  const co = Math.min(dx * 0.4, 60);
  return `M ${sx} ${sy} C ${sx + co} ${sy}, ${ex - co} ${ey}, ${ex} ${ey}`;
}

interface ConnectionMeta {
  boardId: string;
  color: string | undefined;
  id: string;
  isTopmost: boolean;
  modalNodeId: string;
  sourceTaskId: string;
  zIndex: number;
}

export const TaskConnectionLayer = memo(() => {
  // Structural subscriptions only — these change when modals open/close, not during drag
  const taskDetailModals = useKanbanStore((state) => state.taskDetailModals);
  const tasks = useKanbanStore((state) => state.tasks);
  const columns = useKanbanStore((state) => state.columns);
  const _dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);

  // Persistent SVG container refs — created once, mutated directly via DOM API
  const focusedSvgRef = useRef<SVGSVGElement | null>(null);
  const unfocusedSvgRef = useRef<SVGSVGElement | null>(null);
  const pathMapRef = useRef<
    Map<string, { path: SVGPathElement; title: SVGTitleElement }>
  >(new Map());
  const connectorLayerRef = useRef<HTMLElement | null>(null);

  // Resolve the connector layer target once on mount
  useEffect(() => {
    connectorLayerRef.current = document.getElementById(
      "board-connector-layer"
    );
  }, []);

  // Build connection metadata from store state.
  // Only recomputes when modals/tasks/columns/focus change — NOT during drag.
  const buildConnections = useCallback((): ConnectionMeta[] => {
    const result: ConnectionMeta[] = [];
    const focusStack = useKanbanStore.getState().dialogFocusStack;

    for (const modal of Object.values(taskDetailModals)) {
      if (modal.openedFromQuickActions) {
        continue;
      }
      const task = tasks.byId[modal.sourceTaskId];
      if (!task) {
        continue;
      }
      const column = columns.byId[task.column_id];
      const dialogId = `task-detail-modal-${modal.id}`;
      const isTopmost = focusStack.at(-1) === dialogId;
      const connectorZIndex = Z_INDEX_BASE.DIALOGS + focusStack.length * 10 + 5;

      result.push({
        id: modal.id,
        sourceTaskId: modal.sourceTaskId,
        boardId: task.board_id,
        modalNodeId: `task-detail-modal-${modal.id}`,
        color: column?.accentColor,
        zIndex: connectorZIndex,
        isTopmost,
      });
    }
    return result;
  }, [taskDetailModals, tasks, columns]);

  // Helper: creates an SVG element sized to the full viewport
  const createSvgContainer = useCallback((): SVGSVGElement => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.position = "fixed";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.width = "100vw";
    svg.style.height = "100vh";
    svg.style.pointerEvents = "none";
    return svg;
  }, []);

  // The main RAF loop.
  // Reads element positions directly from the DOM via getBoundingClientRect().
  // This is guaranteed to reflect real-time positions because React Flow
  // updates CSS transforms on node elements immediately during drag,
  // even though its internal store lags behind by one React render cycle.
  // Zero React re-renders — only DOM reads + SVG path mutations.
  useEffect(() => {
    const connections = buildConnections();
    const pathMap = pathMapRef.current;

    // No connections → clean up and bail
    if (connections.length === 0) {
      for (const { path } of pathMap.values()) {
        path.remove();
      }
      pathMap.clear();
      if (focusedSvgRef.current) {
        focusedSvgRef.current.style.display = "none";
      }
      if (unfocusedSvgRef.current) {
        unfocusedSvgRef.current.style.display = "none";
      }
      return;
    }

    // Ensure SVG containers exist
    if (!focusedSvgRef.current) {
      focusedSvgRef.current = createSvgContainer();
      document.body.appendChild(focusedSvgRef.current);
    }
    if (!unfocusedSvgRef.current && connectorLayerRef.current) {
      unfocusedSvgRef.current = createSvgContainer();
      unfocusedSvgRef.current.style.zIndex = "0";
      connectorLayerRef.current.appendChild(unfocusedSvgRef.current);
    }

    // Show SVGs
    if (focusedSvgRef.current) {
      focusedSvgRef.current.style.display = "";
    }
    if (unfocusedSvgRef.current) {
      unfocusedSvgRef.current.style.display = "";
    }

    // Reconcile SVG path elements (add/remove as connections change)
    const activeIds = new Set(connections.map((c) => c.id));
    for (const [id, { path }] of pathMap) {
      if (!activeIds.has(id)) {
        path.remove();
        pathMap.delete(id);
      }
    }

    for (const conn of connections) {
      let entry = pathMap.get(conn.id);
      const targetSvg = conn.isTopmost
        ? focusedSvgRef.current
        : unfocusedSvgRef.current;

      if (!entry) {
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-width", "2");
        const title = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "title"
        );
        title.textContent = "Connection to task detail modal";
        path.appendChild(title);
        entry = { path, title };
        pathMap.set(conn.id, entry);
      }

      // Update path styles
      if (conn.color) {
        entry.path.setAttribute("stroke", conn.color);
        entry.path.classList.remove("stroke-primary");
      } else {
        entry.path.removeAttribute("stroke");
        entry.path.classList.add("stroke-primary");
      }
      entry.path.setAttribute("stroke-opacity", conn.isTopmost ? "0.7" : "0.4");

      // Move path to correct SVG container if needed
      if (targetSvg && entry.path.parentNode !== targetSvg) {
        targetSvg.appendChild(entry.path);
      }
    }

    // Update focused SVG z-index
    if (focusedSvgRef.current) {
      const maxZ = Math.max(
        ...connections.filter((c) => c.isTopmost).map((c) => c.zIndex),
        Z_INDEX_BASE.DIALOGS
      );
      focusedSvgRef.current.style.zIndex = String(maxZ);
    }

    // RAF loop: pure DOM reads → SVG path mutations.
    // getBoundingClientRect() returns the ACTUAL screen position of elements,
    // which React Flow updates immediately via CSS transforms during drag.
    // No dependency on React Flow's internal store or getNodes().
    let rafId: number;
    const tick = () => {
      for (const conn of connections) {
        const entry = pathMap.get(conn.id);
        if (!entry) {
          continue;
        }

        // Read task card and modal positions directly from the DOM
        const taskEl = document.querySelector(
          `[data-task-id="${conn.sourceTaskId}"]`
        ) as HTMLElement | null;
        const modalEl = document.querySelector(
          `.react-flow__node[data-id="${conn.modalNodeId}"]`
        ) as HTMLElement | null;

        if (!(taskEl && modalEl)) {
          entry.path.setAttribute("d", "");
          continue;
        }

        const taskRect = taskEl.getBoundingClientRect();
        const modalRect = modalEl.getBoundingClientRect();

        if (
          taskRect.width === 0 ||
          taskRect.height === 0 ||
          modalRect.width === 0
        ) {
          entry.path.setAttribute("d", "");
          continue;
        }

        // Start point: right edge of task card, vertically centered
        const startX = taskRect.right;
        const startY = taskRect.top + taskRect.height / 2;

        // End point: left edge of modal dialog, offset 24px down for title bar
        const endX = modalRect.left;
        const endY = modalRect.top + 24;

        if (
          !(
            Number.isFinite(startX) &&
            Number.isFinite(startY) &&
            Number.isFinite(endX) &&
            Number.isFinite(endY)
          )
        ) {
          entry.path.setAttribute("d", "");
          continue;
        }

        entry.path.setAttribute("d", computePath(startX, startY, endX, endY));
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [buildConnections, createSvgContainer]);

  // Clean up SVG elements on unmount
  useEffect(
    () => () => {
      if (focusedSvgRef.current) {
        focusedSvgRef.current.remove();
        focusedSvgRef.current = null;
      }
      if (unfocusedSvgRef.current) {
        unfocusedSvgRef.current.remove();
        unfocusedSvgRef.current = null;
      }
      for (const { path } of pathMapRef.current.values()) {
        path.remove();
      }
      pathMapRef.current.clear();
    },
    []
  );

  // Renders nothing — all DOM is managed imperatively via RAF
  return null;
});

TaskConnectionLayer.displayName = "TaskConnectionLayer";
