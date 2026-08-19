import { AreaPropertiesDialogNodeComponent } from "@/src/components/dialogs/area-properties-dialog-node";
import { BoardPropertiesDialogNodeComponent } from "@/src/components/dialogs/board/board-properties-dialog-node";
import { BoardQuickActionsNodeComponent } from "@/src/components/dialogs/board/board-quick-actions-node";
import { ConnectionDialogNodeComponent } from "@/src/components/dialogs/board/connection-dialog-node";
import { DeleteBoardDialogNodeComponent } from "@/src/components/dialogs/board/delete-board-dialog-node";
import { DuplicateBoardDialogNodeComponent } from "@/src/components/dialogs/board/duplicate-board-dialog-node";
import { RenameBoardDialogNodeComponent } from "@/src/components/dialogs/board/rename-board-dialog-node";
import { ColorIconPickerDialogNodeComponent } from "@/src/components/dialogs/color-icon-picker-dialog-node";
import { ColumnQuickActionsNodeComponent } from "@/src/components/dialogs/column/column-quick-actions-node";
import { DeleteColumnDialogNodeComponent } from "@/src/components/dialogs/column/delete-column-dialog-node";
import { MoveColumnDialogNodeComponent } from "@/src/components/dialogs/column/move-column-dialog-node";
import { RenameColumnDialogNodeComponent } from "@/src/components/dialogs/column/rename-column-dialog-node";
import { ShareDialogNodeComponent } from "@/src/components/dialogs/share-dialog-node";
import { TaskDetailModalNodeComponent } from "@/src/components/tasks/task-detail-modal-node";
import { TaskModalNodeComponent } from "@/src/components/tasks/task-modal-node";
import { TaskQuickActionsNodeComponent } from "@/src/components/tasks/task-quick-actions-node";
import { AreaNodeComponent } from "@/src/features/kanban/components/area-node";
import { BoardNodeComponent } from "@/src/features/kanban/components/board-node";
import { TextBoardNodeComponent } from "@/src/features/kanban/components/text-board-node";

export const nodeTypes = {
  area: AreaNodeComponent,
  areaPropertiesDialog: AreaPropertiesDialogNodeComponent,
  board: BoardNodeComponent,
  textBoard: TextBoardNodeComponent,
  taskModal: TaskModalNodeComponent,
  taskDetailModal: TaskDetailModalNodeComponent,
  boardQuickActions: BoardQuickActionsNodeComponent,
  taskQuickActions: TaskQuickActionsNodeComponent,
  columnQuickActions: ColumnQuickActionsNodeComponent,
  boardRenameDialog: RenameBoardDialogNodeComponent,
  boardDuplicateDialog: DuplicateBoardDialogNodeComponent,
  boardDeleteDialog: DeleteBoardDialogNodeComponent,
  connectionDialog: ConnectionDialogNodeComponent,
  columnRenameDialog: RenameColumnDialogNodeComponent,
  columnDeleteDialog: DeleteColumnDialogNodeComponent,
  columnMoveDialog: MoveColumnDialogNodeComponent,
  boardPropertiesDialog: BoardPropertiesDialogNodeComponent,
  colorIconPickerDialog: ColorIconPickerDialogNodeComponent,
  shareDialog: ShareDialogNodeComponent,
};
