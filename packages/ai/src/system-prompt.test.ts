import { describe, expect, it } from "bun:test";
import {
  buildSystemPrompt,
  getMinimalPrompt,
  type SystemPromptContext,
} from "./system-prompt";

describe("buildSystemPrompt", () => {
  it("includes core identity, personality, capabilities, response format, and guardrails", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Larity");
    expect(prompt).toContain("Singularity Works");
    expect(prompt).toContain("Personality & Communication Style");
    expect(prompt).toContain("Capabilities");
    expect(prompt).toContain("Response Format");
    expect(prompt).toContain("Guardrails");
  });

  it("omits session context section when no context provided", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain("Current Session Context");
    expect(prompt).not.toContain("**User**:");
    expect(prompt).not.toContain("**Workspace**:");
  });

  it("includes user name when provided", () => {
    const prompt = buildSystemPrompt({ userName: "Alice" });
    expect(prompt).toContain("- **User**: Alice");
  });

  it("includes workspace name and marks local workspace", () => {
    const prompt = buildSystemPrompt({
      workspaceName: "My Project",
      isShared: false,
    });
    expect(prompt).toContain('- **Workspace**: "My Project"');
    expect(prompt).toContain("Local workspace");
    expect(prompt).toContain("ephemeral");
  });

  it("includes workspace name and marks shared workspace with members", () => {
    const prompt = buildSystemPrompt({
      workspaceName: "Team Board",
      isShared: true,
      totalMembers: 5,
    });
    expect(prompt).toContain('- **Workspace**: "Team Board"');
    expect(prompt).toContain("Shared workspace");
    expect(prompt).toContain("5 members");
    expect(prompt).toContain("sync to all members");
  });

  it("omits member count text when shared workspace has 1 or fewer members", () => {
    const prompt = buildSystemPrompt({
      workspaceName: "Team Board",
      isShared: true,
      totalMembers: 1,
    });
    expect(prompt).not.toContain("with 1 members");
    expect(prompt).not.toContain("with 1 member");
  });

  it("includes collaborators list only when shared and collaborators exist", () => {
    const withCollabs = buildSystemPrompt({
      isShared: true,
      collaborators: [{ name: "Bob", role: "admin" }, { name: "Carol" }],
    });
    expect(withCollabs).toContain("- **Other members**:");
    expect(withCollabs).toContain("  - Bob [admin]");
    expect(withCollabs).toContain("  - Carol");

    const noCollabs = buildSystemPrompt({
      isShared: true,
      collaborators: [],
    });
    expect(noCollabs).not.toContain("Other members");

    const localWithCollabs = buildSystemPrompt({
      isShared: false,
      collaborators: [{ name: "Bob" }],
    });
    expect(localWithCollabs).not.toContain("Other members");
  });

  it("includes current board name when provided", () => {
    const prompt = buildSystemPrompt({
      currentBoardName: "Sprint 5",
    });
    expect(prompt).toContain("- **Current Board**: Sprint 5");
  });

  it("includes selected task count when greater than zero", () => {
    const prompt = buildSystemPrompt({ selectedTaskCount: 3 });
    expect(prompt).toContain("- **Selected Tasks**: 3");

    const zeroPrompt = buildSystemPrompt({ selectedTaskCount: 0 });
    expect(zeroPrompt).not.toContain("Selected Tasks");
  });

  it("full context includes all sections in order", () => {
    const context: SystemPromptContext = {
      userName: "Dave",
      workspaceName: "Alpha",
      isShared: true,
      totalMembers: 3,
      collaborators: [{ name: "Eve", role: "viewer" }],
      currentBoardName: "Board 1",
      selectedTaskCount: 2,
    };
    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain("Current Session Context");
    expect(prompt).toContain("- **User**: Dave");
    expect(prompt).toContain('- **Workspace**: "Alpha"');
    expect(prompt).toContain("Shared workspace");
    expect(prompt).toContain("3 members");
    expect(prompt).toContain("  - Eve [viewer]");
    expect(prompt).toContain("- **Current Board**: Board 1");
    expect(prompt).toContain("- **Selected Tasks**: 2");
  });

  it("static sections appear before dynamic context", () => {
    const prompt = buildSystemPrompt({ userName: "Test" });
    const coreIdx = prompt.indexOf("Core Identity");
    const sessionIdx = prompt.indexOf("Current Session Context");
    expect(coreIdx).toBeLessThan(sessionIdx);
  });
});

describe("getMinimalPrompt", () => {
  it("returns a stable minimal prompt", () => {
    const prompt = getMinimalPrompt();
    expect(prompt).toContain("Larity");
    expect(prompt).toContain("Lumen");
    expect(prompt).toContain("Singularity Works");
    expect(prompt).toContain("concise");
    expect(prompt).toContain("Decline off-topic");
  });

  it("does not change between calls", () => {
    const a = getMinimalPrompt();
    const b = getMinimalPrompt();
    expect(a).toBe(b);
  });
});
