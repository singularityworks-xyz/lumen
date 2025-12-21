import { useMemo } from "react";
import { useKanbanStore } from "../store/kanban-store";

export const useTagSuggestions = (
  boardId: string,
  columnId: string,
  currentTags: string[] = []
) => {
  const tasks = useKanbanStore((state) => state.tasks);

  const suggestions = useMemo(() => {
    const usageCount: Record<string, number> = {};
    const inColumn: Set<string> = new Set();
    const existingTags = new Set(currentTags);

    for (const taskId of tasks.allIds) {
      const task = tasks.byId[taskId];
      if (task?.board_id === boardId && task.tags) {
        for (const tag of task.tags) {
          usageCount[tag] = (usageCount[tag] || 0) + 1;
          if (task.column_id === columnId) {
            inColumn.add(tag);
          }
        }
      }
    }

    const scoredTags = Object.keys(usageCount)
      .filter((tag) => !existingTags.has(tag))
      .map((tag) => {
        const score = (inColumn.has(tag) ? 10_000 : 0) + (usageCount[tag] ?? 0);
        return { tag, score };
      });

    scoredTags.sort((a, b) => b.score - a.score);

    return scoredTags.map((item) => item.tag);
  }, [tasks, boardId, columnId, currentTags]);

  return suggestions;
};
