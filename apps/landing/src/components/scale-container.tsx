import type React from "react";
import { useEffect, useRef, useState } from "react";

type ScaleContainerProps = {
  children: React.ReactNode;
  contentWidth: number;
  contentHeight: number;
  className?: string;
};

export const ScaleContainer: React.FC<ScaleContainerProps> = ({
  children,
  contentWidth,
  contentHeight,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateScale = () => {
      const { width } = container.getBoundingClientRect();
      if (width === 0) {
        return;
      }
      const newScale = width / contentWidth;
      setScale(newScale);
    };

    const observer = new ResizeObserver(updateScale);
    observer.observe(container);

    updateScale();
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [contentWidth]);

  return (
    <div
      className={`relative w-full max-w-full overflow-hidden ${className}`}
      ref={containerRef}
      style={{ height: contentHeight * scale, width: "100%" }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: contentWidth,
          height: contentHeight,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
