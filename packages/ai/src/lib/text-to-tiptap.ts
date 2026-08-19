// Converts plain text / light markdown into a TipTap JSON document.
// Used by AI executors when creating or updating text boards, since the
// model produces plain text while boards store serialized TipTap JSON.

interface TipTapNode {
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  type: string;
}

// "text board" -> "Text Board"
export function titleCase(value: string): string {
  return value
    .trim()
    .split(WORD_SEPARATOR_PATTERN)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const TASK_ITEM_PATTERN = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
const BULLET_PATTERN = /^\s*[-*]\s+(.*)$/;
const HEADING_PATTERN = /^\s*(#{1,3})\s+(.*)$/;
const LINE_BREAK_PATTERN = /\r?\n/;
const WORD_SEPARATOR_PATTERN = /[\s_-]+/;

function paragraph(text: string): TipTapNode {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

function taskItem(checked: boolean, text: string): TipTapNode {
  return {
    type: "taskItem",
    attrs: { checked },
    content: [paragraph(text)],
  };
}

function bulletItem(text: string): TipTapNode {
  return {
    type: "listItem",
    content: [paragraph(text)],
  };
}

export function textToTiptapDocument(text: string): TipTapNode {
  const lines = text.split(LINE_BREAK_PATTERN);
  const content: TipTapNode[] = [];
  let openTaskList: TipTapNode | null = null;
  let openBulletList: TipTapNode | null = null;

  const closeLists = () => {
    if (openTaskList) {
      content.push(openTaskList);
      openTaskList = null;
    }
    if (openBulletList) {
      content.push(openBulletList);
      openBulletList = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      closeLists();
      continue;
    }

    const taskMatch = TASK_ITEM_PATTERN.exec(line);
    if (taskMatch) {
      if (!openTaskList) {
        closeLists();
        openTaskList = { type: "taskList", content: [] };
      }
      openTaskList.content?.push(
        taskItem(
          taskMatch[1]?.toLowerCase() === "x",
          (taskMatch[2] ?? "").trim()
        )
      );
      continue;
    }

    const headingMatch = HEADING_PATTERN.exec(line);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1]?.length ?? 1;
      content.push({
        type: "heading",
        attrs: { level },
        content: [{ type: "text", text: (headingMatch[2] ?? "").trim() }],
      });
      continue;
    }

    const bulletMatch = BULLET_PATTERN.exec(line);
    if (bulletMatch) {
      if (!openBulletList) {
        closeLists();
        openBulletList = { type: "bulletList", content: [] };
      }
      openBulletList.content?.push(bulletItem((bulletMatch[1] ?? "").trim()));
      continue;
    }

    closeLists();
    content.push(paragraph(line));
  }

  closeLists();

  return { type: "doc", content };
}

export function textToTiptapJson(text: string): string {
  return JSON.stringify(textToTiptapDocument(text));
}

export function isValidTiptapDocumentJson(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as unknown;
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      (parsed as { type?: unknown }).type === "doc"
    );
  } catch {
    return false;
  }
}
