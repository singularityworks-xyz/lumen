import { describe, expect, it } from "bun:test";
import {
  generateAreaId,
  generateBoardId,
  generateChecklistId,
  generateColumnId,
  generateConnectionId,
  generateDialogId,
  generateId,
  generateTaskId,
  generateWorkspaceId,
} from "./ids";

describe("ids", () => {
  it("generates workspace IDs with ws_ prefix", () => {
    const id = generateWorkspaceId();
    expect(id.startsWith("ws_")).toBe(true);
    expect(id.length).toBeGreaterThan(3);
  });

  it("generates board IDs with board_ prefix", () => {
    const id = generateBoardId();
    expect(id.startsWith("board_")).toBe(true);
    expect(id.length).toBeGreaterThan(6);
  });

  it("generates column IDs with col_ prefix", () => {
    const id = generateColumnId();
    expect(id.startsWith("col_")).toBe(true);
    expect(id.length).toBeGreaterThan(4);
  });

  it("generates task IDs with task_ prefix", () => {
    const id = generateTaskId();
    expect(id.startsWith("task_")).toBe(true);
    expect(id.length).toBeGreaterThan(5);
  });

  it("generates checklist IDs with checklist_ prefix", () => {
    const id = generateChecklistId();
    expect(id.startsWith("checklist_")).toBe(true);
    expect(id.length).toBeGreaterThan(10);
  });

  it("generates connection IDs with conn_ prefix", () => {
    const id = generateConnectionId();
    expect(id.startsWith("conn_")).toBe(true);
    expect(id.length).toBeGreaterThan(5);
  });

  it("generates area IDs with area_ prefix", () => {
    const id = generateAreaId();
    expect(id.startsWith("area_")).toBe(true);
    expect(id.length).toBeGreaterThan(5);
  });

  it("generates dialog IDs with dlg_ prefix", () => {
    const id = generateDialogId();
    expect(id.startsWith("dlg_")).toBe(true);
    expect(id.length).toBeGreaterThan(4);
  });

  it("generates unprefixed IDs", () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(0);
    expect(id.startsWith("ws_")).toBe(false);
    expect(id.startsWith("board_")).toBe(false);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTaskId()));
    expect(ids.size).toBe(100);
  });
});
