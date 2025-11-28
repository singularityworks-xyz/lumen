"use client";

import { Tag, Trash2, X } from "lucide-react";
import { memo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "../store/kanban-store";

export const BulkActionsBar = memo(() => {
  const selectedTaskIds = useKanbanStore((state) => state.selectedTaskIds);
  const clearTaskSelection = useKanbanStore(
    (state) => state.clearTaskSelection
  );
  const bulkUpdateTasks = useKanbanStore((state) => state.bulkUpdateTasks);
  const bulkDeleteTasks = useKanbanStore((state) => state.bulkDeleteTasks);

  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showProgressMenu, setShowProgressMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const selectedCount = selectedTaskIds.length;

  if (selectedCount === 0) {
    return null;
  }

  const handleBulkDelete = () => {
    bulkDeleteTasks(selectedTaskIds);
    setShowDeleteDialog(false);
  };

  const handlePriorityChange = (priority: "low" | "medium" | "high") => {
    bulkUpdateTasks(selectedTaskIds, { priority });
    setShowPriorityMenu(false);
  };

  const handleProgressChange = (progress: number) => {
    bulkUpdateTasks(selectedTaskIds, { progress });
    setShowProgressMenu(false);
  };

  return (
    <div className="fixed right-0 bottom-0 left-0 z-40 md:right-4 md:bottom-4 md:left-4">
      <div className="rounded-t border border-border/50 bg-card/95 px-3 py-2.5 shadow-xl backdrop-blur-md md:rounded-full dark:border-white/20">
        <div className="flex flex-col items-center justify-between gap-2 md:flex-row md:gap-3">
          <div className="flex items-center gap-1.5">
            <Badge
              className="rounded-full px-2 py-0.5 text-[10px]"
              variant="secondary"
            >
              {selectedCount} selected
            </Badge>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Bulk manage tasks
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center justify-end gap-1.5 md:w-auto">
            <div className="relative">
              <Button
                className="gap-1.5 rounded-full"
                onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                size="sm"
                variant="outline"
              >
                <Tag className="h-3.5 w-3.5" />
                <span className="hidden text-[11px] sm:inline">Priority</span>
              </Button>

              {showPriorityMenu && (
                <>
                  <button
                    aria-label="Close priority menu"
                    className="fixed inset-0 z-40"
                    onClick={() => setShowPriorityMenu(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setShowPriorityMenu(false);
                      }
                    }}
                    type="button"
                  />
                  <div className="absolute right-0 bottom-full z-50 mb-2 overflow-hidden rounded-lg border border-border/50 bg-card/95 shadow-xl backdrop-blur-md dark:border-white/20">
                    {(["low", "medium", "high"] as const).map((priority) => (
                      <button
                        className="w-full px-3 py-1.5 text-left text-xs capitalize transition-colors hover:bg-secondary/70"
                        key={priority}
                        onClick={() => handlePriorityChange(priority)}
                        type="button"
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <Button
                className="gap-1.5 rounded-full"
                onClick={() => setShowProgressMenu(!showProgressMenu)}
                size="sm"
                variant="outline"
              >
                <span className="text-[11px]">Progress</span>
              </Button>

              {showProgressMenu && (
                <>
                  <button
                    aria-label="Close progress menu"
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProgressMenu(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setShowProgressMenu(false);
                      }
                    }}
                    type="button"
                  />
                  <div className="absolute right-0 bottom-full z-50 mb-2 min-w-40 overflow-hidden rounded-lg border border-border/50 bg-card/95 p-1.5 shadow-xl backdrop-blur-md dark:border-white/20">
                    <div className="flex flex-wrap gap-1">
                      {[0, 25, 50, 75, 100].map((progress) => (
                        <button
                          className="rounded-full bg-secondary/40 px-1.5 py-0.5 text-[10px] transition-colors hover:bg-primary/40"
                          key={progress}
                          onClick={() => handleProgressChange(progress)}
                          type="button"
                        >
                          {progress}%
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <Button
              className="gap-1.5 rounded-full"
              onClick={() => setShowDeleteDialog(true)}
              size="sm"
              variant="destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden text-[11px] sm:inline">Delete</span>
            </Button>

            <AlertDialog
              onOpenChange={setShowDeleteDialog}
              open={showDeleteDialog}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Tasks</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedCount} task
                    {selectedCount !== 1 ? "s" : ""}? This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              className="rounded-full"
              onClick={clearTaskSelection}
              size="sm"
              variant="ghost"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

BulkActionsBar.displayName = "BulkActionsBar";
