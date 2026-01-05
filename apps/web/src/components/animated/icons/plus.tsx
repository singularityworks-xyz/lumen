/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: Animated ICON */
/** biome-ignore-all lint/a11y/noSvgWithoutTitle: Animated ICON */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: Animated ICON */

"use client";

import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes, Ref } from "react";
import { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { cn } from "@/src/lib/utils";

export type PlusIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

interface PlusIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const PlusIcon = ({
  onMouseEnter,
  onMouseLeave,
  className,
  size = 28,
  ref,
  ...props
}: PlusIconProps & { ref?: Ref<PlusIconHandle> }) => {
  const controls = useAnimation();
  const isControlledRef = useRef(false);

  useEffect(() => {
    if (ref) {
      isControlledRef.current = true;
    }
  }, [ref]);

  useImperativeHandle(ref, () => ({
    startAnimation: () => controls.start("animate"),
    stopAnimation: () => controls.start("normal"),
  }));

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseEnter?.(e);
      } else {
        controls.start("animate");
      }
    },
    [controls, onMouseEnter]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseLeave?.(e);
      } else {
        controls.start("normal");
      }
    },
    [controls, onMouseLeave]
  );

  return (
    <div
      className={cn(className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <motion.svg
        animate={controls}
        aria-hidden="true"
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
        variants={{
          normal: {
            rotate: 0,
          },
          animate: {
            rotate: 180,
          },
        }}
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </motion.svg>
    </div>
  );
};

PlusIcon.displayName = "PlusIcon";

export { PlusIcon };
