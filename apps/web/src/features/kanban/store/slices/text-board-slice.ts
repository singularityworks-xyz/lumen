import { createLogger } from "@lumen/logger";
import type { TextBoard, TextBoardPosition } from "../../types";
import { generateTextBoardId } from "../ids";
import type { KanbanStore } from "../types";
import { getNextZIndex } from "../utils";

const logger = createLogger({ name: "[client] kanban/text-board" });

// Default size for a freshly created text board.
export const TEXT_BOARD_DEFAULT_WIDTH = 320;
export const TEXT_BOARD_DEFAULT_HEIGHT = 420;
// Hard floor for resizing - the board cannot shrink below this width.
export const TEXT_BOARD_MIN_WIDTH = 280;
export const TEXT_BOARD_MIN_HEIGHT = 180;

type SliceCreator = (
  set: (fn: (state: KanbanStore) => void) => void,
  get: () => KanbanStore
) => Pick<
  KanbanStore,
  | "addTextBoard"
  | "updateTextBoard"
  | "removeTextBoard"
  | "updateTextBoardPosition"
  | "updateTextBoardDimensions"
  | "finalizeTextBoardDrag"
  | "bringTextBoardToFront"
>;

export const createTextBoardSlice: SliceCreator = (set, get) => ({
  addTextBoard: (name, position, description) => {
    const textBoardId = generateTextBoardId();
    const now = new Date().toISOString();
    const workspaceId = get().currentWorkspaceId ?? "";

    const textBoard: TextBoard = {
      id: textBoardId,
      name,
      description,
      workspace_id: workspaceId,
      created_by: "current-user",
      created_at: now,
      updated_at: now,
    };

    set((state) => {
      let finalPosition: { x: number; y: number } = position ?? {
        x: 0,
        y: 0,
      };

      if (!position) {
        const workspace = state.workspaces.byId[workspaceId];
        if (workspace) {
          const boardIds = workspace.board_ids;
          const textBoardIds = workspace.text_board_ids ?? [];
          const currentSelectedBoardId = state.selectedBoardId;
          const lastFocusedBoardId = workspace.lastFocusedBoardId;

          // Cascade below whichever board or text board is currently focused
          let targetId: string | undefined;
          if (
            currentSelectedBoardId &&
            [...boardIds, ...textBoardIds].includes(currentSelectedBoardId)
          ) {
            targetId = currentSelectedBoardId;
          } else if (
            lastFocusedBoardId &&
            [...boardIds, ...textBoardIds].includes(lastFocusedBoardId)
          ) {
            targetId = lastFocusedBoardId;
          } else {
            const allIds = [...boardIds, ...textBoardIds];
            targetId = allIds.at(-1);
          }

          if (targetId) {
            const boardPos = state.boardPositions.byId[targetId];
            const textBoardPos = state.textBoardPositions.byId[targetId];
            const pos = boardPos ?? textBoardPos;
            if (pos) {
              finalPosition = {
                x: pos.x,
                y: pos.y + (pos.height || TEXT_BOARD_DEFAULT_HEIGHT) + 50,
              };
            }
          }
        }
      }

      state.textBoards.byId[textBoardId] = textBoard;
      state.textBoards.allIds.push(textBoardId);

      const textBoardPosition: TextBoardPosition = {
        id: textBoardId,
        x: finalPosition.x,
        y: finalPosition.y,
        zIndex: getNextZIndex(state.textBoardPositions),
        width: TEXT_BOARD_DEFAULT_WIDTH,
        height: TEXT_BOARD_DEFAULT_HEIGHT,
      };
      state.textBoardPositions.byId[textBoardId] = textBoardPosition;
      state.textBoardPositions.allIds.push(textBoardId);

      const workspace = state.workspaces.byId[workspaceId];
      if (workspace) {
        if (!workspace.text_board_ids) {
          workspace.text_board_ids = [];
        }
        workspace.text_board_ids.push(textBoardId);
        workspace.lastFocusedBoardId = textBoardId;
      }

      state.canvas.focusedBoardId = textBoardId;
      state.selectedBoardId = textBoardId;
    });

    logger.info({ id: textBoardId, name, workspaceId }, "Text board created");
    return textBoardId;
  },

  updateTextBoard: (textBoardId, updates) =>
    set((state) => {
      const textBoard = state.textBoards.byId[textBoardId];
      if (textBoard) {
        Object.assign(textBoard, updates, {
          updated_at: new Date().toISOString(),
        });
        const workspace = state.workspaces.byId[textBoard.workspace_id];
        if (workspace) {
          workspace.lastFocusedBoardId = textBoardId;
        }
      }
    }),

  removeTextBoard: (textBoardId) =>
    set((state) => {
      const textBoard = state.textBoards.byId[textBoardId];
      if (!textBoard) {
        logger.warn({ id: textBoardId }, "Text board not found");
        return;
      }

      logger.info(
        { id: textBoardId, name: textBoard.name },
        "Text board deleted"
      );

      const workspace = state.workspaces.byId[textBoard.workspace_id];
      if (workspace?.text_board_ids) {
        workspace.text_board_ids = workspace.text_board_ids.filter(
          (id) => id !== textBoardId
        );
      }

      delete state.textBoards.byId[textBoardId];
      state.textBoards.allIds = state.textBoards.allIds.filter(
        (id) => id !== textBoardId
      );
      delete state.textBoardPositions.byId[textBoardId];
      state.textBoardPositions.allIds = state.textBoardPositions.allIds.filter(
        (id) => id !== textBoardId
      );

      if (state.selectedBoardId === textBoardId) {
        state.selectedBoardId = null;
      }
      state.selectedBoardIds = state.selectedBoardIds.filter(
        (id) => id !== textBoardId
      );
    }),

  updateTextBoardPosition: (textBoardId, position) =>
    set((state) => {
      const textBoardPos = state.textBoardPositions.byId[textBoardId];
      if (textBoardPos) {
        textBoardPos.x = position.x;
        textBoardPos.y = position.y;
      }
    }),

  updateTextBoardDimensions: (textBoardId, dimensions, isUserResize = false) =>
    set((state) => {
      const textBoardPos = state.textBoardPositions.byId[textBoardId];
      if (!textBoardPos) {
        return;
      }
      // Clamp to the hard minimum so synced/remote resizes can never
      // collapse the board below a usable width.
      const clampedDimensions = {
        width: Math.max(TEXT_BOARD_MIN_WIDTH, dimensions.width),
        height: Math.max(TEXT_BOARD_MIN_HEIGHT, dimensions.height),
      };
      if (
        textBoardPos.width === clampedDimensions.width &&
        textBoardPos.height === clampedDimensions.height
      ) {
        if (
          isUserResize &&
          (!textBoardPos.userResized ||
            textBoardPos.lastUserWidth !== dimensions.width ||
            textBoardPos.lastUserHeight !== dimensions.height)
        ) {
          textBoardPos.userResized = true;
          textBoardPos.lastUserWidth = dimensions.width;
          textBoardPos.lastUserHeight = dimensions.height;
        }
        return;
      }

      textBoardPos.width = clampedDimensions.width;
      textBoardPos.height = clampedDimensions.height;

      if (isUserResize) {
        textBoardPos.userResized = true;
        textBoardPos.lastUserWidth = clampedDimensions.width;
        textBoardPos.lastUserHeight = clampedDimensions.height;
      }
    }),

  finalizeTextBoardDrag: (textBoardId) =>
    set((state) => {
      // Final drag position is synced by the sync layer on drag end
      const textBoardPos = state.textBoardPositions.byId[textBoardId];
      if (textBoardPos) {
        // No action needed - sync layer handles final position syncing
      }
    }),

  bringTextBoardToFront: (textBoardId) =>
    set((state) => {
      const textBoardPos = state.textBoardPositions.byId[textBoardId];
      if (textBoardPos) {
        textBoardPos.zIndex = getNextZIndex(state.textBoardPositions);
      }
    }),
});
