"use client";

import { X } from "lucide-react";
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

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (title.trim()) {
        const newTask: Task = {
          id: `task-${Date.now()}-${Math.random()}`,
          board_id: boardId,
          column_id: columnId,
          title,
          description,
          priority: "medium",
          progress: 0,
          position: 0,
          created_by: "current-user",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        addTask(boardId, newTask);
        setTitle("");
        setDescription("");
        onClose();
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-border border-b p-6">
            <h2 className="font-bold text-xl">Create New Task</h2>
            <button
              className="text-muted-foreground transition-colors hover:text-foreground"
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
                className="rounded-lg"
                id="task-title"
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title..."
                type="text"
                value={title}
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
                className="w-full resize-none rounded-lg border border-border bg-secondary/30 p-3 text-card-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                id="task-description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details..."
                rows={3}
                value={description}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                className="flex-1 rounded-full"
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-full font-semibold"
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
