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
  addReply: (
    parentId: string,
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
        | "replyCount"
      >
    >
  ) => void;
  updateComments: (
    updates: {
      id: string;
      changes: Partial<
        Pick<
          Comment,
          | "content"
          | "x"
          | "y"
          | "lastEditedById"
          | "lastEditorName"
          | "lastEditorImage"
          | "replyCount"
        >
      >;
    }[]
  ) => void;
  removeComment: (id: string) => void;
  finalizeCommentsDrag: (commentIds: string[]) => void;
  getRepliesForComment: (parentId: string) => Comment[];
  lastActiveDrawerTab: "comments" | "discussion";
  setLastActiveDrawerTab: (tab: "comments" | "discussion") => void;
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
  lastActiveDrawerTab: "comments",
  setLastActiveDrawerTab: (tab) => {
    set((state) => {
      state.lastActiveDrawerTab = tab;
    });
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
      replyCount: 0,
    };

    set((state) => {
      state.comments.byId[newComment.id] = newComment;
      state.comments.allIds.push(newComment.id);
    });
  },
  addReply: (parentId, content, author) => {
    const currentState = get();
    const parentComment = currentState.comments.byId[parentId];
    if (!(parentComment && currentState.currentWorkspaceId)) {
      return;
    }

    const newReply: Comment = {
      id: crypto.randomUUID(),
      x: parentComment.x,
      y: parentComment.y,
      content,
      authorId: author.id,
      authorName: author.name,
      authorImage: author.image,
      workspaceId: currentState.currentWorkspaceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parentId,
      replyCount: 0,
    };

    set((state) => {
      state.comments.byId[newReply.id] = newReply;
      state.comments.allIds.push(newReply.id);
      const parent = state.comments.byId[parentId];
      if (parent) {
        parent.replyCount = (parent.replyCount ?? 0) + 1;
        parent.updatedAt = new Date().toISOString();
      }
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
        if (updates.replyCount !== undefined) {
          comment.replyCount = updates.replyCount;
        }
        comment.updatedAt = new Date().toISOString();
      }
    });
  },
  updateComments: (updates) => {
    set((state) => {
      const now = new Date().toISOString();
      for (const { id, changes } of updates) {
        const comment = state.comments.byId[id];
        if (comment) {
          if (changes.content !== undefined) {
            comment.content = changes.content;
          }
          if (changes.x !== undefined) {
            comment.x = changes.x;
          }
          if (changes.y !== undefined) {
            comment.y = changes.y;
          }
          if (changes.lastEditedById !== undefined) {
            comment.lastEditedById = changes.lastEditedById;
          }
          if (changes.lastEditorName !== undefined) {
            comment.lastEditorName = changes.lastEditorName;
          }
          if (changes.lastEditorImage !== undefined) {
            comment.lastEditorImage = changes.lastEditorImage;
          }
          if (changes.replyCount !== undefined) {
            comment.replyCount = changes.replyCount;
          }
          comment.updatedAt = now;
        }
      }
    });
  },
  removeComment: (id) => {
    set((state) => {
      const comment = state.comments.byId[id];
      if (!comment) {
        return;
      }

      if (comment.parentId) {
        const parent = state.comments.byId[comment.parentId];
        if (parent && (parent.replyCount ?? 0) > 0) {
          parent.replyCount = (parent.replyCount ?? 1) - 1;
          parent.updatedAt = new Date().toISOString();
        }
      }

      const replyIds = state.comments.allIds.filter((cid) => {
        const c = state.comments.byId[cid];
        return c?.parentId === id;
      });
      for (const replyId of replyIds) {
        delete state.comments.byId[replyId];
      }

      delete state.comments.byId[id];
      state.comments.allIds = state.comments.allIds.filter(
        (commentId) => commentId !== id && !replyIds.includes(commentId)
      );
    });
  },
  finalizeCommentsDrag: (commentIds) => {
    set((state) => {
      const now = new Date().toISOString();
      for (const id of commentIds) {
        const comment = state.comments.byId[id];
        if (comment) {
          // Touching updatedAt triggers a sync even if position hasn't changed since last throttled update
          comment.updatedAt = now;
        }
      }
    });
  },
  getRepliesForComment: (parentId) => {
    const state = get();
    return state.comments.allIds
      .map((id) => state.comments.byId[id])
      .filter((c): c is Comment => !!c && c.parentId === parentId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  },
});
