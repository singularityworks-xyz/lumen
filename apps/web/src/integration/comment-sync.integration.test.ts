import { describe, expect, it } from "bun:test";
import * as Y from "yjs";
import { YJS_MAP_NAMES } from "@/src/features/collab/sync/entity-sync";
import { applyYjsToStateWithRepair } from "@/src/features/collab/sync/state-sync";
import type { KanbanState } from "@/src/features/kanban/store/types";
import { createInitialState } from "@/src/features/kanban/store/utils";
import type { Comment } from "@/src/features/kanban/types";

const FROZEN_TIMESTAMP = "2024-01-15T12:00:00.000Z";

// Use unique IDs per invocation to avoid module-level METADATA collision
// when running alongside other Yjs-based test files in the same Bun process.
let _commentTestCounter = 0;

function nextWorkspaceId(): string {
  _commentTestCounter += 1;
  return `ws-comment-test-${_commentTestCounter}`;
}

function createBaseDoc(wsId: string): Y.Doc {
  const doc = new Y.Doc();
  doc.getMap(YJS_MAP_NAMES.WORKSPACE).set(wsId, {
    id: wsId,
    name: "Comment Test Workspace",
    created_at: FROZEN_TIMESTAMP,
    board_ids: [],
  });
  return doc;
}

function makeComment(
  overrides: Partial<Comment> & { id: string },
  wsId: string
): Comment {
  return {
    authorId: "user-1",
    authorName: "Alice",
    content: "Test comment",
    createdAt: FROZEN_TIMESTAMP,
    updatedAt: FROZEN_TIMESTAMP,
    workspaceId: wsId,
    x: 100,
    y: 200,
    ...overrides,
  };
}

function createStateWithWorkspace(wsId: string): KanbanState {
  const state = createInitialState();
  state.workspaces.byId[wsId] = {
    id: wsId,
    name: "Comment Test Workspace",
    created_at: FROZEN_TIMESTAMP,
    board_ids: [],
  };
  state.workspaces.allIds.push(wsId);
  return state;
}

// ─── Comment CRUD through Y.Doc round-trip ─────────────────────

