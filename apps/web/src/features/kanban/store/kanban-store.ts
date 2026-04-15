import type { TemporalState } from "zundo";
import { temporal } from "zundo";
import type { StateCreator } from "zustand";
import { create, useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createAreaSlice } from "./slices/area-slice";
import { createBoardSlice } from "./slices/board-slice";
import { createChatSlice } from "./slices/chat-slice";
import { createColumnSlice } from "./slices/column-slice";
import { createCommentSlice } from "./slices/comment-slice";
import { createConnectionSlice } from "./slices/connection-slice";
import { createModalSlice } from "./slices/modal-slice";
import { createTaskSlice } from "./slices/task-slice";
import { createUiSlice } from "./slices/ui-slice";
import { createWorkspaceSlice } from "./slices/workspace-slice";
import { createZIndexSlice } from "./slices/z-index-slice";
import { indexedDBStorage, STORAGE_KEY } from "./storage";
import type { KanbanState, KanbanStore } from "./types";
import { createInitialState } from "./utils";

export type { KanbanActions, KanbanState } from "./types";

const storeCreator: StateCreator<
  KanbanStore,
  [["zustand/immer", never]],
  [],
  KanbanStore
> = (set, get) => ({
  ...createInitialState(),
  ...createWorkspaceSlice(set, get),
  ...createBoardSlice(set, get),
  ...createColumnSlice(set, get),
  ...createCommentSlice(set, get),
  ...createChatSlice(set, get),
  ...createTaskSlice(set, get),
  ...createConnectionSlice(set, get),
  ...createModalSlice(set, get),
  ...createUiSlice(set, get),
  ...createZIndexSlice(set, get),
  ...createAreaSlice(set, get),
});

const uiStateFields: (keyof KanbanState)[] = [
  "showCommandPalette",
  "showMiniMap",
  "interactionMode",
  "selectedBoardId",
  "selectedBoardIds",
  "selectedTaskIds",
  "draggedTaskId",
  "columnUi",
];

const temporalExcludeFields: (keyof KanbanState)[] = [
  ...uiStateFields,
  "canvas",
];

export const useKanbanStore = create<KanbanStore>()(
  persist(
    temporal(immer(storeCreator), {
      limit: 200,
      partialize: (state) => {
        const tracked: Partial<KanbanState> = {};
        for (const key of Object.keys(state) as (keyof KanbanState)[]) {
          if (!temporalExcludeFields.includes(key)) {
            // @ts-expect-error - Dynamic assignment
            tracked[key] = state[key];
          }
        }
        return tracked;
      },
      equality: (pastState, currentState) => shallow(pastState, currentState),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => {
        const persisted: Partial<KanbanState> = {
          workspaces: state.workspaces,
          boards: state.boards,
          columns: state.columns,
          comments: state.comments,
          chatMessages: state.chatMessages,
          tasks: state.tasks,
          boardPositions: state.boardPositions,
          boardConnections: state.boardConnections,
          currentWorkspaceId: state.currentWorkspaceId,
          canvas: state.canvas,
          createTaskModals: state.createTaskModals,
          taskDetailModals: state.taskDetailModals,
          workspaceQuickActions: state.workspaceQuickActions,
          workspaceDialog: state.workspaceDialog,
          columnQuickActions: state.columnQuickActions,
          columnDialogs: state.columnDialogs,
          boardQuickActions: state.boardQuickActions,
          boardDialogs: state.boardDialogs,
          connectionDialog: state.connectionDialog,
          taskQuickActions: state.taskQuickActions,
          columnUi: state.columnUi,
          lastActiveDrawerTab: state.lastActiveDrawerTab,
          areas: state.areas,
          areaPositions: state.areaPositions,
          areaDialogs: state.areaDialogs,
          selectionBox: state.selectionBox,
          lastTaskModalPositions: state.lastTaskModalPositions,
        };
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (
            state.boardQuickActions === null ||
            typeof state.boardQuickActions !== "object"
          ) {
            setTimeout(() => {
              useKanbanStore.setState({ boardQuickActions: {} });
            }, 0);
          }

          const workspaceId = state.currentWorkspaceId;
          if (workspaceId && state.workspaces?.byId[workspaceId]) {
            const workspace = state.workspaces.byId[workspaceId];
            if (workspace.showMiniMap !== undefined) {
              setTimeout(() => {
                useKanbanStore.setState({ showMiniMap: workspace.showMiniMap });
              }, 0);
            }
          }
        }
      },
    }
  )
);

export const useTemporalStore = <T>(
  selector: (state: TemporalState<Partial<KanbanState>>) => T
): T => useStore(useKanbanStore.temporal, selector);

export const useCanUndo = (): boolean =>
  useTemporalStore((state) => state.pastStates.length > 0);

export const useCanRedo = (): boolean =>
  useTemporalStore((state) => state.futureStates.length > 0);

export const undo = (): void => useKanbanStore.temporal.getState().undo();

export const redo = (): void => useKanbanStore.temporal.getState().redo();

export const canUndo = (): boolean =>
  useKanbanStore.temporal.getState().pastStates.length > 0;

export const canRedo = (): boolean =>
  useKanbanStore.temporal.getState().futureStates.length > 0;

export const clearHistory = (): void =>
  useKanbanStore.temporal.getState().clear();
