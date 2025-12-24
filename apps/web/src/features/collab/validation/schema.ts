// Re-export everything from yjs-shared package (single source of truth)
export type {
  Area as ValidatedArea,
  AreaPosition as ValidatedAreaPosition,
  Board as ValidatedBoard,
  BoardConnection as ValidatedBoardConnection,
  BoardPosition as ValidatedBoardPosition,
  CanvasState as ValidatedCanvasState,
  Column as ValidatedColumn,
  Task as ValidatedTask,
  ViewportState as ValidatedViewportState,
  Workspace as ValidatedWorkspace,
} from "@lumen/yjs-shared";
// biome-ignore lint/performance/noBarrelFile: barrel in you ahh
export * from "@lumen/yjs-shared";
