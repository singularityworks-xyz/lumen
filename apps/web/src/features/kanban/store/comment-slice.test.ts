import { beforeEach, describe, expect, it, mock } from "bun:test";

let nanoidCounter = 0;
mock.module("nanoid", () => ({ nanoid: () => `seq${++nanoidCounter}` }));

import { createFreshState } from "@tests/helpers/store-harness";
import { createCommentSlice } from "./slices/comment-slice";
import type { KanbanStore } from "./types";

function createStore(): {
  state: KanbanStore;
  actions: ReturnType<typeof createCommentSlice>;
} {
  const state = createFreshState() as KanbanStore;
  const set: (fn: (state: KanbanStore) => void) => void = (fn) => {
    fn(state);
  };
  const get: () => KanbanStore = () => state;
  const actions = createCommentSlice(set, get);
  Object.assign(state, actions);
  return { state, actions };
}

describe("comment-slice", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    nanoidCounter = 0;
    store = createStore();
  });

  it("addComment requires current workspace", () => {
    store.state.currentWorkspaceId = null;
    store.actions.addComment({ x: 1, y: 2 }, "hello", { id: "u1" });
    expect(store.state.comments.allIds).toHaveLength(0);
  });

  it("addComment creates comment when workspace is set", () => {
    store.state.currentWorkspaceId = "ws-1";
    store.actions.addComment({ x: 10, y: 20 }, "hello", {
      id: "u1",
      name: "Alice",
    });
    expect(store.state.comments.allIds).toHaveLength(1);
    const id = store.state.comments.allIds[0];
    expect(id).toBeDefined();
    const comment = store.state.comments.byId[id as string];
    expect(comment).toBeDefined();
    expect(comment?.workspaceId).toBe("ws-1");
    expect(comment?.content).toBe("hello");
    expect(comment?.x).toBe(10);
    expect(comment?.y).toBe(20);
    expect(comment?.replyCount).toBe(0);
  });

  it("addReply inherits workspace and bumps parent reply count", () => {
    store.state.currentWorkspaceId = "ws-1";
    store.actions.addComment({ x: 5, y: 5 }, "parent", { id: "u1" });
    const parentId = store.state.comments.allIds[0];
    expect(parentId).toBeDefined();

    store.actions.addReply(parentId as string, "reply content", {
      id: "u2",
      name: "Bob",
    });

    expect(store.state.comments.allIds).toHaveLength(2);
    const replyId = store.state.comments.allIds[1];
    expect(replyId).toBeDefined();
    const reply = store.state.comments.byId[replyId as string];
    expect(reply).toBeDefined();
    expect(reply?.parentId).toBe(parentId);
    expect(reply?.workspaceId).toBe("ws-1");
    expect(reply?.x).toBe(5);
    expect(reply?.y).toBe(5);

    const parent = store.state.comments.byId[parentId as string];
    expect(parent).toBeDefined();
    expect(parent?.replyCount).toBe(1);
  });

  it("addReply does nothing if parent does not exist", () => {
    store.state.currentWorkspaceId = "ws-1";
    store.actions.addReply("nonexistent", "reply", { id: "u1" });
    expect(store.state.comments.allIds).toHaveLength(0);
  });

  it("removeComment recursively removes descendants", () => {
    store.state.currentWorkspaceId = "ws-1";
    store.actions.addComment({ x: 0, y: 0 }, "root", { id: "u1" });
    const rootId = store.state.comments.allIds[0];
    expect(rootId).toBeDefined();

    store.actions.addReply(rootId as string, "reply1", { id: "u1" });
    const reply1Id = store.state.comments.allIds[1];
    expect(reply1Id).toBeDefined();

    store.actions.addReply(reply1Id as string, "reply1-1", { id: "u1" });
    const reply1_1Id = store.state.comments.allIds[2];
    expect(reply1_1Id).toBeDefined();

    store.actions.addReply(rootId as string, "reply2", { id: "u1" });
    const reply2Id = store.state.comments.allIds[3];
    expect(reply2Id).toBeDefined();

    expect(store.state.comments.allIds).toHaveLength(4);

    store.actions.removeComment(reply1Id as string);

    expect(store.state.comments.byId[reply1Id as string]).toBeUndefined();
    expect(store.state.comments.byId[reply1_1Id as string]).toBeUndefined();
    expect(store.state.comments.byId[rootId as string]).toBeDefined();
    expect(store.state.comments.byId[reply2Id as string]).toBeDefined();
    expect(store.state.comments.allIds).toHaveLength(2);

    const parent = store.state.comments.byId[rootId as string];
    expect(parent).toBeDefined();
    expect(parent?.replyCount).toBe(1);
  });

  it("updateComments batch shares one timestamp", () => {
    store.state.currentWorkspaceId = "ws-1";
    store.actions.addComment({ x: 0, y: 0 }, "c1", { id: "u1" });
    store.actions.addComment({ x: 0, y: 0 }, "c2", { id: "u1" });
    const id1 = store.state.comments.allIds[0];
    const id2 = store.state.comments.allIds[1];
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();

    store.actions.updateComments([
      { id: id1 as string, changes: { content: "updated c1" } },
      { id: id2 as string, changes: { content: "updated c2" } },
    ]);

    const c1 = store.state.comments.byId[id1 as string];
    const c2 = store.state.comments.byId[id2 as string];
    expect(c1).toBeDefined();
    expect(c2).toBeDefined();
    expect(c1?.content).toBe("updated c1");
    expect(c2?.content).toBe("updated c2");
    expect(c1?.updatedAt).toBe(c2?.updatedAt);
  });

  it("getRepliesForComment returns replies chronologically", () => {
    store.state.currentWorkspaceId = "ws-1";
    store.actions.addComment({ x: 0, y: 0 }, "parent", { id: "u1" });
    const parentId = store.state.comments.allIds[0];
    expect(parentId).toBeDefined();

    store.actions.addReply(parentId as string, "early", { id: "u1" });
    store.actions.addReply(parentId as string, "late", { id: "u1" });
    store.actions.addReply(parentId as string, "middle", { id: "u1" });

    const replies = store.actions.getRepliesForComment(parentId as string);
    expect(replies).toHaveLength(3);

    const contents = replies.map((r) => r.content);
    expect(contents).toEqual(["early", "late", "middle"]);
    for (let i = 1; i < replies.length; i++) {
      const prev = replies[i - 1];
      const curr = replies[i];
      if (prev && curr) {
        expect(new Date(curr.createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(prev.createdAt).getTime()
        );
      }
    }
  });
});
