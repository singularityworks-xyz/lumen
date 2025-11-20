"use client";

import { Calendar, Tag, X } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useKanbanStore } from "../store/kanban-store";
import type { Task } from "../types";

type CreateTaskModalProps = {
  columnId: string;
  boardId: string;
  onClose: () => void;
};

export const CreateTaskModal = memo(
  ({ columnId, boardId, onClose }: CreateTaskModalProps) => {
    const addTask = useKanbanStore((state) => state.addTask);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<Task["priority"]>("medium");
    const [progress, setProgress] = useState(0);
    const [dueDate, setDueDate] = useState("");
    const [tagsInput, setTagsInput] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (title.trim()) {
        const tags =
          tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean) || undefined;

        const newTask: Task = {
          id: `task-${Date.now()}-${Math.random()}`,
          board_id: boardId,
          column_id: columnId,
          title,
          description,
          priority,
          progress,
          position: 0,
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
          created_by: "current-user",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (tags && tags.length > 0) {
          newTask.tags = tags;
        }
        addTask(boardId, newTask);
        setTitle("");
        setDescription("");
        setPriority("medium");
        setProgress(0);
        setDueDate("");
        setTagsInput("");
        onClose();
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-lg border-2 border-border/50 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-border border-b p-6 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
            <h2 className="font-bold text-xl">Create New Task</h2>
            <button
              className="rounded-full bg-card/50 p-1 text-muted-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:text-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
              onClick={onClose}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form className="space-y-4 p-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label
                className="font-semibold text-card-foreground text-sm"
                htmlFor="task-title"
              >
                Task Title
              </label>
              <Input
                autoFocus
                className="rounded-lg border-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                id="task-title"
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title..."
                type="text"
                value={title}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label
                  className="font-semibold text-card-foreground text-sm"
                  htmlFor="task-priority"
                >
                  Priority
                </label>
                <select
                  className="w-full rounded-lg border-2 border-border bg-secondary/30 p-2 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  id="task-priority"
                  onChange={(e) =>
                    setPriority(e.target.value as Task["priority"])
                  }
                  value={priority}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="space-y-2">
                <label
                  className="font-semibold text-card-foreground text-sm"
                  htmlFor="task-due-date"
                >
                  Due Date
                </label>
                <div className="flex items-center">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="rounded-lg border-2 border-border bg-secondary/30 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    id="task-due-date"
                    onChange={(e) => setDueDate(e.target.value)}
                    type="date"
                    value={dueDate}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="font-semibold text-card-foreground text-sm"
                htmlFor="task-progress"
              >
                Initial Progress
              </label>
              <div className="flex items-center gap-3">
                <input
                  className="flex-1"
                  id="task-progress"
                  max={100}
                  min={0}
                  onChange={(e) =>
                    setProgress(Number.parseInt(e.target.value, 10) || 0)
                  }
                  type="range"
                  value={progress}
                />
                <span className="w-10 text-right text-muted-foreground text-sm">
                  {progress}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="flex items-center gap-1 font-semibold text-card-foreground text-sm"
                htmlFor="task-tags"
              >
                <Tag className="h-3.5 w-3.5" />
                Tags
                <span className="text-[11px] text-muted-foreground">
                  (comma separated)
                </span>
              </label>
              <Input
                id="task-tags"
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="design, research, bug"
                value={tagsInput}
              />
            </div>

            <div className="space-y-2">
              <label
                className="font-semibold text-card-foreground text-sm"
                htmlFor="task-description"
              >
                Description (Optional)
              </label>
              <textarea
                className="w-full resize-none rounded-lg border-2 border-border bg-secondary/30 p-3 text-card-foreground placeholder-muted-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] focus:outline-none focus:ring-2 focus:ring-primary dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                id="task-description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details..."
                rows={3}
                value={description}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                className="flex-1 rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-full font-semibold shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
                disabled={!title.trim()}
                type="submit"
              >
                Create Task
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }
);

CreateTaskModal.displayName = "CreateTaskModal";
