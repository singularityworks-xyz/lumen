import { z } from "zod";

export const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export type Priority = z.infer<typeof prioritySchema>;

export const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "done",
  "blocked",
  "cancelled",
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const getWorkspaceOverviewSchema = z.object({
  includeStats: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include board/task counts and statistics"),
});

export const getBoardDetailsSchema = z.object({
  boardId: z.string().describe("The ID of the board to get details for"),
});

export const getTaskDetailsSchema = z.object({
  taskId: z.string().describe("The ID of the task to get details for"),
});

export const searchTasksSchema = z.object({
  query: z
    .string()
    .describe("Search query to match against task titles and descriptions"),
  status: taskStatusSchema.optional().describe("Filter by task status"),
  priority: prioritySchema.optional().describe("Filter by priority level"),
  boardId: z.string().optional().describe("Filter to a specific board"),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Max results to return"),
});

export const getRecentActivitySchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Number of recent activities"),
  since: z
    .string()
    .datetime()
    .optional()
    .describe("Only get activities after this ISO timestamp"),
});

export const createTaskSchema = z.object({
  boardId: z.string().describe("The board to create the task in"),
  title: z.string().min(1).max(500).describe("The task title"),
  columnId: z
    .string()
    .optional()
    .describe("Specific column to add to (defaults to first column)"),
  description: z
    .string()
    .max(5000)
    .optional()
    .describe("Task description (markdown supported)"),
  priority: prioritySchema.optional().describe("Task priority level"),
  dueDate: z.string().datetime().optional().describe("Due date in ISO format"),
});

export const updateTaskSchema = z.object({
  taskId: z.string().describe("The ID of the task to update"),
  updates: z
    .object({
      title: z.string().min(1).max(500).optional().describe("New title"),
      description: z.string().max(5000).optional().describe("New description"),
      priority: prioritySchema.optional().describe("New priority"),
      dueDate: z
        .string()
        .datetime()
        .nullable()
        .optional()
        .describe("New due date or null to clear"),
      status: taskStatusSchema.optional().describe("New status"),
    })
    .describe("Fields to update"),
});

export const deleteTaskSchema = z.object({
  taskId: z.string().describe("The ID of the task to delete"),
});

export const moveTaskSchema = z.object({
  taskId: z.string().describe("The ID of the task to move"),
  columnId: z.string().optional().describe("Target column ID"),
  boardId: z
    .string()
    .optional()
    .describe("Target board ID (for cross-board moves)"),
  position: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Position in target column"),
});

export const createBoardSchema = z.object({
  name: z.string().min(1).max(200).describe("Board name"),
  description: z.string().max(1000).optional().describe("Board description"),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional()
    .describe("Position on canvas"),
});

export const updateBoardSchema = z.object({
  boardId: z.string().describe("The ID of the board to update"),
  updates: z
    .object({
      name: z.string().min(1).max(200).optional().describe("New name"),
      description: z.string().max(1000).optional().describe("New description"),
    })
    .describe("Fields to update"),
});

export const deleteBoardSchema = z.object({
  boardId: z.string().describe("The ID of the board to delete"),
});

export const createColumnSchema = z.object({
  boardId: z.string().describe("The board to add the column to"),
  name: z.string().min(1).max(100).describe("Column name"),
  position: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Position in board (defaults to end)"),
});

export const bulkUpdateTasksSchema = z.object({
  taskIds: z
    .array(z.string())
    .min(1)
    .max(100)
    .describe("IDs of tasks to update"),
  updates: z
    .object({
      priority: prioritySchema.optional(),
      status: taskStatusSchema.optional(),
      dueDate: z.string().datetime().nullable().optional(),
      columnId: z.string().optional().describe("Move all to this column"),
    })
    .describe("Updates to apply to all tasks"),
});

export const bulkDeleteTasksSchema = z.object({
  taskIds: z
    .array(z.string())
    .min(1)
    .max(100)
    .describe("IDs of tasks to delete"),
});

export type GetWorkspaceOverviewParams = z.infer<
  typeof getWorkspaceOverviewSchema
>;
export type GetBoardDetailsParams = z.infer<typeof getBoardDetailsSchema>;
export type GetTaskDetailsParams = z.infer<typeof getTaskDetailsSchema>;
export type SearchTasksParams = z.infer<typeof searchTasksSchema>;
export type GetRecentActivityParams = z.infer<typeof getRecentActivitySchema>;
export type CreateTaskParams = z.infer<typeof createTaskSchema>;
export type UpdateTaskParams = z.infer<typeof updateTaskSchema>;
export type DeleteTaskParams = z.infer<typeof deleteTaskSchema>;
export type MoveTaskParams = z.infer<typeof moveTaskSchema>;
export type CreateBoardParams = z.infer<typeof createBoardSchema>;
export type UpdateBoardParams = z.infer<typeof updateBoardSchema>;
export type DeleteBoardParams = z.infer<typeof deleteBoardSchema>;
export type CreateColumnParams = z.infer<typeof createColumnSchema>;
export type BulkUpdateTasksParams = z.infer<typeof bulkUpdateTasksSchema>;
export type BulkDeleteTasksParams = z.infer<typeof bulkDeleteTasksSchema>;
