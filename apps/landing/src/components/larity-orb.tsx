"use client";

import { Dithering } from "@paper-design/shaders-react";
import { memo, useMemo } from "react";

type LarityOrbSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LarityOrbProps {
  className?: string;
  size?: LarityOrbSize;
  speed?: number;
}

const sizeMap: Record<LarityOrbSize, { dimension: number; pixelSize: number }> =
  {
    xs: { dimension: 20, pixelSize: 1 },
    sm: { dimension: 28, pixelSize: 1.5 },
    md: { dimension: 40, pixelSize: 2 },
    lg: { dimension: 64, pixelSize: 2.5 },
    xl: { dimension: 96, pixelSize: 3 },
  };

const isWebGlAvailable = (() => {
  let cached: boolean | null = null;
  return () => {
    if (cached !== null) {
      return cached;
    }
    if (typeof document === "undefined") {
      cached = false;
      return false;
    }
    try {
      const canvas = document.createElement("canvas");
      cached = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
      cached = false;
    }
    return cached;
  };
})();

// Fallback sphere rendered when WebGL is unavailable (test env, low-end
// devices). Same silhouette as the shader orb: a light dithered sphere.
const FallbackOrb = memo(({ dimension }: { dimension: number }) => {
  const dots = useMemo(() => {
    const rows: { left: number; top: number; opacity: number }[] = [];
    const step = dimension / 10;
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 10; x += 1) {
        const nx = (x + 0.5) / 10 - 0.5;
        const ny = (y + 0.5) / 10 - 0.5;
        const d = Math.sqrt(nx * nx + ny * ny);
        if (d > 0.52) {
          continue;
        }
        // Sphere shading: bright near the upper-left light, dark toward the
        // lower-right rim.
        const shade = 0.92 - d * 1.15 + (0.5 - nx) * 0.35;
        rows.push({
          left: x * step,
          top: y * step,
          opacity: Math.min(1, Math.max(0.08, shade)),
        });
      }
    }
    return rows;
  }, [dimension]);

  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden rounded-full"
      style={{ width: dimension, height: dimension }}
    >
      {dots.map((dot) => (
        <div
          className="absolute h-[6%] w-[6%] rounded-[1px] bg-white"
          key={`${dot.left}-${dot.top}`}
          style={{
            left: `${(dot.left / dimension) * 100}%`,
            top: `${(dot.top / dimension) * 100}%`,
            opacity: dot.opacity,
          }}
        />
      ))}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow:
            "inset 0 2px 6px rgba(255,255,255,0.25), inset 0 -4px 10px rgba(0,0,0,0.55)",
        }}
      />
    </div>
  );
});

FallbackOrb.displayName = "FallbackOrb";

export const LarityOrb = memo(
  ({ size = "md", className, speed = 0.5 }: LarityOrbProps) => {
    const { dimension, pixelSize } = sizeMap[size];
    const useShader = isWebGlAvailable();

    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-full ${className ?? ""}`}
        style={{
          width: dimension,
          height: dimension,
          minWidth: dimension,
          minHeight: dimension,
        }}
      >
        {useShader ? (
          <Dithering
            colorBack="#00000000"
            colorFront="#ffffff"
            scale={0.8}
            shape="sphere"
            size={pixelSize}
            speed={speed}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
            }}
            type="4x4"
          />
        ) : (
          <FallbackOrb dimension={dimension} />
        )}
      </div>
    );
  }
);

LarityOrb.displayName = "LarityOrb";

export default LarityOrb;
