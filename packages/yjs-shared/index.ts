import { z } from "zod";

export const YJS_MAP_NAMES = {
  WORKSPACE: "workspace",
  BOARDS: "boards",
  COLUMNS: "columns",
  TASKS: "tasks",
  BOARD_POSITIONS: "boardPositions",
  BOARD_CONNECTIONS: "boardConnections",
  AREAS: "areas",
  AREA_POSITIONS: "areaPositions",
  AREA_DIALOGS: "areaDialogs",
  CANVAS: "canvas",
  BOARD_QUICK_ACTIONS: "boardQuickActions",
  BOARD_DIALOGS: "boardDialogs",
  CONNECTION_DIALOGS: "connectionDialogs",
  CREATE_TASK_MODALS: "createTaskModals",
  COLUMN_QUICK_ACTIONS: "columnQuickActions",
  COLUMN_DIALOGS: "columnDialogs",
  TASK_QUICK_ACTIONS: "taskQuickActions",
  TASK_DETAIL_MODALS: "taskDetailModals",
  COMMENTS: "comments",
} as const;

export type YjsMapName = (typeof YJS_MAP_NAMES)[keyof typeof YJS_MAP_NAMES];
export const PrioritySchema = z.enum(["low", "medium", "high"]);
export const TaskStatusSchema = z.enum(["todo", "done", "trash"]);
export const LineStyleSchema = z.enum(["solid", "dotted"]);
export const HandlePositionSchema = z.enum(["top", "right", "bottom", "left"]);
export const InteractionModeSchema = z.enum(["drag", "select"]);

export const ChecklistSchema = z.object({
  id: z.string(),
  task_id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  position: z.number(),
});

export const TaskSchema = z.object({
  id: z.string(),
  board_id: z.string(),
  column_id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: PrioritySchema,
  progress: z.number().min(0).max(100),
  position: z.number(),
  due_date: z.string().optional(),
  created_by: z.string(),
  assigned_to: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  tags: z.array(z.string()).optional(),
  checklists: z.array(ChecklistSchema).optional(),
  status: TaskStatusSchema,
});

export const ColumnSchema = z.object({
  id: z.string(),
  board_id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  position: z.number(),
  task_ids: z.array(z.string()),
  progressValue: z.number().optional(),
  accentColor: z.string().optional(),
  icon: z.string().optional(),
});

export const BoardSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  workspace_id: z.string(),
  created_by: z.string(),
  created_at: z.string(),
  column_ids: z.array(z.string()),
  accentColor: z.string().optional(),
  icon: z.string().optional(),
});

export const BoardPositionSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  zIndex: z.number(),
  userResized: z.boolean().optional(),
  lastUserWidth: z.number().optional(),
  lastUserHeight: z.number().optional(),
});

export const BoardConnectionSchema = z.object({
  id: z.string(),
  source_board_id: z.string(),
  target_board_id: z.string(),
  label: z.string().optional(),
  lineStyle: LineStyleSchema,
  sourceHandle: HandlePositionSchema,
  targetHandle: HandlePositionSchema,
  showArrow: z.boolean(),
  created_at: z.string(),
});

export const ViewportStateSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().min(0.1).max(4),
});

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  created_at: z.string(),
  board_ids: z.array(z.string()),
  lastFocusedBoardId: z.string().nullable().optional(),
  lastViewport: ViewportStateSchema.nullable().optional(),
  showMiniMap: z.boolean().optional(),
  customColors: z.array(z.string()).optional(),
  colorUsage: z.record(z.string(), z.number()).optional(),
  iconUsage: z.record(z.string(), z.number()).optional(),
});

export const AreaSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  workspace_id: z.string(),
  color: z.string(),
  icon: z.string().optional(),
  board_ids: z.array(z.string()),
  created_at: z.string(),
});

export const AreaPositionSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  zIndex: z.number(),
});

export const AreaDialogSchema = z.object({
  id: z.string(),
  areaId: z.string(),
  areaName: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  inputValue: z.string().optional(),
});

export const CanvasStateSchema = z.object({
  viewport: ViewportStateSchema,
  focusedBoardId: z.string().nullable(),
  lastInteractionTime: z.number(),
});

export const BoardQuickActionsSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

