"use client";

import { useEffect, useRef } from "react";

const COLOR_MAP: Record<string, string> = {
  primary: "var(--primary)",
  destructive: "#ef4444",
  amber: "#f59e0b",
  emerald: "#10b981",
};

const FILL_MAP: Record<string, string> = {
  primary: "var(--primary)",
  destructive: "#ef4444",
  amber: "#f59e0b",
  emerald: "#10b981",
};

function computePath(sx: number, sy: number, ex: number, ey: number): string {
  const dx = Math.abs(ex - sx);
  const co = Math.min(dx * 0.4, 60);
  const dir = ex >= sx ? 1 : -1;
  return `M ${sx} ${sy} C ${sx + dir * co} ${sy}, ${ex - dir * co} ${ey}, ${ex} ${ey}`;
}

interface UseImperativeConnectorOptions {
  color?: "primary" | "destructive" | "amber" | "emerald";
  customColor?: string;
  endOffsetY?: number;
  hideEndNode?: boolean;
  hideStartNode?: boolean;
  lineStyle?: "dotted" | "solid";
  portalTarget?: HTMLElement | null;
  portalTargetId?: string;
  showArrow?: boolean;
  sourceElement?: HTMLElement | null;
  sourceSelector?: string;
  targetNodeId?: string;
  zIndex?: number;
}

export function useImperativeConnector(options: UseImperativeConnectorOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const opts = optionsRef.current;
    const portalTarget =
      opts.portalTarget ??
      document.getElementById(opts.portalTargetId ?? "board-connector-layer");
    if (!portalTarget) {
      return;
    }

    const color = opts.color ?? "primary";
    const customColor = opts.customColor;
    const lineStyle = opts.lineStyle ?? "dotted";
    const showArrow = opts.showArrow ?? false;
    const hideStartNode = opts.hideStartNode ?? false;
    const hideEndNode = opts.hideEndNode ?? false;
    const zIndex = opts.zIndex ?? 9996;

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.style.position = "fixed";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.width = "100vw";
    svg.style.height = "100vh";
    svg.style.pointerEvents = "none";
    svg.style.zIndex = String(zIndex);

    const marker = document.createElementNS(ns, "marker");
    const strokeColor = customColor ?? COLOR_MAP[color] ?? "var(--primary)";
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("refX", "9");
    marker.setAttribute("refY", "3.5");
    const polygon = document.createElementNS(ns, "polygon");
    polygon.setAttribute("fill", strokeColor);
    polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
    marker.appendChild(polygon);
    svg.appendChild(marker);

    const path = document.createElementNS(ns, "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke", strokeColor);
    path.setAttribute("stroke-opacity", lineStyle === "solid" ? "0.8" : "0.6");
    if (lineStyle === "dotted") {
      path.setAttribute("stroke-dasharray", "6 6");
    }
    if (showArrow) {
      marker.id = `arrow-${Date.now()}`;
      path.setAttribute("marker-end", `url(#${marker.id})`);
    }
    svg.appendChild(path);

    const fillColor = customColor ?? FILL_MAP[color] ?? "var(--primary)";
    let startCircle: SVGCircleElement | null = null;
    let endCircle: SVGCircleElement | null = null;

    if (!hideStartNode) {
      startCircle = document.createElementNS(ns, "circle");
      startCircle.setAttribute("r", "5");
      startCircle.setAttribute("fill", fillColor);
      svg.appendChild(startCircle);
    }

    if (!(hideEndNode || showArrow)) {
      endCircle = document.createElementNS(ns, "circle");
      endCircle.setAttribute("r", "5");
      endCircle.setAttribute("fill", fillColor);
      svg.appendChild(endCircle);
    }

    portalTarget.appendChild(svg);

    if (lineStyle === "dotted") {
      const animate = document.createElementNS(ns, "animate");
      animate.setAttribute("attributeName", "stroke-dashoffset");
      animate.setAttribute("dur", "0.6s");
      animate.setAttribute("from", "0");
      animate.setAttribute("repeatCount", "indefinite");
      animate.setAttribute("to", "-12");
      path.appendChild(animate);
    }

    let rafId: number;

    const tick = () => {
      const currentOpts = optionsRef.current;

      let startX: number;
      let startY: number;

      if (currentOpts.sourceElement) {
        const rect = currentOpts.sourceElement.getBoundingClientRect();
        startX = rect.right;
        startY = rect.top + rect.height / 2;
      } else if (currentOpts.sourceSelector) {
        const el = document.querySelector(
          currentOpts.sourceSelector
        ) as HTMLElement;
        if (!el) {
          path.setAttribute("d", "");
          rafId = requestAnimationFrame(tick);
          return;
        }
        const rect = el.getBoundingClientRect();
        startX = rect.right;
        startY = rect.top + rect.height / 2;
      } else {
        path.setAttribute("d", "");
        rafId = requestAnimationFrame(tick);
        return;
      }

      let endX: number;
      let endY: number;

      if (currentOpts.targetNodeId) {
        const targetEl = document.querySelector(
          `.react-flow__node[data-id="${currentOpts.targetNodeId}"]`
        ) as HTMLElement;
        if (!targetEl) {
          path.setAttribute("d", "");
          rafId = requestAnimationFrame(tick);
          return;
        }
        const targetRect = targetEl.getBoundingClientRect();
        if (targetRect.right < startX) {
          // Target is to the left of source
          if (currentOpts.sourceElement) {
            startX = currentOpts.sourceElement.getBoundingClientRect().left;
          } else if (currentOpts.sourceSelector) {
            const el = document.querySelector(
              currentOpts.sourceSelector
            ) as HTMLElement;
            if (el) {
              startX = el.getBoundingClientRect().left;
            }
          }
          endX = targetRect.right;
        } else {
          endX = targetRect.left;
        }
        endY = targetRect.top + (currentOpts.endOffsetY ?? 24);
      } else {
        path.setAttribute("d", "");
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (
        !(
          Number.isFinite(startX) &&
          Number.isFinite(startY) &&
          Number.isFinite(endX) &&
          Number.isFinite(endY)
        )
      ) {
        path.setAttribute("d", "");
        rafId = requestAnimationFrame(tick);
        return;
      }

      const d = computePath(startX, startY, endX, endY);
      path.setAttribute("d", d);

      if (startCircle) {
        startCircle.setAttribute("cx", String(startX));
        startCircle.setAttribute("cy", String(startY));
      }
      if (endCircle) {
        endCircle.setAttribute("cx", String(endX));
        endCircle.setAttribute("cy", String(endY));
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      svg.remove();
    };
  }, []);
}
