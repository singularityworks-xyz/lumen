import { createLogger } from "@lumen/logger";
import { getSupermemoryClient, isMemoryEnabled } from "./supermemory-client";

const logger = createLogger({ name: "ai:memory" });

// Container tag conventions (see https://supermemory.ai/docs/concepts/container-tags):
// - user_{userId}      : personal memory across all workspaces
// - workspace_{id}     : shared context for a workspace
// - conv_{id} (customId): one document per conversation, updated over time
export const USER_CONTAINER_PREFIX = "user";
export const WORKSPACE_CONTAINER_PREFIX = "workspace";
export const CONVERSATION_CUSTOM_ID_PREFIX = "conv";

const RECALL_TIMEOUT_MS = 2000;
const SEARCH_LIMIT = 8;
const MAX_PROFILE_LINES = 6;
const MAX_MEMORY_RESULTS = 6;
const MAX_RELATED_MEMORIES = 4;
const MAX_CONTEXT_CHARS = 2200;
const MAX_TURN_MESSAGE_CHARS = 4000;
const MAX_TURN_TOOL_ARGS_CHARS = 1000;

export function userContainerTag(userId: string): string {
  return `${USER_CONTAINER_PREFIX}_${userId}`;
}

export function workspaceContainerTag(workspaceId: string): string {
  return `${WORKSPACE_CONTAINER_PREFIX}_${workspaceId}`;
}

export function conversationCustomId(conversationId: string): string {
  return `${CONVERSATION_CUSTOM_ID_PREFIX}_${conversationId}`;
}

interface ProfileResult {
  profile?: { static: string[]; dynamic: string[] };
}

interface SearchResultEntry {
  context?: {
    related?: Array<{ memory: string; relation: string }>;
  };
  memory?: string;
}

interface SearchResults {
  results: SearchResultEntry[];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function trimList(lines: string[], maxLines: number): string[] {
  const trimmed = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    trimmed.push(`… and ${lines.length - maxLines} more`);
  }
  return trimmed;
}

function dedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(line);
  }
  return result;
}

function formatProfile(profile: ProfileResult["profile"]): string[] {
  if (!profile) {
    return [];
  }
  const lines: string[] = [];
  for (const fact of profile.static ?? []) {
    if (fact) {
      lines.push(`- ${fact}`);
    }
  }
  for (const fact of profile.dynamic ?? []) {
    if (fact) {
      lines.push(`- ${fact}`);
    }
  }
  return lines;
}

function formatSearchResults(search: SearchResults): string[] {
  const lines: string[] = [];
  for (const entry of search.results ?? []) {
    if (entry.memory) {
      lines.push(`- ${entry.memory}`);
    }
    for (const related of (entry.context?.related ?? []).slice(
      0,
      MAX_RELATED_MEMORIES
    )) {
      if (related.memory) {
        lines.push(`- ${related.memory}`);
      }
    }
  }
  return lines;
}

export interface RecallMemoryInput {
  query: string;
  userId: string;
  // Omit for ephemeral/local workspaces (no server-side workspace identity)
  workspaceId?: string;
}

export interface MemoryContextBlock {
  isEmpty: boolean;
  text: string;
}

