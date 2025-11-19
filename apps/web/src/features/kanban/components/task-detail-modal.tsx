"use client";

import { Calendar, Plus, Trash2, X } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Input } from "@/src/components/ui/input";
import { useKanbanStore } from "../store/kanban-store";
import type { Checklist, Task } from "../types";

type TaskDetailModalProps = {
  task: Task;
  boardId: string;
};

export const TaskDetailModal = memo(
  ({ task, boardId }: TaskDetailModalProps) => {
    const updateTask = useKanbanStore((state) => state.updateTask);
    const deleteTask = useKanbanStore((state) => state.deleteTask);
    const clearTaskSelection = useKanbanStore(
      (state) => state.clearTaskSelection
    );

    const [editedTask, setEditedTask] = useState(task);
    const [newChecklistItem, setNewChecklistItem] = useState("");
    const [checklists, setChecklists] = useState(task.checklists || []);

    const handleAddChecklist = () => {
      if (newChecklistItem.trim()) {
        const newItem: Checklist = {
          id: Math.random().toString(),
          task_id: task.id,
          title: newChecklistItem,
          completed: false,
          position: checklists.length,
        };
        setChecklists([...checklists, newItem]);
        setNewChecklistItem("");
      }
    };

    const handleToggleChecklist = (id: string) => {
      setChecklists(
        checklists.map((item) =>
          item.id === id ? { ...item, completed: !item.completed } : item
        )
      );
    };

    const handleDeleteChecklist = (id: string) => {
      setChecklists(checklists.filter((item) => item.id !== id));
    };

    const handleSave = () => {
      updateTask(boardId, task.id, { ...editedTask, checklists });
      clearTaskSelection();
    };

    const handleDelete = () => {
      deleteTask(boardId, task.id);
      clearTaskSelection();
    };

    const handleClose = () => {
      clearTaskSelection();
    };

    const completedCount = checklists.filter((c) => c.completed).length;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded border border-border bg-card shadow-2xl">
          <div className="sticky top-0 flex items-start justify-between border-border border-b bg-card p-6">
            <div className="flex-1">
              <input
                className="w-full rounded bg-transparent px-1 font-bold text-2xl text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                onChange={(e) =>
                  setEditedTask({ ...editedTask, title: e.target.value })
                }
                type="text"
                value={editedTask.title}
              />
            </div>
            <button
              className="text-muted-foreground transition-colors hover:text-card-foreground"
              onClick={handleClose}
              type="button"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6 p-6">
            <div className="space-y-2">
              <label
                className="font-semibold text-card-foreground text-sm"
                htmlFor="task-description"
              >
                Description
              </label>
              <textarea
                className="w-full resize-none rounded-lg border border-border bg-secondary/30 p-3 text-card-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                id="task-description"
                onChange={(e) =>
                  setEditedTask({ ...editedTask, description: e.target.value })
                }
                placeholder="Add task description..."
                rows={4}
                value={editedTask.description || ""}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  className="font-semibold text-card-foreground text-sm"
                  htmlFor="task-progress"
                >
                  Progress
                </label>
                <span className="text-muted-foreground text-sm">
                  {editedTask.progress}%
                </span>
              </div>
              <input
                className="w-full"
                id="task-progress"
                max="100"
                min="0"
                onChange={(e) =>
                  setEditedTask({
                    ...editedTask,
                    progress: Number.parseInt(e.target.value, 10),
                  })
                }
                type="range"
                value={editedTask.progress}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  className="font-semibold text-card-foreground text-sm"
                  htmlFor="task-priority"
                >
                  Priority
                </label>
                <select
                  className="w-full rounded-lg border border-border bg-secondary/30 p-2 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  id="task-priority"
                  onChange={(e) =>
                    setEditedTask({
                      ...editedTask,
                      priority: e.target.value as Task["priority"],
                    })
                  }
                  value={editedTask.priority}
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
                  <input
                    className="w-full rounded-lg border border-border bg-secondary/30 p-2 text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    id="task-due-date"
                    onChange={(e) =>
                      setEditedTask({
                        ...editedTask,
                        due_date: e.target.value,
                      })
                    }
                    type="date"
                    value={editedTask.due_date?.split("T")[0] || ""}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-card-foreground text-sm">
                  Checklist
                </div>
                {checklists.length > 0 && (
                  <span className="text-muted-foreground text-xs">
                    {completedCount}/{checklists.length} completed
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {checklists.map((item) => (
                  <div
                    className="flex items-center gap-3 rounded-lg bg-secondary/20 p-2 transition-colors hover:bg-secondary/30"
                    key={item.id}
                  >
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => handleToggleChecklist(item.id)}
                    />
                    <span
                      className={`flex-1 text-sm ${
                        item.completed
                          ? "text-muted-foreground line-through"
                          : "text-card-foreground"
                      }`}
                    >
                      {item.title}
                    </span>
                    {/** biome-ignore lint/a11y/useButtonType: TODO: refactor later */}
                    <button
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      onClick={() => handleDeleteChecklist(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  className="text-sm"
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddChecklist()}
                  placeholder="Add checklist item..."
                  value={newChecklistItem}
                />
                <Button
                  className="rounded-lg"
                  onClick={handleAddChecklist}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-3 border-border border-t pt-4">
              <Button
                className="flex-1 rounded-full font-semibold"
                onClick={handleSave}
              >
                Save Changes
              </Button>
              <Button
                className="rounded-full font-semibold"
                onClick={handleDelete}
                variant="destructive"
              >
                Delete Task
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

TaskDetailModal.displayName = "TaskDetailModal";
