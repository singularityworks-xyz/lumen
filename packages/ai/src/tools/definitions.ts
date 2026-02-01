import { tool } from "ai";
import {
  bulkDeleteTasksSchema,
  bulkUpdateTasksSchema,
  createBoardSchema,
  createColumnSchema,
  createTaskSchema,
  deleteBoardSchema,
  deleteTaskSchema,
  getBoardDetailsSchema,
  getRecentActivitySchema,
  getTaskDetailsSchema,
  getWorkspaceOverviewSchema,
  moveTaskSchema,
  searchTasksSchema,
  updateBoardSchema,
  updateTaskSchema,
} from "./schemas";

// Tool category and destructive level types
export type ToolCategory = "query" | "action";
export type DestructiveLevel = "none" | "low" | "high";

export interface ToolMetadata {
  name: string;
  category: ToolCategory;
  destructive: DestructiveLevel;
  requiresConfirmation: boolean;
  description: string;
}

// Tool descriptions as constants for type safety
const DESCRIPTIONS = {
  getWorkspaceOverview:
    "Get high-level overview of the workspace including boards and task counts",
  getBoardDetails:
    "Get detailed information about a specific board including columns and tasks",
  getTaskDetails: "Get detailed information about a specific task",
  searchTasks: "Search for tasks by query, status, priority, or board",
  getRecentActivity: "Get recent activity and changes in the workspace",
  getCurrentContext:
    "Get the user's current view context (selected tasks, current board, etc.)",
  createTask: "Create a new task in a board",
  updateTask: "Update an existing task's properties",
  moveTask: "Move a task to a different column or board",
  createBoard: "Create a new board in the workspace",
  updateBoard: "Update a board's name or description",
  createColumn: "Create a new column in a board",
  bulkUpdateTasks: "Update multiple tasks at once",
  deleteTask: "Delete a task permanently",
  deleteBoard: "Delete a board and all its contents permanently",
  bulkDeleteTasks: "Delete multiple tasks permanently",
} as const;

// Metadata for all tools
export const toolMetadata = {
  getWorkspaceOverview: {
    name: "getWorkspaceOverview",
    category: "query",
    destructive: "none",
    requiresConfirmation: false,
    description: DESCRIPTIONS.getWorkspaceOverview,
  },
  getBoardDetails: {
    name: "getBoardDetails",
    category: "query",
    destructive: "none",
    requiresConfirmation: false,
    description: DESCRIPTIONS.getBoardDetails,
  },
  getTaskDetails: {
    name: "getTaskDetails",
    category: "query",
    destructive: "none",
    requiresConfirmation: false,
    description: DESCRIPTIONS.getTaskDetails,
  },
  searchTasks: {
    name: "searchTasks",
    category: "query",
    destructive: "none",
    requiresConfirmation: false,
    description: DESCRIPTIONS.searchTasks,
  },
  getRecentActivity: {
    name: "getRecentActivity",
    category: "query",
    destructive: "none",
    requiresConfirmation: false,
    description: DESCRIPTIONS.getRecentActivity,
  },
  getCurrentContext: {
    name: "getCurrentContext",
    category: "query",
    destructive: "none",
    requiresConfirmation: false,
    description: DESCRIPTIONS.getCurrentContext,
  },
  createTask: {
    name: "createTask",
    category: "action",
    destructive: "none",
    requiresConfirmation: false,
    description: DESCRIPTIONS.createTask,
  },
  updateTask: {
    name: "updateTask",
    category: "action",
    destructive: "low",
    requiresConfirmation: false,
    description: DESCRIPTIONS.updateTask,
  },
  moveTask: {
    name: "moveTask",
    category: "action",
    destructive: "low",
    requiresConfirmation: false,
    description: DESCRIPTIONS.moveTask,
  },
  createBoard: {
    name: "createBoard",
    category: "action",
    destructive: "none",
    requiresConfirmation: false,
    description: DESCRIPTIONS.createBoard,
  },
  updateBoard: {
    name: "updateBoard",
    category: "action",
    destructive: "low",
    requiresConfirmation: false,
    description: DESCRIPTIONS.updateBoard,
  },
  createColumn: {
    name: "createColumn",
    category: "action",
    destructive: "none",
    requiresConfirmation: false,
    description: DESCRIPTIONS.createColumn,
  },
  bulkUpdateTasks: {
    name: "bulkUpdateTasks",
    category: "action",
    destructive: "low",
    requiresConfirmation: false,
    description: DESCRIPTIONS.bulkUpdateTasks,
  },
  deleteTask: {
    name: "deleteTask",
    category: "action",
    destructive: "high",
    requiresConfirmation: true,
    description: DESCRIPTIONS.deleteTask,
  },
  deleteBoard: {
    name: "deleteBoard",
    category: "action",
    destructive: "high",
    requiresConfirmation: true,
    description: DESCRIPTIONS.deleteBoard,
  },
  bulkDeleteTasks: {
    name: "bulkDeleteTasks",
    category: "action",
    destructive: "high",
    requiresConfirmation: true,
    description: DESCRIPTIONS.bulkDeleteTasks,
  },
} as const satisfies Record<string, ToolMetadata>;