describe("WEB-I-COMMENT: Comment sync integration", () => {
  describe("comment creation syncs through Y.Doc", () => {
    it("creates a comment in Y.Doc and syncs to store", () => {
      const wsId = nextWorkspaceId();
      const doc = createBaseDoc(wsId);
      const comment = makeComment(
        { id: "comment-1", content: "Hello world" },
        wsId
      );

      doc.getMap(YJS_MAP_NAMES.COMMENTS).set("comment-1", comment);

      const localState = createStateWithWorkspace(wsId);
      const result = applyYjsToStateWithRepair(doc, localState, wsId);

      expect(result.comments?.byId["comment-1"]).toBeDefined();
      expect(result.comments?.byId["comment-1"]?.content).toBe("Hello world");
      expect(result.comments?.byId["comment-1"]?.authorId).toBe("user-1");
      expect(result.comments?.byId["comment-1"]?.x).toBe(100);
      expect(result.comments?.byId["comment-1"]?.y).toBe(200);
    });

    it("syncs multiple comments", () => {
      const wsId = nextWorkspaceId();
      const doc = createBaseDoc(wsId);

      doc
        .getMap(YJS_MAP_NAMES.COMMENTS)
        .set(
          "comment-1",
          makeComment(
            { id: "comment-1", content: "First", x: 100, y: 100 },
            wsId
          )
        );
      doc.getMap(YJS_MAP_NAMES.COMMENTS).set(
        "comment-2",
        makeComment(
          {
            id: "comment-2",
            content: "Second",
            x: 200,
            y: 200,
            authorId: "user-2",
          },
          wsId
        )
      );
      doc
        .getMap(YJS_MAP_NAMES.COMMENTS)
        .set(
          "comment-3",
          makeComment(
            { id: "comment-3", content: "Third", x: 300, y: 300 },
            wsId
          )
        );

      const localState = createStateWithWorkspace(wsId);
      const result = applyYjsToStateWithRepair(doc, localState, wsId);

      expect(result.comments?.allIds).toHaveLength(3);
      expect(result.comments?.byId["comment-1"]?.content).toBe("First");
      expect(result.comments?.byId["comment-2"]?.content).toBe("Second");
      expect(result.comments?.byId["comment-3"]?.content).toBe("Third");
    });

    it("syncs comment with reply metadata", () => {
      const wsId = nextWorkspaceId();
      const doc = createBaseDoc(wsId);
      const parentComment = makeComment(
        {
          id: "parent-1",
          content: "Main comment",
          replyCount: 2,
        },
        wsId
      );
      const reply = makeComment(
        {
          id: "reply-1",
          content: "Reply to main",
          parentId: "parent-1",
        },
        wsId
      );

      doc.getMap(YJS_MAP_NAMES.COMMENTS).set("parent-1", parentComment);
      doc.getMap(YJS_MAP_NAMES.COMMENTS).set("reply-1", reply);

      const localState = createStateWithWorkspace(wsId);
      const result = applyYjsToStateWithRepair(doc, localState, wsId);

      expect(result.comments?.byId["parent-1"]?.replyCount).toBe(2);
      expect(result.comments?.byId["reply-1"]?.parentId).toBe("parent-1");
    });
  });

  describe("comment update syncs through Y.Doc", () => {
    it("updates comment content via Y.Doc", () => {
      const wsId = nextWorkspaceId();
      const doc = createBaseDoc(wsId);
      const comment = makeComment(
        { id: "comment-1", content: "Original" },
        wsId
      );
      doc.getMap(YJS_MAP_NAMES.COMMENTS).set("comment-1", comment);

      const localState = createStateWithWorkspace(wsId);
      const state1 = applyYjsToStateWithRepair(doc, localState, wsId);
      expect(state1.comments?.byId["comment-1"]?.content).toBe("Original");

      const updatedComment = makeComment(
        {
          id: "comment-1",
          content: "Edited content",
          updatedAt: "2024-01-15T13:00:00.000Z",
          lastEditedById: "user-1",
          lastEditorName: "Alice",
        },
        wsId
      );
      doc.getMap(YJS_MAP_NAMES.COMMENTS).set("comment-1", updatedComment);

      const state2 = applyYjsToStateWithRepair(
        doc,
        state1 as KanbanState,
        wsId
      );
      expect(state2.comments?.byId["comment-1"]?.content).toBe(
        "Edited content"
      );
      expect(state2.comments?.byId["comment-1"]?.lastEditedById).toBe("user-1");
    });

    it("updates comment position via Y.Doc", () => {
      const wsId = nextWorkspaceId();
      const doc = createBaseDoc(wsId);
      doc
        .getMap(YJS_MAP_NAMES.COMMENTS)
        .set(
          "comment-1",
          makeComment({ id: "comment-1", x: 100, y: 200 }, wsId)
        );

      const localState = createStateWithWorkspace(wsId);
      const state1 = applyYjsToStateWithRepair(doc, localState, wsId);
      expect(state1.comments?.byId["comment-1"]?.x).toBe(100);

      doc
        .getMap(YJS_MAP_NAMES.COMMENTS)
        .set(
          "comment-1",
          makeComment({ id: "comment-1", x: 500, y: 600 }, wsId)
        );

      const state2 = applyYjsToStateWithRepair(
        doc,
        state1 as KanbanState,
        wsId
      );
      expect(state2.comments?.byId["comment-1"]?.x).toBe(500);
      expect(state2.comments?.byId["comment-1"]?.y).toBe(600);
    });
  });

  describe("comment deletion syncs through Y.Doc", () => {
    it("removes comment when deleted from Y.Doc", () => {
      const wsId = nextWorkspaceId();
      const doc = createBaseDoc(wsId);
      doc
        .getMap(YJS_MAP_NAMES.COMMENTS)
        .set("comment-1", makeComment({ id: "comment-1" }, wsId));

      const localState = createStateWithWorkspace(wsId);
      const state1 = applyYjsToStateWithRepair(doc, localState, wsId);
      expect(state1.comments?.byId["comment-1"]).toBeDefined();

      doc.getMap(YJS_MAP_NAMES.COMMENTS).delete("comment-1");

      const state2 = applyYjsToStateWithRepair(
        doc,
        state1 as KanbanState,
        wsId
      );
      expect(state2.comments?.byId["comment-1"]).toBeUndefined();
      expect(state2.comments?.allIds).not.toContain("comment-1");
    });

    it("only deletes comment from current workspace", () => {
      const wsId = nextWorkspaceId();
      const doc = createBaseDoc(wsId);
      const otherWsId = "ws-other";

      doc
        .getMap(YJS_MAP_NAMES.COMMENTS)
        .set(
          "comment-current",
          makeComment({ id: "comment-current", workspaceId: wsId }, wsId)
        );

      const localState = createStateWithWorkspace(wsId);
      localState.comments.byId["comment-other"] = makeComment(
        {
          id: "comment-other",
          workspaceId: otherWsId,
        },
        otherWsId
      );
      localState.comments.allIds.push("comment-other");

      const result = applyYjsToStateWithRepair(doc, localState, wsId);

      expect(result.comments?.byId["comment-current"]).toBeDefined();
      expect(result.comments?.byId["comment-other"]).toBeDefined();
    });

    it("preserves remaining comments when one is deleted", () => {
      const wsId = nextWorkspaceId();
      const doc = createBaseDoc(wsId);
      doc
        .getMap(YJS_MAP_NAMES.COMMENTS)
        .set("keep-1", makeComment({ id: "keep-1", content: "Keep me" }, wsId));
      doc
        .getMap(YJS_MAP_NAMES.COMMENTS)
        .set(
          "delete-me",
          makeComment({ id: "delete-me", content: "Delete me" }, wsId)
        );

      const localState = createStateWithWorkspace(wsId);
      const state1 = applyYjsToStateWithRepair(doc, localState, wsId);
      expect(state1.comments?.allIds).toHaveLength(2);

      doc.getMap(YJS_MAP_NAMES.COMMENTS).delete("delete-me");

      const state2 = applyYjsToStateWithRepair(
        doc,
        state1 as KanbanState,
        wsId
      );
      expect(state2.comments?.byId["keep-1"]).toBeDefined();
      expect(state2.comments?.byId["delete-me"]).toBeUndefined();
      expect(state2.comments?.allIds).toContain("keep-1");
      expect(state2.comments?.allIds).not.toContain("delete-me");
    });
  });

  describe("bidirectional comment sync between two Y.Docs", () => {
    it("merges comments from two separate Y.Doc syncs", () => {
      const wsId = nextWorkspaceId();
      const doc = createBaseDoc(wsId);

      doc
        .getMap(YJS_MAP_NAMES.COMMENTS)
        .set(
          "comment-a",
          makeComment(
            { id: "comment-a", content: "From Alice", authorId: "user-a" },
            wsId
          )
        );

      const localState = createStateWithWorkspace(wsId);
      const stateAfterA = applyYjsToStateWithRepair(doc, localState, wsId);
      expect(stateAfterA.comments?.allIds).toHaveLength(1);

      doc
        .getMap(YJS_MAP_NAMES.COMMENTS)
        .set(
          "comment-b",
          makeComment(
            { id: "comment-b", content: "From Bob", authorId: "user-b" },
            wsId
          )
        );

      const stateAfterBoth = applyYjsToStateWithRepair(
        doc,
        stateAfterA as KanbanState,
        wsId
      );
      expect(stateAfterBoth.comments?.allIds).toHaveLength(2);
      expect(stateAfterBoth.comments?.byId["comment-a"]?.content).toBe(
        "From Alice"
      );
      expect(stateAfterBoth.comments?.byId["comment-b"]?.content).toBe(
        "From Bob"
      );
    });
  });
});
