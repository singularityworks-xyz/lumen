"use client";

import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { memo, useEffect, useRef } from "react";
import { useKanbanStore } from "../store/kanban-store";
import styles from "./styles/text-board-editor.module.css";

// Registry of live editors so the board header can append a task item.
// Map<textBoardId, Editor> — kept module-level to avoid prop drilling.
const editorRegistry = new Map<string, Editor>();

export function getTextBoardEditor(textBoardId: string): Editor | undefined {
  return editorRegistry.get(textBoardId);
}

// Append a new todo item to the end of the document and focus it.
export function addTextBoardTask(textBoardId: string): void {
  const editor = editorRegistry.get(textBoardId);
  if (!editor) {
    return;
  }
  const taskItem = {
    type: "taskItem",
    attrs: { checked: false },
    content: [{ type: "paragraph", content: [] }],
  };
  const endPos = editor.state.doc.content.size;
  editor.chain().focus().insertContentAt(endPos, taskItem).run();
}

const SAVE_DEBOUNCE_MS = 300;

function parseContent(content: string | undefined): string | object {
  if (!content) {
    return "";
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "type" in parsed
    ) {
      return parsed as object;
    }
  } catch {
    // Fall through to plain text
  }
  return content;
}

interface TextBoardEditorProps {
  textBoardId: string;
}

// TipTap editor for text boards. Content is stored as a serialized TipTap
// JSON string inside the textBoard entity, which the Yjs sync layer keeps in
// sync across collaborators (realtime streaming through the same map pipeline
// as every other entity).
export const TextBoardEditor = memo<TextBoardEditorProps>(({ textBoardId }) => {
  const content = useKanbanStore(
    (s) => s.textBoards.byId[textBoardId]?.content
  );
  const updateTextBoard = useKanbanStore((s) => s.updateTextBoard);

  // JSON last written by this editor (either local saves or applied remotes)
  const lastEmittedRef = useRef<string>(content ?? "");
  // Debounce timer for local saves
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to read the latest content inside the debounce callback
  const latestDraftRef = useRef<string>(content ?? "");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          languageClassPrefix: "language-",
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: "Write tasks or notes…",
      }),
    ],
    content: parseContent(content),
    editorProps: {
      attributes: {
        class: "focus:outline-none",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const json = JSON.stringify(currentEditor.getJSON());
      latestDraftRef.current = json;

      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
      }
      pendingSaveRef.current = setTimeout(() => {
        const draft = latestDraftRef.current;
        lastEmittedRef.current = draft;
        updateTextBoard(textBoardId, { content: draft });
      }, SAVE_DEBOUNCE_MS);
    },
  });

  // Register the editor instance for header actions (add task)
  useEffect(() => {
    if (editor) {
      editorRegistry.set(textBoardId, editor);
    }
    return () => {
      editorRegistry.delete(textBoardId);
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
    };
  }, [editor, textBoardId]);

  // Apply remote (or rehydrated) content when it differs from what this
  // editor last emitted. Cancels pending local saves so a stale debounced
  // write never clobbers a collaborator's change.
  useEffect(() => {
    if (!editor) {
      return;
    }
    const remoteContent = content ?? "";
    if (remoteContent === lastEmittedRef.current) {
      return;
    }
    const currentJson = JSON.stringify(editor.getJSON());
    if (remoteContent === currentJson) {
      lastEmittedRef.current = remoteContent;
      return;
    }
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
    lastEmittedRef.current = remoteContent;
    latestDraftRef.current = remoteContent;
    editor.commands.setContent(parseContent(remoteContent), {
      emitUpdate: false,
    });
  }, [content, editor]);

  return (
    <div className={`nodrag ${styles.editor}`} data-testid="text-board-editor">
      <EditorContent editor={editor} />
    </div>
  );
});

TextBoardEditor.displayName = "TextBoardEditor";
