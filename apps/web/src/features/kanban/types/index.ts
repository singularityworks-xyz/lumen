export type Profile = {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: "admin" | "employee";
  created_at: string;
};

export type Task = {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  progress: number;
  position: number;
  due_date?: string;
  created_by: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  checklists?: Checklist[];
};

export type Checklist = {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  position: number;
};

export type Column = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  tasks?: Task[];
};

export type Board = {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  columns?: Column[];
};

export type Workspace = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
};

// React Flow specific types
export type BoardNode = {
  id: string;
  type: "board";
  position: { x: number; y: number };
  data: {
    board: Board;
    isSelected: boolean;
  };
  width?: number;
  height?: number;
};