// Query tools - read-only operations
export const getWorkspaceOverviewTool = tool({
  description: DESCRIPTIONS.getWorkspaceOverview,
  inputSchema: getWorkspaceOverviewSchema,
});

export const getBoardDetailsTool = tool({
  description: DESCRIPTIONS.getBoardDetails,
  inputSchema: getBoardDetailsSchema,
});

export const getTaskDetailsTool = tool({
  description: DESCRIPTIONS.getTaskDetails,
  inputSchema: getTaskDetailsSchema,
});

export const searchTasksTool = tool({
  description: DESCRIPTIONS.searchTasks,
  inputSchema: searchTasksSchema,
});

export const getRecentActivityTool = tool({
  description: DESCRIPTIONS.getRecentActivity,
  inputSchema: getRecentActivitySchema,
});

// Action tools - create/update operations
export const createTaskTool = tool({
  description: DESCRIPTIONS.createTask,
  inputSchema: createTaskSchema,
});

export const updateTaskTool = tool({
  description: DESCRIPTIONS.updateTask,
  inputSchema: updateTaskSchema,
});

export const deleteTaskTool = tool({
  description: DESCRIPTIONS.deleteTask,
  inputSchema: deleteTaskSchema,
});

export const moveTaskTool = tool({
  description: DESCRIPTIONS.moveTask,
  inputSchema: moveTaskSchema,
});

export const createBoardTool = tool({
  description: DESCRIPTIONS.createBoard,
  inputSchema: createBoardSchema,
});

export const updateBoardTool = tool({
  description: DESCRIPTIONS.updateBoard,
  inputSchema: updateBoardSchema,
});

export const deleteBoardTool = tool({
  description: DESCRIPTIONS.deleteBoard,
  inputSchema: deleteBoardSchema,
});

export const createColumnTool = tool({
  description: DESCRIPTIONS.createColumn,
  inputSchema: createColumnSchema,
});

export const bulkUpdateTasksTool = tool({
  description: DESCRIPTIONS.bulkUpdateTasks,
  inputSchema: bulkUpdateTasksSchema,
});

export const bulkDeleteTasksTool = tool({
  description: DESCRIPTIONS.bulkDeleteTasks,
  inputSchema: bulkDeleteTasksSchema,
});

// Query tools collection
export const queryTools = {
  getWorkspaceOverview: getWorkspaceOverviewTool,
  getBoardDetails: getBoardDetailsTool,
  getTaskDetails: getTaskDetailsTool,
  searchTasks: searchTasksTool,
  getRecentActivity: getRecentActivityTool,
};

// Action tools collection
export const actionTools = {
  createTask: createTaskTool,
  updateTask: updateTaskTool,
  deleteTask: deleteTaskTool,
  moveTask: moveTaskTool,
  createBoard: createBoardTool,
  updateBoard: updateBoardTool,
  deleteBoard: deleteBoardTool,
  createColumn: createColumnTool,
  bulkUpdateTasks: bulkUpdateTasksTool,
  bulkDeleteTasks: bulkDeleteTasksTool,
};

// All available tools
export const allTools = {
  ...queryTools,
  ...actionTools,
};

export type QueryToolName = keyof typeof queryTools;
export type ActionToolName = keyof typeof actionTools;
export type ToolName = keyof typeof allTools;

// Check if a tool requires confirmation before execution
export function requiresConfirmation(toolName: string): boolean {
  const meta = toolMetadata[toolName as keyof typeof toolMetadata];
  return meta?.requiresConfirmation ?? false;
}

// Get tools filtered by category
export function getToolsByCategory(category: ToolCategory) {
  return Object.entries(allTools).filter(([name]) => {
    const meta = toolMetadata[name as keyof typeof toolMetadata];
    return meta?.category === category;
  });
}

// Get tools that are safe to execute without confirmation
export function getSafeTools() {
  return Object.entries(allTools).filter(([name]) => {
    const meta = toolMetadata[name as keyof typeof toolMetadata];
    return !meta?.requiresConfirmation;
  });
}