// Recalls long-term memory for a user (and optionally a workspace) and renders
// it as a compact markdown block for the system prompt. Fails soft: any
// Supermemory error or timeout yields an empty block so chat never breaks.
export async function recallMemory(
  input: RecallMemoryInput
): Promise<MemoryContextBlock> {
  if (!isMemoryEnabled()) {
    return { text: "", isEmpty: true };
  }

  const client = getSupermemoryClient();
  if (!client) {
    return { text: "", isEmpty: true };
  }

  const containers: Array<{ tag: string; kind: "user" | "workspace" }> = [
    { tag: userContainerTag(input.userId), kind: "user" },
  ];
  if (input.workspaceId) {
    containers.push({
      tag: workspaceContainerTag(input.workspaceId),
      kind: "workspace",
    });
  }

  let userProfileLines: string[] = [];
  let userMemoryLines: string[] = [];
  let workspaceProfileLines: string[] = [];
  let workspaceMemoryLines: string[] = [];

  try {
    const settled = await Promise.allSettled(
      containers.map(async (container) => {
        const [profileSettled, searchSettled] = await Promise.allSettled([
          withTimeout(
            client.profile({ containerTag: container.tag, q: input.query }),
            RECALL_TIMEOUT_MS
          ),
          withTimeout(
            client.search({
              q: input.query,
              containerTag: container.tag,
              searchMode: "memories",
              limit: SEARCH_LIMIT,
            }),
            RECALL_TIMEOUT_MS
          ),
        ]);

        const profile =
          profileSettled.status === "fulfilled"
            ? (profileSettled.value as ProfileResult)
            : null;
        const search =
          searchSettled.status === "fulfilled"
            ? (searchSettled.value as SearchResults)
            : null;

        return {
          kind: container.kind,
          profileLines: formatProfile(profile?.profile),
          memoryLines: formatSearchResults(search ?? { results: [] }),
        };
      })
    );

    for (const result of settled) {
      if (result.status !== "fulfilled") {
        logger.debug("Memory recall failed for a container", {
          error:
            result.reason instanceof Error ? result.reason.message : "Unknown",
        });
        continue;
      }
      if (result.value.kind === "user") {
        userProfileLines = result.value.profileLines;
        userMemoryLines = result.value.memoryLines;
      } else {
        workspaceProfileLines = result.value.profileLines;
        workspaceMemoryLines = result.value.memoryLines;
      }
    }
  } catch (error) {
    logger.warn("Memory recall failed", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return { text: "", isEmpty: true };
  }

  const sections: string[] = [];

  const userLines = dedupe([
    ...trimList(userProfileLines, MAX_PROFILE_LINES),
    ...trimList(userMemoryLines, MAX_MEMORY_RESULTS),
  ]);
  if (userLines.length > 0) {
    sections.push(`### About this user\n${userLines.join("\n")}`);
  }

  const workspaceLines = dedupe([
    ...trimList(workspaceProfileLines, MAX_PROFILE_LINES),
    ...trimList(workspaceMemoryLines, MAX_MEMORY_RESULTS),
  ]);
  if (workspaceLines.length > 0) {
    sections.push(`### About this workspace\n${workspaceLines.join("\n")}`);
  }

  if (sections.length === 0) {
    return { text: "", isEmpty: true };
  }

  const header = `## Long-Term Memory Context
Things you recall about this user and workspace from past sessions. Use it to personalize and ground answers, but treat it as background — if it conflicts with the current session, prefer the session. Never mention these are memories.`;

  let text = `${header}\n\n${sections.join("\n\n")}`;
  if (text.length > MAX_CONTEXT_CHARS) {
    text = `${text.slice(0, MAX_CONTEXT_CHARS)}\n… (truncated)`;
  }

  return { text, isEmpty: false };
}

export interface RetainConversationTurnInput {
  assistantMessage: string;
  conversationId: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
  userId: string;
  userMessage: string;
  // Omit for ephemeral/local workspaces
  workspaceId?: string;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}\n… (truncated)`;
}

function buildTurnContent(input: RetainConversationTurnInput): string {
  const parts: string[] = [
    `user: ${truncate(input.userMessage, MAX_TURN_MESSAGE_CHARS)}`,
    `assistant: ${truncate(input.assistantMessage, MAX_TURN_MESSAGE_CHARS)}`,
  ];

  if (input.toolCalls && input.toolCalls.length > 0) {
    const summary = input.toolCalls
      .map((call) => {
        const args = truncate(
          JSON.stringify(call.arguments ?? {}),
          MAX_TURN_TOOL_ARGS_CHARS
        );
        return `${call.name}(${args})`;
      })
      .join("; ");
    parts.push(`tool_calls: ${summary}`);
  }

  return parts.join("\n");
}

// Retains a conversation turn into long-term memory. The turn is added as a
// conversation document (one per conversation, upserted by customId) under the
// user's container, and mirrored under the workspace container so collaborators
// share workspace context. Never throws — failures are logged and swallowed.
export async function retainConversationTurn(
  input: RetainConversationTurnInput
): Promise<void> {
  if (!isMemoryEnabled()) {
    return;
  }

  const client = getSupermemoryClient();
  if (!client) {
    return;
  }

  const content = buildTurnContent(input);
  const customId = conversationCustomId(input.conversationId);
  const metadata = {
    type: "conversation",
    workspaceId: input.workspaceId ?? "",
  };

  const containers = [userContainerTag(input.userId)];
  if (input.workspaceId) {
    containers.push(workspaceContainerTag(input.workspaceId));
  }

  for (const containerTag of containers) {
    try {
      await withTimeout(
        client.add({
          content,
          containerTag,
          customId,
          metadata,
          taskType: "memory",
        }),
        RECALL_TIMEOUT_MS
      );
      logger.debug("Conversation turn retained", {
        containerTag,
        customId,
      });
    } catch (error) {
      logger.warn("Failed to retain conversation turn", {
        containerTag,
        customId,
        error: error instanceof Error ? error.message : "Unknown",
      });
    }
  }
}
