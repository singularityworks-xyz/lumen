"use client";

import { memo } from "react";
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

type DeleteColumnDialogProps = {
  columnName: string;
  onConfirm: () => void;
  onClose: () => void;
};

export const DeleteColumnDialog = memo(
  ({ columnName, onConfirm, onClose }: DeleteColumnDialogProps) => (
    <AlertDialog onOpenChange={onClose} open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Column</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove "{columnName}"? This action cannot
            be undone and will delete all tasks in this column.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
);

DeleteColumnDialog.displayName = "DeleteColumnDialog";
