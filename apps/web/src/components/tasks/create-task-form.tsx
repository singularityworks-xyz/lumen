"use client";

import { format } from "date-fns";
import { CalendarIcon, Info, Loader, Tag } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Calendar } from "@/src/components/ui/calendar";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Slider } from "@/src/components/ui/slider";
import { TagInput } from "@/src/components/ui/tag-input";
import { Textarea } from "@/src/components/ui/textarea";
import {
  type Column,
  type CreateTaskModalState,
  type Task,
  useKanbanStore,
} from "@/src/features/kanban";
import { useTagSuggestions } from "@/src/features/kanban/hooks/use-tag-suggestions";
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

type CreateTaskFormProps = {
  modalId: string;
  modalState: CreateTaskModalState;
  selectedColumnId: string;
  onColumnChange?: (columnId: string) => void;
  selectedBoardColumns?: Column[];
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
  ({ modalId, modalState, selectedColumnId }: CreateTaskFormProps) => {
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
    const [tags, setTags] = useState<string[]>(() => {
      if (!formData.tags) {
        return [];
      }
      try {
        const parsed = JSON.parse(formData.tags);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return formData.tags.split(",").filter((t) => t.trim().length > 0);
      }
    });

    const suggestions = useTagSuggestions(boardId, selectedColumnId, tags);
    const [titleError, setTitleError] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);

    const formValuesRef = useRef({
      title,
      description,
      priority,
      progress,
      dueDate,
      tags,
    });

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    formValuesRef.current = {
      title,
      description,
      priority,
      progress,
      dueDate,
      tags,
    };

    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, []);

    useEffect(
      () => () => {
        const values = formValuesRef.current;
        updateModalFormData(modalId, {
          title: values.title,
          description: values.description,
          priority: values.priority,
          progress: values.progress,
          dueDate: values.dueDate?.toISOString() ?? "",
          tags: JSON.stringify(values.tags),
        });
      },
      [modalId, updateModalFormData]
    );

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      if (!title.trim()) {
        setTitleError(true);
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 300);
        return;
      }

      addTask(selectedColumnId, boardId, title, {
        description,
        priority,
        progress,
        due_date: dueDate?.toISOString(),
        tags: tags.length > 0 ? tags : undefined,
      });

      closeCreateTaskModal(modalId);
    };

    const handleTitleChange = (value: string) => {
      setTitle(value);
      if (value.trim()) {
        setTitleError(false);
      }
      updateModalFormData(modalId, { title: value });
    };

    const handleDescriptionChange = (
      e: React.ChangeEvent<HTMLTextAreaElement>
    ) => {
      const value = e.target.value;
      setDescription(value);
      updateModalFormData(modalId, { description: value });

      e.target.style.height = "auto";
      e.target.style.height = `${e.target.scrollHeight}px`;
    };

    const handlePriorityChange = (value: Task["priority"]) => {
      setPriority(value);
      updateModalFormData(modalId, { priority: value });
    };

    const handleProgressChange = (value: number[]) => {
      const val = value[0] ?? 0;
      setProgress(val);
      updateModalFormData(modalId, { progress: val });
    };

    const handleDueDateChange = (date: Date | undefined) => {
      setDueDate(date);
      updateModalFormData(modalId, { dueDate: date?.toISOString() ?? "" });
    };

    const handleTagsChange = (newTags: string[]) => {
      setTags(newTags);
      updateModalFormData(modalId, { tags: JSON.stringify(newTags) });
    };

    return (
      <form className="flex h-full flex-col" onSubmit={handleSubmit}>
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
                onValueChange={(v) =>
                  handlePriorityChange(v as Task["priority"])
                }
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
                      handleDueDateChange(date);
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
                onValueChange={handleProgressChange}
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
            </Label>
            <TagInput
              onTagsChange={handleTagsChange}
              placeholder="Search or create tags..."
              suggestions={suggestions}
              tags={tags}
            />
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
              onChange={handleDescriptionChange}
              placeholder="Add more details about this task..."
              ref={textareaRef}
              value={description}
            />
          </div>
        </div>

        <div className="flex gap-2 border-t bg-muted/95 px-3 py-2 dark:bg-secondary/95">
          <Button
            className="h-7 flex-1 rounded-md bg-card/80 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
            onClick={() => closeCreateTaskModal(modalId)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            className="h-7 flex-1 rounded-md bg-primary/90 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
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
