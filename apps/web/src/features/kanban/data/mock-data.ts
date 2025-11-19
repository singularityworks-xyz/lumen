import type { Board, Workspace } from "../types";

export const mockWorkspaces: Workspace[] = [
  {
    id: "ws-1",
    name: "Personal",
    description: "Personal projects",
    created_at: new Date().toISOString(),
  },
  {
    id: "ws-2",
    name: "Work",
    description: "Work projects",
    created_at: new Date().toISOString(),
  },
];

export const mockBoards: Board[] = [
  {
    id: "board-1",
    name: "Q1 Projects",
    description: "Our current quarter initiatives",
    created_by: "user1",
    created_at: new Date().toISOString(),
    columns: [
      {
        id: "col-1",
        board_id: "board-1",
        name: "To Do",
        position: 0,
        tasks: [
          {
            id: "task-1",
            board_id: "board-1",
            column_id: "col-1",
            title: "Design new landing page",
            description:
              "Create mockups and prototypes for the new landing page",
            priority: "high",
            progress: 0,
            position: 0,
            created_by: "user1",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: ["design", "frontend"],
            due_date: new Date(
              Date.now() + 5 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          {
            id: "task-2",
            board_id: "board-1",
            column_id: "col-1",
            title: "Setup development environment",
            description: "Configure all necessary tools and dependencies",
            priority: "medium",
            progress: 0,
            position: 1,
            created_by: "user1",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: ["setup", "backend"],
          },
        ],
      },
      {
        id: "col-2",
        board_id: "board-1",
        name: "In Progress",
        position: 1,
        tasks: [
          {
            id: "task-3",
            board_id: "board-1",
            column_id: "col-2",
            title: "Implement user authentication",
            description: "Add login, signup, and session management",
            priority: "high",
            progress: 60,
            position: 0,
            created_by: "user1",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: ["backend", "security"],
            checklists: [
              {
                id: "check-1",
                task_id: "task-3",
                title: "Setup auth provider",
                completed: true,
                position: 0,
              },
              {
                id: "check-2",
                task_id: "task-3",
                title: "Create login form",
                completed: true,
                position: 1,
              },
              {
                id: "check-3",
                task_id: "task-3",
                title: "Add password reset flow",
                completed: false,
                position: 2,
              },
            ],
          },
        ],
      },
      {
        id: "col-3",
        board_id: "board-1",
        name: "Review",
        position: 2,
        tasks: [
          {
            id: "task-4",
            board_id: "board-1",
            column_id: "col-3",
            title: "Code review: API endpoints",
            description: "Review all new API endpoints for consistency",
            priority: "medium",
            progress: 80,
            position: 0,
            created_by: "user1",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: ["review", "backend"],
          },
        ],
      },
      {
        id: "col-4",
        board_id: "board-1",
        name: "Done",
        position: 3,
        tasks: [
          {
            id: "task-5",
            board_id: "board-1",
            column_id: "col-4",
            title: "Database schema design",
            description: "Designed and created initial database tables",
            priority: "high",
            progress: 100,
            position: 0,
            created_by: "user1",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: ["database", "backend"],
            due_date: new Date(
              Date.now() - 5 * 24 * 60 * 60 * 1000
            ).toISOString(),
          },
        ],
      },
    ],
  },
];
