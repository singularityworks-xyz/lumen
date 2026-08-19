import { describe, expect, it } from "bun:test";
import {
  isValidTiptapDocumentJson,
  textToTiptapDocument,
  textToTiptapJson,
  titleCase,
} from "./text-to-tiptap";

describe("textToTiptapDocument", () => {
  it("turns plain lines into paragraphs", () => {
    const doc = textToTiptapDocument("hello\nworld");
    expect(doc.type).toBe("doc");
    expect(doc.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "hello" }] },
      { type: "paragraph", content: [{ type: "text", text: "world" }] },
    ]);
  });

  it("turns '- [ ] x' / '- [x] y' into task items", () => {
    const doc = textToTiptapDocument("- [ ] todo item\n- [x] done item");
    expect(doc.content).toEqual([
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "todo item" }],
              },
            ],
          },
          {
            type: "taskItem",
            attrs: { checked: true },
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "done item" }],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("groups consecutive bullets into a bulletList", () => {
    const doc = textToTiptapDocument("- a\n- b");
    expect(doc.content).toEqual([
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "a" }] },
            ],
          },
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "b" }] },
            ],
          },
        ],
      },
    ]);
  });

  it("turns markdown headings into heading nodes", () => {
    const doc = textToTiptapDocument("# Title\n## Sub\n### Subsub");
    expect(doc.content?.map((n) => n.type)).toEqual([
      "heading",
      "heading",
      "heading",
    ]);
    expect(
      (doc.content?.[0] as { attrs?: { level?: number } }).attrs?.level
    ).toBe(1);
    expect(
      (doc.content?.[1] as { attrs?: { level?: number } }).attrs?.level
    ).toBe(2);
  });

  it("separates task list and paragraphs on blank lines", () => {
    const doc = textToTiptapDocument("- [ ] a\n\nsome note\n- [x] b");
    expect(doc.content?.map((n) => n.type)).toEqual([
      "taskList",
      "paragraph",
      "taskList",
    ]);
  });
});

describe("textToTiptapJson / isValidTiptapDocumentJson", () => {
  it("serializes to valid TipTap JSON", () => {
    const json = textToTiptapJson("- [ ] one\n- two");
    expect(isValidTiptapDocumentJson(json)).toBe(true);
    const parsed = JSON.parse(json) as { content?: unknown };
    expect(Array.isArray(parsed.content)).toBe(true);
  });

  it("rejects non-document JSON", () => {
    expect(isValidTiptapDocumentJson("[1,2,3]")).toBe(false);
    expect(isValidTiptapDocumentJson('{"foo":"bar"}')).toBe(false);
    expect(isValidTiptapDocumentJson("not json")).toBe(false);
  });
});

describe("titleCase", () => {
  it("title-cases simple strings", () => {
    expect(titleCase("text board")).toBe("Text Board");
    expect(titleCase("launch-todos")).toBe("Launch Todos");
  });
});
