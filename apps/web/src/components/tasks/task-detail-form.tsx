"use client";

import { format } from "date-fns";
import { CalendarIcon, Info, Loader, Plus, Tag, Trash2 } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Calendar } from "@/src/components/ui/calendar";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Slider } from "@/src/components/ui/slider";
import { Textarea } from "@/src/components/ui/textarea";
import {
  type Checklist,
  type Task,
  useKanbanStore,
} from "@/src/features/kanban";
import { cn } from "@/src/lib/utils";
import {
  ScaledPopover,
  ScaledPopoverContent,
  ScaledPopoverTrigger,
  ScaledSelect,
  ScaledSelectContent,
  ScaledSelectItem,
  ScaledSelectTrigger,
  ScaledSelectValue,
} from "../scaled-dropdown";

type TaskDetailFormProps = {
  modalId: string;
  task: Task;
  boardId: string;
  onSaved?: () => void;
  onCancel?: () => void;
};

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "bg-emerald-500", textColor: "text-emerald-500" },
  medium: {
    label: "Medium",
    color: "bg-amber-500",
    textColor: "text-amber-500",
  },
  high: { label: "High", color: "bg-rose-500", textColor: "text-rose-500" },
} as const;

export const TaskDetailForm = memo(
  ({ modalId, task, boardId, onSaved, onCancel }: TaskDetailFormProps) => {
    const updateTask = useKanbanStore((state) => state.updateTask);
    const deleteTask = useKanbanStore((state) => state.deleteTask);
    const closeTaskDetailModal = useKanbanStore(
      (state) => state.closeTaskDetailModal
    );

    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description ?? "");
    const [priority, setPriority] = useState<Task["priority"]>(task.priority);
    const [progress, setProgress] = useState(task.progress);
    const [dueDate, setDueDate] = useState<Date | undefined>(
      task.due_date ? new Date(task.due_date) : undefined
    );
    const [tagsInput, setTagsInput] = useState(task.tags?.join(", ") ?? "");
    const [checklists, setChecklists] = useState<Checklist[]>(
      task.checklists ?? []
    );
    const [newChecklistItem, setNewChecklistItem] = useState("");
    const [titleError, setTitleError] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);

    const formValuesRef = useRef({
      title,
      description,
      priority,
      progress,
      dueDate,
      tagsInput,
      checklists,
    });

    formValuesRef.current = {
      title,
      description,
      priority,
      progress,
      dueDate,
      tagsInput,
      checklists,
    };

    // Auto-save on unmount
    useEffect(
      () => () => {
        const values = formValuesRef.current;
        if (values.title.trim()) {
          const tags =
            values.tagsInput
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean) || undefined;

          updateTask(task.id, {
            title: values.title,
            description: values.description || undefined,
            priority: values.priority,
            progress: values.progress,
            due_date: values.dueDate?.toISOString(),
            tags: tags && tags.length > 0 ? tags : undefined,
            checklists: values.checklists,
          });
        }
      },
      [task.id, updateTask]
    );

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

    const handleSave = (e: React.FormEvent) => {
      e.preventDefault();

      if (!title.trim()) {
        setTitleError(true);
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 300);
        return;
      }

      const tags =
        tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean) || undefined;

      updateTask(task.id, {
        title,
        description: description || undefined,
        priority,
        progress,
        due_date: dueDate?.toISOString(),
        tags: tags && tags.length > 0 ? tags : undefined,
        checklists,
      });

      if (onSaved) {
        onSaved();
      } else {
        closeTaskDetailModal(modalId);
      }
    };

    const handleDelete = () => {
      deleteTask(boardId, task.id);
      closeTaskDetailModal(modalId);
    };

    const handleTitleChange = (value: string) => {
      setTitle(value);
      if (value.trim()) {
        setTitleError(false);
      }
    };

    const completedCount = checklists.filter((c) => c.completed).length;

    return (
      <form className="flex h-full flex-col" onSubmit={handleSave}>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-2">
            <Label htmlFor={`task-title-${modalId}`}>
              Task Title <span className="text-destructive">*</span>
            </Label>
            <Input
              autoFocus
              className={cn(
                "rounded-lg border border-border/30 bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]",
                titleError && "border-destructive ring-2 ring-destructive/20",
                isShaking && "animate-shake"
              )}
              id={`task-title-${modalId}`}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Task title"
              type="text"
              value={title}
            />
            {titleError && (
              <p className="text-destructive text-xs">Title is required</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`task-priority-${modalId}`}>Priority</Label>
              <ScaledSelect
                onValueChange={(v) => setPriority(v as Task["priority"])}
                value={priority}
              >
                <ScaledSelectTrigger
                  className="w-full rounded-lg border border-border/30 bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all hover:bg-muted focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] data-[state=open]:border-primary/50 data-[state=open]:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:data-[state=open]:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)] dark:hover:bg-muted"
                  id={`task-priority-${modalId}`}
                >
                  <ScaledSelectValue placeholder="Select priority" />
                </ScaledSelectTrigger>
                <ScaledSelectContent position="popper" sideOffset={4}>
                  {(Object.keys(PRIORITY_CONFIG) as Task["priority"][]).map(
                    (p) => (
                      <ScaledSelectItem key={p} value={p}>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              PRIORITY_CONFIG[p].color
                            )}
                          />
                          {PRIORITY_CONFIG[p].label}
                        </div>
                      </ScaledSelectItem>
                    )
                  )}
                </ScaledSelectContent>
              </ScaledSelect>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <ScaledPopover onOpenChange={setCalendarOpen} open={calendarOpen}>
                <ScaledPopoverTrigger asChild>
                  <Button
                    className={cn(
                      "w-full justify-start rounded-lg border border-border/30 bg-muted/80 text-left font-normal shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] hover:bg-muted dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:hover:bg-muted",
                      !dueDate && "text-muted-foreground"
                    )}
                    variant="ghost"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                  </Button>
                </ScaledPopoverTrigger>
                <ScaledPopoverContent
                  align="start"
                  className="w-auto p-0"
                  sideOffset={4}
                >
                  <Calendar
                    mode="single"
                    onSelect={(date) => {
                      setDueDate(date);
                      setCalendarOpen(false);
                    }}
                    selected={dueDate}
                  />
                  {dueDate && (
                    <div className="border-t p-2">
                      <Button
                        className="w-full"
                        onClick={() => {
                          setDueDate(undefined);
                          setCalendarOpen(false);
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Clear date
                      </Button>
                    </div>
                  )}
                </ScaledPopoverContent>
              </ScaledPopover>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>
                <Loader className="h-3.5 w-3.5" />
                Progress
              </Label>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 font-semibold text-xs",
                  progress === 100 &&
                    "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                  progress >= 50 &&
                    progress < 100 &&
                    "bg-amber-500/20 text-amber-600 dark:text-amber-400",
                  progress < 50 && "bg-muted text-muted-foreground"
                )}
              >
                {progress}%
              </span>
            </div>
            <div className="rounded-md border border-border/30 bg-muted/80 px-3 py-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)]">
              <Slider
                className="**:data-[slot=slider-thumb]:h-5 **:data-[slot=slider-thumb]:w-5 **:data-[slot=slider-thumb]:border-0 **:data-[slot=slider-thumb]:bg-foreground **:data-[slot=slider-thumb]:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.1)] dark:**:data-[slot=slider-thumb]:bg-muted-foreground dark:**:data-[slot=slider-thumb]:shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.15)]"
                max={100}
                min={0}
                onValueChange={([v]) => setProgress(v ?? 0)}
                step={5}
                value={[progress]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              className="flex items-center gap-1.5"
              htmlFor={`task-tags-${modalId}`}
            >
              <Tag className="h-3.5 w-3.5" />
              Tags
              <span className="font-normal text-muted-foreground text-xs">
                (comma separated)
              </span>
            </Label>
            <Input
              className="rounded-lg border border-border/30 bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
              id={`task-tags-${modalId}`}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="design, research, bug"
              value={tagsInput}
            />
            {tagsInput && (
              <div className="flex flex-wrap gap-1">
                {tagsInput
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .map((tag) => (
                    <span
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`task-description-${modalId}`}>
              <Info className="h-3.5 w-3.5" />
              Description
              <span className="ml-1 font-normal text-muted-foreground text-xs">
                (Optional)
              </span>
            </Label>
            <Textarea
              className="min-h-20 resize-none rounded-lg border border-border/30 bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
              id={`task-description-${modalId}`}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details about this task..."
              value={description}
            />
          </div>

          {/* Checklist Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">Checklist</Label>
              {checklists.length > 0 && (
                <span className="text-muted-foreground text-xs">
                  {completedCount}/{checklists.length} completed
                </span>
              )}
            </div>

            {checklists.length > 0 && (
              <div className="space-y-2">
                {checklists.map((item) => (
                  <div
                    className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/80 p-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-colors hover:bg-muted dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)]"
                    key={item.id}
                  >
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => handleToggleChecklist(item.id)}
                    />
                    <span
                      className={cn(
                        "flex-1 text-sm",
                        item.completed
                          ? "text-muted-foreground line-through"
                          : "text-card-foreground"
                      )}
                    >
                      {item.title}
                    </span>
                    <button
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      onClick={() => handleDeleteChecklist(item.id)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                className="rounded-lg border border-border/30 bg-muted/80 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddChecklist();
                  }
                }}
                placeholder="Add checklist item..."
                value={newChecklistItem}
              />
              <Button
                className="rounded-lg bg-card/80 shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
                onClick={handleAddChecklist}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t bg-muted/95 px-3 py-2 dark:bg-secondary/95">
          <Button
            className="h-7 rounded-md bg-destructive/90 text-destructive-foreground text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-destructive dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
            onClick={handleDelete}
            type="button"
            variant="destructive"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete
          </Button>
          <div className="flex-1" />
          <Button
            className="h-7 rounded-md bg-card/80 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
            onClick={() =>
              onCancel ? onCancel() : closeTaskDetailModal(modalId)
            }
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            className="h-7 rounded-md bg-primary/90 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
            type="submit"
          >
            Save Changes
          </Button>
        </div>
      </form>
    );
  }
);

TaskDetailForm.displayName = "TaskDetailForm";
