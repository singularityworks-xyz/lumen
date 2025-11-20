"use client";

import { HelpCircle, MapIcon, X } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "../store/kanban-store";

export const RightControls = memo(() => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const showMiniMap = useKanbanStore((state) => state.showMiniMap);
  const setShowMiniMap = useKanbanStore((state) => state.setShowMiniMap);

  return (
    <>
      <div className="fixed right-4 bottom-4 z-40 flex items-center gap-1 rounded-full border border-border/50 bg-card/95 px-1.5 py-1.5 shadow-xl backdrop-blur-md dark:border-white/20">
        <Button
          className={`h-7 w-7 rounded-full p-0 transition-colors ${
            showMiniMap
              ? "bg-primary/90 text-primary-foreground hover:bg-primary"
              : "text-foreground hover:bg-secondary/70"
          }`}
          onClick={() => setShowMiniMap(!showMiniMap)}
          size="sm"
          title={showMiniMap ? "Hide Map" : "Show Map"}
          variant="ghost"
        >
          <MapIcon className="h-3.5 w-3.5" />
        </Button>

        <Button
          className="h-7 w-7 rounded-full p-0 text-foreground hover:bg-secondary/70"
          onClick={() => setIsHelpOpen(true)}
          size="sm"
          title="Help"
          variant="ghost"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isHelpOpen && (
        <>
          <button
            aria-label="Close help dialog"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsHelpOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsHelpOpen(false);
              }
            }}
            type="button"
          />

          <div className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 w-full max-w-lg">
            <div className="overflow-hidden rounded border border-border bg-card shadow-2xl">
              <div className="flex items-center justify-between border-border border-b p-6">
                <h2 className="font-bold text-xl">Keyboard Shortcuts</h2>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setIsHelpOpen(false)}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6">
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">General</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Open command palette
                      </span>
                      <kbd className="rounded bg-secondary/50 px-2 py-1 text-xs">
                        ⌘ K
                      </kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Close modal/dialog
                      </span>
                      <kbd className="rounded bg-secondary/50 px-2 py-1 text-xs">
                        Esc
                      </kbd>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Canvas</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pan canvas</span>
                      <kbd className="rounded bg-secondary/50 px-2 py-1 text-xs">
                        Right Click + Drag
                      </kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Zoom</span>
                      <kbd className="rounded bg-secondary/50 px-2 py-1 text-xs">
                        ⌘ + Scroll
                      </kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Drag board</span>
                      <kbd className="rounded bg-secondary/50 px-2 py-1 text-xs">
                        Click Header + Drag
                      </kbd>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Tasks</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Drag task between columns
                      </span>
                      <kbd className="rounded bg-secondary/50 px-2 py-1 text-xs">
                        Drag & Drop
                      </kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bulk select</span>
                      <kbd className="rounded bg-secondary/50 px-2 py-1 text-xs">
                        Check multiple
                      </kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
});

RightControls.displayName = "RightControls";
