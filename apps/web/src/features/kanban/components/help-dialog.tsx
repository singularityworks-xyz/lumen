"use client";

import { HelpCircle, X } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";

export const HelpDialog = memo(() => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        className="gap-2 rounded-full text-foreground hover:bg-secondary/60"
        onClick={() => setIsOpen(true)}
        size="sm"
        title="Help"
        variant="ghost"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          <button
            aria-label="Close help dialog"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
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
                  onClick={() => setIsOpen(false)}
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

HelpDialog.displayName = "HelpDialog";
