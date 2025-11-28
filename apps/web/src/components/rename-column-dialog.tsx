"use client";

import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

type RenameColumnDialogProps = {
  currentName: string;
  onRename: (newName: string) => void;
  onClose: () => void;
};

export const RenameColumnDialog = memo(
  ({ currentName, onRename, onClose }: RenameColumnDialogProps) => {
    const [name, setName] = useState(currentName);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (name.trim()) {
        onRename(name.trim());
        onClose();
      }
    };

    return (
      <Dialog onOpenChange={onClose} open>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Column</DialogTitle>
            <DialogDescription>
              Enter a new name for this column.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Column Name</Label>
                <Input
                  autoFocus
                  id="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Column name"
                  value={name}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={onClose} type="button" variant="outline">
                Cancel
              </Button>
              <Button type="submit">Rename</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);

RenameColumnDialog.displayName = "RenameColumnDialog";
