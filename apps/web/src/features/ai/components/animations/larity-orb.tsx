"use client";

import { Dithering } from "@paper-design/shaders-react";
import { memo } from "react";
import { cn } from "@/src/lib/utils";

export type LarityOrbSize = "xs" | "sm" | "md" | "lg" | "xl";

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

export const LarityOrb = memo(
  ({ size = "md", className, speed = 0.5 }: LarityOrbProps) => {
    const { dimension, pixelSize } = sizeMap[size];

    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full",
          "flex items-center justify-center",
          className
        )}
        style={{
          width: dimension,
          height: dimension,
          minWidth: dimension,
          minHeight: dimension,
        }}
      >
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
      </div>
    );
  }
);

LarityOrb.displayName = "LarityOrb";

export default LarityOrb;
