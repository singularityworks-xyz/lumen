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
  const selectedTasks = useKanbanStore((state) => state.selectedTasks);
  const clearTaskSelection = useKanbanStore(
    (state) => state.clearTaskSelection
  );
  const bulkUpdateTasks = useKanbanStore((state) => state.bulkUpdateTasks);
  const bulkDeleteTasks = useKanbanStore((state) => state.bulkDeleteTasks);

  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showProgressMenu, setShowProgressMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const selectedCount = selectedTasks.size;

  if (selectedCount === 0) {
    return null;
  }

  const handleBulkDelete = () => {
    bulkDeleteTasks(Array.from(selectedTasks));
    setShowDeleteDialog(false);
  };

  const handlePriorityChange = (priority: "low" | "medium" | "high") => {
    bulkUpdateTasks(Array.from(selectedTasks), { priority });
    setShowPriorityMenu(false);
  };

  const handleProgressChange = (progress: number) => {
    bulkUpdateTasks(Array.from(selectedTasks), { progress });
    setShowProgressMenu(false);
  };

  return (
    <div className="fixed right-0 bottom-0 left-0 z-40 md:right-4 md:bottom-4 md:left-4">
      <div className="rounded-t border border-border bg-card p-4 shadow-lg backdrop-blur-sm md:rounded">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <Badge className="rounded-full" variant="secondary">
              {selectedCount} selected
            </Badge>
            <p className="hidden text-muted-foreground text-xs sm:block">
              Select multiple tasks to bulk manage them
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
            <div className="relative">
              <Button
                className="gap-2 rounded-full"
                onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                size="sm"
                variant="outline"
              >
                <Tag className="h-4 w-4" />
                <span className="hidden text-xs sm:inline">Priority</span>
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
                  <div className="absolute right-0 bottom-full z-50 mb-2 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                    {(["low", "medium", "high"] as const).map((priority) => (
                      <button
                        className="w-full px-4 py-2 text-left text-sm capitalize transition-colors hover:bg-secondary/40"
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
                className="gap-2 rounded-full"
                onClick={() => setShowProgressMenu(!showProgressMenu)}
                size="sm"
                variant="outline"
              >
                <span className="text-xs">Progress</span>
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
                  <div className="absolute right-0 bottom-full z-50 mb-2 min-w-40 overflow-hidden rounded-lg border border-border bg-card p-2 shadow-lg">
                    <div className="flex flex-wrap gap-1">
                      {[0, 25, 50, 75, 100].map((progress) => (
                        <button
                          className="rounded-full bg-secondary/40 px-2 py-1 text-xs transition-colors hover:bg-primary/40"
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
              className="gap-2 rounded-full"
              onClick={() => setShowDeleteDialog(true)}
              size="sm"
              variant="destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden text-xs sm:inline">Delete</span>
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
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

BulkActionsBar.displayName = "BulkActionsBar";
