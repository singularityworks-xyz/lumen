/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: Animated ICON */
/** biome-ignore-all lint/a11y/noSvgWithoutTitle: Animated ICON */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: Animated ICON */

"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes, RefObject } from "react";
import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { cn } from "@/src/lib/utils";

export interface GripVerticalIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface GripVerticalIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const CIRCLES = [
  { cx: 9, cy: 5 },
  { cx: 9, cy: 12 },
  { cx: 9, cy: 19 },
  { cx: 15, cy: 5 },
  { cx: 15, cy: 12 },
  { cx: 15, cy: 19 },
];

const ROWS = 3;

const VARIANTS: Variants = {
  normal: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.25, ease: "easeOut" },
  },
  animate: (data: { index: number }) => {
    const row = data.index % ROWS;
    const col = Math.floor(data.index / ROWS);
    const delay = row * 0.15 + col * (ROWS * 0.15 - 0.2);

    return {
      opacity: [1, 0.4, 1],
      scale: [1, 0.85, 1],
      transition: { delay, duration: 1, ease: "easeInOut" },
    };
  },
};

const GripVerticalIcon = ({
  onMouseEnter,
  onMouseLeave,
  className,
  size = 28,
  ref,
  ...props
}: GripVerticalIconProps & {
  ref?: RefObject<GripVerticalIconHandle | null>;
}) => {
  const controls = useAnimation();
  const isControlledRef = useRef(false);
  const isAnimatingRef = useRef(false);

  const startAnimation = useCallback(async () => {
    if (isAnimatingRef.current) {
      return;
    }
    isAnimatingRef.current = true;
    await controls.start("animate");
    await controls.start("normal");
    isAnimatingRef.current = false;
  }, [controls]);

  const stopAnimation = useCallback(async () => {
    if (!isAnimatingRef.current) {
      return;
    }
    await controls.start("normal");
    isAnimatingRef.current = false;
  }, [controls]);

  useEffect(() => {
    if (ref) {
      isControlledRef.current = true;
    }
  }, [ref]);

  useImperativeHandle(ref, () => ({ startAnimation, stopAnimation }));

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isControlledRef.current) {
        startAnimation();
      }
      onMouseEnter?.(e);
    },
    [startAnimation, onMouseEnter]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isControlledRef.current) {
        stopAnimation();
      }
      onMouseLeave?.(e);
    },
    [stopAnimation, onMouseLeave]
  );

  return (
    <div
      className={cn("inline-flex items-center justify-center", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <svg
        aria-hidden="true"
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {CIRCLES.map((circle, index) => (
          <motion.circle
            animate={controls}
            custom={{ index }}
            cx={circle.cx}
            cy={circle.cy}
            initial="normal"
            key={`${circle.cx}-${circle.cy}`}
            r="1"
            variants={VARIANTS}
          />
        ))}
      </svg>
    </div>
  );
};

GripVerticalIcon.displayName = "GripVerticalIcon";
export { GripVerticalIcon };
