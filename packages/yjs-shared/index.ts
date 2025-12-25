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
  CANVAS: "canvas",
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

export const CanvasStateSchema = z.object({
  viewport: ViewportStateSchema,
  focusedBoardId: z.string().nullable(),
  lastInteractionTime: z.number(),
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
