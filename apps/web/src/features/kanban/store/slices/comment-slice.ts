import type { Comment } from "../../types";
import type { KanbanStore } from "../types";

export type CommentSlice = {
  comments: {
    byId: Record<string, Comment>;
    allIds: string[];
  };
  addComment: (
    position: { x: number; y: number },
    content: string,
    author: { id: string; name?: string; image?: string }
  ) => void;
  updateComment: (
    id: string,
    updates: Partial<
      Pick<
        Comment,
        | "content"
        | "x"
        | "y"
        | "lastEditedById"
        | "lastEditorName"
        | "lastEditorImage"
      >
    >
  ) => void;
  removeComment: (id: string) => void;
};

type SliceCreator = (
  set: (fn: (state: KanbanStore) => void) => void,
  get: () => KanbanStore
) => CommentSlice;

export const createCommentSlice: SliceCreator = (set, get) => ({
  comments: {
    byId: {},
    allIds: [],
  },
  addComment: (position, content, author) => {
    const currentState = get();
    if (!currentState.currentWorkspaceId) {
      return;
    }

    const newComment: Comment = {
      id: crypto.randomUUID(),
      x: position.x,
      y: position.y,
      content,
      authorId: author.id,
      authorName: author.name,
      authorImage: author.image,
      workspaceId: currentState.currentWorkspaceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => {
      state.comments.byId[newComment.id] = newComment;
      state.comments.allIds.push(newComment.id);
    });
  },
  updateComment: (id, updates) => {
    set((state) => {
      const comment = state.comments.byId[id];
      if (comment) {
        if (updates.content !== undefined) {
          comment.content = updates.content;
        }
        if (updates.x !== undefined) {
          comment.x = updates.x;
        }
        if (updates.y !== undefined) {
          comment.y = updates.y;
        }
        if (updates.lastEditedById !== undefined) {
          comment.lastEditedById = updates.lastEditedById;
        }
        if (updates.lastEditorName !== undefined) {
          comment.lastEditorName = updates.lastEditorName;
        }
        if (updates.lastEditorImage !== undefined) {
          comment.lastEditorImage = updates.lastEditorImage;
        }
        comment.updatedAt = new Date().toISOString();
      }
    });
  },
  removeComment: (id) => {
    set((state) => {
      delete state.comments.byId[id];
      state.comments.allIds = state.comments.allIds.filter(
        (commentId) => commentId !== id
      );
    });
  },
});
