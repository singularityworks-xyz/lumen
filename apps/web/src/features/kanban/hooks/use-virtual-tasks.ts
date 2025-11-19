import { useMemo } from "react";
import type { Task } from "../types";

export function useVirtualTasks(
  tasks: Task[],
  containerHeight = 500,
  itemHeight = 120
) {
  const visibleRange = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2;
    return {
      start: 0,
      end: Math.min(visibleCount, tasks.length),
    };
  }, [tasks.length, containerHeight, itemHeight]);

  const virtualTasks = useMemo(
    () => tasks.slice(visibleRange.start, visibleRange.end),
    [tasks, visibleRange]
  );

  const totalHeight = tasks.length * itemHeight;

  return {
    virtualTasks,
    totalHeight,
    visibleRange,
  };
}
