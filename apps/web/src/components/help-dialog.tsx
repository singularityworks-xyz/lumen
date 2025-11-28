"use client";

import { Command, Hand, MousePointer2 } from "lucide-react";
import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";

type HelpDialogProps = {
  open: boolean;
  onClose: () => void;
};

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border-2 border-border/50 bg-muted px-1.5 font-medium font-mono text-[10px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]">
    {children}
  </kbd>
);

export const HelpDialog = memo(({ open, onClose }: HelpDialogProps) => (
  <Dialog onOpenChange={onClose} open={open}>
    <DialogContent className="max-w-3xl gap-0 border-2 border-border/50 p-0 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
      <DialogHeader className="space-y-0 border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-6 py-4 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
        <DialogTitle className="font-semibold text-lg">
          Keyboard Shortcuts
        </DialogTitle>
        <p className="mt-0.5 text-muted-foreground text-xs">
          Quick reference guide
        </p>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-6 p-6">
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 flex items-center gap-2 font-medium text-sm">
              <Command className="h-3.5 w-3.5 text-primary" />
              General
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Command palette</span>
                <div className="flex gap-0.5">
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Toggle mode</span>
                <Kbd>V</Kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Close dialog</span>
                <Kbd>Esc</Kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Help</span>
                <Kbd>?</Kbd>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-medium text-sm">Canvas</h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Pan canvas</span>
                <div className="flex items-center gap-0.5">
                  <Kbd>Space</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>Click</Kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Zoom</span>
                <div className="flex items-center gap-0.5">
                  <Kbd>Space</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>Scroll</Kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Fit view</span>
                <div className="flex gap-0.5">
                  <Kbd>⌘</Kbd>
                  <Kbd>0</Kbd>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-medium text-sm">Columns</h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Reorder columns</span>
                <Kbd>Drag</Kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Context menu</span>
                <Kbd>Right Click</Kbd>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="mb-2 flex items-center gap-2 font-medium text-sm">
              <Hand className="h-3.5 w-3.5 text-primary" />
              Drag Mode
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Move board</span>
                <div className="flex items-center gap-0.5">
                  <Kbd>Click</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>Drag</Kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Pan canvas</span>
                <div className="flex items-center gap-0.5">
                  <Kbd>Right</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>Drag</Kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Bring to front</span>
                <Kbd>Click</Kbd>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-2 font-medium text-sm">
              <MousePointer2 className="h-3.5 w-3.5 text-primary" />
              Select Mode
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Select board</span>
                <Kbd>Click</Kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Multi-select</span>
                <div className="flex items-center gap-0.5">
                  <Kbd>⌘</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>Click</Kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Box selection</span>
                <Kbd>Drag</Kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Clear selection</span>
                <Kbd>Esc</Kbd>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t bg-muted/30 px-6 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Tip:</strong> Press <Kbd>V</Kbd>{" "}
          to quickly toggle between modes. Boards clicked are brought to front
          automatically.
        </p>
      </div>
    </DialogContent>
  </Dialog>
));

HelpDialog.displayName = "HelpDialog";
