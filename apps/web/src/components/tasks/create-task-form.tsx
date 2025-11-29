"use client";

import { format } from "date-fns";
import { CalendarIcon, Tag } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Calendar } from "@/src/components/ui/calendar";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Slider } from "@/src/components/ui/slider";
import { Textarea } from "@/src/components/ui/textarea";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";
import type {
  Column,
  CreateTaskModalState,
  Task,
} from "../../features/kanban/types";
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

type CreateTaskFormProps = {
  modalId: string;
  modalState: CreateTaskModalState;
  selectedBoardColumns: Column[];
  selectedColumnId: string;
  onColumnChange: (columnId: string) => void;
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

export const CreateTaskForm = memo(
  ({
    modalId,
    modalState,
    selectedBoardColumns,
    selectedColumnId,
    onColumnChange,
  }: CreateTaskFormProps) => {
    const { formData, boardId } = modalState;

    const addTask = useKanbanStore((state) => state.addTask);
    const updateModalFormData = useKanbanStore(
      (state) => state.updateModalFormData
    );
    const closeCreateTaskModal = useKanbanStore(
      (state) => state.closeCreateTaskModal
    );

    const [title, setTitle] = useState(formData.title);
    const [description, setDescription] = useState(formData.description);
    const [priority, setPriority] = useState<Task["priority"]>(
      formData.priority
    );
    const [progress, setProgress] = useState(formData.progress);
    const [dueDate, setDueDate] = useState<Date | undefined>(
      formData.dueDate ? new Date(formData.dueDate) : undefined
    );
    const [tagsInput, setTagsInput] = useState(formData.tags);
    const [titleError, setTitleError] = useState(false);
    const [isShaking, setIsShaking] = useState(false);

    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const syncToStore = useCallback(() => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        updateModalFormData(modalId, {
          title,
          description,
          priority,
          progress,
          dueDate: dueDate?.toISOString() ?? "",
          tags: tagsInput,
        });
      }, 150);
    }, [
      modalId,
      title,
      description,
      priority,
      progress,
      dueDate,
      tagsInput,
      updateModalFormData,
    ]);

    useEffect(() => {
      syncToStore();
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }, [syncToStore]);

    useEffect(() => {
      setTitle(formData.title);
      setDescription(formData.description);
      setPriority(formData.priority);
      setProgress(formData.progress);
      setDueDate(formData.dueDate ? new Date(formData.dueDate) : undefined);
      setTagsInput(formData.tags);
    }, [formData]);

    const handleSubmit = (e: React.FormEvent) => {
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

      addTask(selectedColumnId, boardId, title, {
        description,
        priority,
        progress,
        due_date: dueDate?.toISOString(),
        tags: tags && tags.length > 0 ? tags : undefined,
      });

      closeCreateTaskModal(modalId);
    };

    const handleTitleChange = (value: string) => {
      setTitle(value);
      if (value.trim()) {
        setTitleError(false);
      }
    };

    return (
      <form className="flex h-full flex-col" onSubmit={handleSubmit}>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-2">
            <Label htmlFor={`task-column-${modalId}`}>Add to Column</Label>
            <ScaledSelect
              onValueChange={onColumnChange}
              value={selectedColumnId}
            >
              <ScaledSelectTrigger
                className="w-full"
                id={`task-column-${modalId}`}
              >
                <ScaledSelectValue placeholder="Select column" />
              </ScaledSelectTrigger>
              <ScaledSelectContent position="popper" sideOffset={4}>
                {selectedBoardColumns.map((col) => (
                  <ScaledSelectItem key={col.id} value={col.id}>
                    {col.name}
                  </ScaledSelectItem>
                ))}
              </ScaledSelectContent>
            </ScaledSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`task-title-${modalId}`}>
              Task Title <span className="text-destructive">*</span>
            </Label>
            <Input
              autoFocus
              className={cn(
                "rounded-lg border-2 border-border/50 bg-background/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-input/50 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]",
                titleError && "border-destructive ring-2 ring-destructive/20",
                isShaking && "animate-shake"
              )}
              id={`task-title-${modalId}`}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="What needs to be done?"
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
                  className="w-full"
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
              <ScaledPopover>
                <ScaledPopoverTrigger asChild>
                  <Button
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                    variant="outline"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                  </Button>
                </ScaledPopoverTrigger>
                <ScaledPopoverContent
                  align="start"
                  className="w-auto p-0"
                  onInteractOutside={(e) => e.preventDefault()}
                  onPointerDownOutside={(e) => e.preventDefault()}
                  sideOffset={4}
                >
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: Calendar wrapper needs click handler */}
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: Calendar wrapper needs event handlers */}
                  {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Calendar wrapper needs event handlers */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Calendar
                      mode="single"
                      onSelect={(date) => {
                        setDueDate(date);
                      }}
                      selected={dueDate}
                    />
                    {dueDate && (
                      <div className="border-t p-2">
                        <Button
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDueDate(undefined);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Clear date
                        </Button>
                      </div>
                    )}
                  </div>
                </ScaledPopoverContent>
              </ScaledPopover>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Progress</Label>
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
            <div className="px-1">
              <Slider
                className="**:data-[slot=slider-thumb]:h-5 **:data-[slot=slider-thumb]:w-5 **:data-[slot=slider-thumb]:border-2"
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
              className="rounded-lg border-2 border-border/50 bg-background/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-input/50 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
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
              Description
              <span className="ml-1 font-normal text-muted-foreground text-xs">
                (Optional)
              </span>
            </Label>
            <Textarea
              className="min-h-20 resize-none rounded-lg border-2 border-border/50 bg-background/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-input/50 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
              id={`task-description-${modalId}`}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details about this task..."
              value={description}
            />
          </div>
        </div>

        <div className="flex gap-2 border-t bg-muted/30 p-4">
          <Button
            className="flex-1 rounded-lg border-2 border-border/50 bg-secondary/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] transition-all hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive dark:bg-secondary/50 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.08)] dark:hover:bg-destructive/20"
            onClick={() => closeCreateTaskModal(modalId)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-lg bg-primary font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.2)] hover:bg-primary/90 dark:shadow-[0_2px_8px_rgba(0,0,0,0.6),inset_0_2px_3px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
            type="submit"
          >
            Create Task
          </Button>
        </div>
      </form>
    );
  }
);

CreateTaskForm.displayName = "CreateTaskForm";
