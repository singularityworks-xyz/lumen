export type ToolExecutionResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  instruction?: {
    type: string;
    [key: string]: unknown;
  };
  message?: string;
};

// Workspace snapshot sent from the client.
// This is the only source of workspace data for query tools.
// Action tools may use Yjs for mutations but should use snapshot for reads.
export type WorkspaceSnapshot = {
  name: string;
  boards: Array<{
    id: string;
    name: string;
    description?: string;
    accentColor?: string;
    icon?: string;
    columns: Array<{
      id: string;
      name: string;
      description?: string;
      position: number;
      accentColor?: string;
      icon?: string;
      tasks: Array<{
        id: string;
        title: string;
        description?: string;
        priority: "low" | "medium" | "high" | "urgent";
        status:
          | "todo"
          | "in_progress"
          | "done"
          | "blocked"
          | "cancelled"
          | "trash";
        progress: number;
        position: number;
        dueDate?: string;
        tags?: string[];
        assignedTo?: string;
      }>;
    }>;
  }>;
};

// Context passed to all tool executors.
// For local workspaces, only snapshot is used.
// For shared workspaces, both snapshot (for reads) and Yjs (for writes) may be available.
export type ExecutorContext = {
  workspaceId: string;
  userId: string;
  // Workspace data from client - privacy-preserving, always available
  snapshot?: WorkspaceSnapshot;
  // If true, action tools should return instructions instead of executing.
  // Used for local workspaces where the server cannot access Yjs.
  // The client will execute these instructions locally.
  ephemeral?: boolean;
};

// Get workspace data from the snapshot.
// This is the preferred method for all query operations.
export function getWorkspaceFromSnapshot(
  ctx: ExecutorContext
): WorkspaceSnapshot | null {
  if (ctx.snapshot) {
    return ctx.snapshot;
  }

  console.warn(
    "[AI] No workspace snapshot provided, AI tools may not work correctly",
    { workspaceId: ctx.workspaceId }
  );
  return null;
}

// Map priority values, handling 'urgent' as 'high'.
export function mapPriority(priority?: string): "low" | "medium" | "high" {
  if (!priority) {
    return "medium";
  }
  if (priority === "urgent") {
    return "high";
  }
  if (priority === "low" || priority === "medium" || priority === "high") {
    return priority;
  }
  return "medium";
}
