"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { DotLoader } from "./dot-loader";

export interface DotFlowProps {
  items: {
    title: string;
    frames: number[][];
    duration?: number;
    repeatCount?: number;
  }[];
}

export const DotFlow = ({ items }: DotFlowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [textIndex, setTextIndex] = useState(0);

  const { contextSafe } = useGSAP();

  // biome-ignore lint/correctness/useExhaustiveDependencies: nope
  useEffect(() => {
    if (!(containerRef.current && textRef.current)) {
      return;
    }

    const newWidth = textRef.current.offsetWidth + 1;

    gsap.to(containerRef.current, {
      width: newWidth,
      duration: 0.5,
      ease: "power2.out",
    });
  }, [textIndex]);

  const next = contextSafe(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    gsap.to(el, {
      y: 20,
      opacity: 0,
      filter: "blur(8px)",
      duration: 0.5,
      ease: "power2.in",
      onComplete: () => {
        setTextIndex((prev) => (prev + 1) % items.length);
        gsap.fromTo(
          el,
          { y: -20, opacity: 0, filter: "blur(4px)" },
          {
            y: 0,
            opacity: 1,
            filter: "blur(0px)",
            duration: 0.7,
            ease: "power2.out",
          }
        );
      },
    });

    setIndex((prev) => (prev + 1) % items.length);
  });

  return (
    <div className="flex items-center gap-4 rounded bg-black px-4 py-3">
      {items.length > 0 && items[index] && (
        <DotLoader
          className="gap-px"
          dotClassName="bg-white/15 [&.active]:bg-white size-1"
          duration={items[index].duration ?? 150}
          frames={items[index].frames}
          onComplete={next}
          repeatCount={items[index].repeatCount ?? 1}
        />
      )}
      <div className="relative" ref={containerRef}>
        <div
          className="inline-block whitespace-nowrap font-medium text-lg text-white"
          ref={textRef}
        >
          {items[textIndex]?.title}
        </div>
      </div>
    </div>
  );
};