export const ColumnQuickActionsSchema = z.object({
  id: z.string(),
  columnId: z.string(),
  boardId: z.string(),
  showAddTask: z.boolean(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

export const ColumnDialogTypeSchema = z.enum(["rename", "delete", "move"]);

export const ColumnDialogSchema = z.object({
  id: z.string(),
  type: ColumnDialogTypeSchema,
  columnId: z.string(),
  columnName: z.string(),
  columnDescription: z.string().optional(),
  boardId: z.string(),
  boardName: z.string(),
  inputValue: z.string().optional(),
  descriptionValue: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

export const BoardDialogTypeSchema = z.enum([
  "rename",
  "duplicate",
  "delete",
  "properties",
  "color-icon-picker",
]);

export const BoardDialogSchema = z.object({
  id: z.string(),
  type: BoardDialogTypeSchema,
  boardId: z.string(),
  boardName: z.string(),
  boardDescription: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  zIndex: z.number(),
  inputValue: z.string().optional(),
  descriptionValue: z.string().optional(),
  newName: z.string().optional(),
  copyConnections: z.boolean().optional(),
  columnCount: z.number().optional(),
  taskCount: z.number().optional(),
  connectionCount: z.number().optional(),
  columnProgressValues: z.record(z.string(), z.number()).optional(),
  columnId: z.string().optional(),
  targetType: z.enum(["board", "column"]).optional(),
  sourceDialogId: z.string().optional(),
  expandedColumnId: z.string().nullable().optional(),
  activeTab: z.enum(["progress", "style"]).optional(),
});

// Connection dialog schema - syncs across collaborators
export const ConnectionDialogSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  // Connection config state
  selectedTargetId: z.string().nullable().optional(),
  editingConnectionId: z.string().nullable().optional(),
  sourceHandle: HandlePositionSchema.optional(),
  targetHandle: HandlePositionSchema.optional(),
  lineStyle: LineStyleSchema.optional(),
  showArrow: z.boolean().optional(),
  label: z.string().optional(),
  searchQuery: z.string().optional(),
});

// Create task modal form data schema
export const CreateTaskModalFormDataSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: PrioritySchema,
  progress: z.number(),
  dueDate: z.string(),
  tags: z.string(),
});

// Create task modal schema - syncs across collaborators
export const CreateTaskModalSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  columnId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  sourcePosition: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  sourceRect: z
    .object({
      top: z.number(),
      right: z.number(),
      bottom: z.number(),
      left: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  sourceType: z
    .enum(["board-menu", "board-header", "column-menu", "column-header"])
    .optional(),
  formData: CreateTaskModalFormDataSchema,
  zIndex: z.number(),
});

// Task quick actions schema - syncs across collaborators
export const TaskQuickActionsSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  boardId: z.string(),
  columnId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

// Task detail modal schema - syncs across collaborators
export const TaskDetailModalSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  boardId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  zIndex: z.number(),
  sourceTaskId: z.string(),
  initialIsEditing: z.boolean().optional(),
  isEditing: z.boolean().optional(),
  openedFromQuickActions: z.boolean().optional(),
  // Draft state for real-time collaboration
  draftTitle: z.string().optional(),
  draftDescription: z.string().optional(),
  draftPriority: PrioritySchema.optional(),
  draftProgress: z.number().optional(),
  draftDueDate: z.string().optional(),
  draftTags: z.string().optional(),
  draftColumnId: z.string().optional(),
  draftChecklists: z.array(ChecklistSchema).optional(),
  draftLastUpdatedBy: z.string().optional(),
  draftLastUpdatedAt: z.number().optional(),
});

export const CommentSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  content: z.string(),
  authorId: z.string(),
  workspaceId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Task = z.infer<typeof TaskSchema>;
export type Column = z.infer<typeof ColumnSchema>;
export type Board = z.infer<typeof BoardSchema>;
export type BoardPosition = z.infer<typeof BoardPositionSchema>;
export type BoardConnection = z.infer<typeof BoardConnectionSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Area = z.infer<typeof AreaSchema>;
export type AreaPosition = z.infer<typeof AreaPositionSchema>;
export type ViewportState = z.infer<typeof ViewportStateSchema>;
export type Checklist = z.infer<typeof ChecklistSchema>;
export type CanvasState = z.infer<typeof CanvasStateSchema>;
export type BoardQuickActionsState = z.infer<typeof BoardQuickActionsSchema>;
export type BoardDialogState = z.infer<typeof BoardDialogSchema>;
export type ConnectionDialogState = z.infer<typeof ConnectionDialogSchema>;
export type CreateTaskModalState = z.infer<typeof CreateTaskModalSchema>;
export type CreateTaskModalFormData = z.infer<
  typeof CreateTaskModalFormDataSchema
>;
export type TaskQuickActionsState = z.infer<typeof TaskQuickActionsSchema>;
export type TaskDetailModalState = z.infer<typeof TaskDetailModalSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type AreaDialogState = z.infer<typeof AreaDialogSchema>;

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

export function validateEntity<T>(
  schema: z.ZodType<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function parseWithDefault<T>(
  schema: z.ZodType<T>,
  data: unknown,
  defaultValue: T
): T {
  const result = schema.safeParse(data);
  return result.success ? result.data : defaultValue;
}

export function createEntityMapSchema<T extends z.ZodTypeAny>(schema: T) {
  return z.object({
    byId: z.record(z.string(), schema),
    allIds: z.array(z.string()),
  });
}

export function getMapStats(
  maps: Record<string, { size: number }>
): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const [name, map] of Object.entries(maps)) {
    stats[name] = map.size;
  }
  return stats;
}
