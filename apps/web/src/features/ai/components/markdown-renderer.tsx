"use client";

import { memo, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/src/lib/utils";

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

// Regex patterns for tool call JSON artifacts that the model might output as text
const TOOL_CALL_PATTERN =
  /^\s*\{"tool"\s*:\s*"[^"]+"\s*,\s*"params"\s*:\s*\{[^}]*\}\}/;
const ALT_TOOL_PATTERN =
  /^\s*\{"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[^}]*\}\}/;

// Strips tool call JSON artifacts that the model might output as text.
// These patterns occur when the model echoes tool call intentions as text
// instead of making proper tool calls.
function sanitizeContent(content: string): string {
  let sanitized = content;
  sanitized = sanitized.replace(TOOL_CALL_PATTERN, "").trim();
  sanitized = sanitized.replace(ALT_TOOL_PATTERN, "").trim();
  return sanitized;
}

export const MarkdownRenderer = memo(
  ({ content, className }: MarkdownRendererProps) => {
    const sanitizedContent = useMemo(() => sanitizeContent(content), [content]);

    return (
      <div
        className={cn("prose-sm prose-neutral dark:prose-invert", className)}
      >
        <Markdown
          components={{
            h1: ({ children }) => (
              <h1 className="mt-3 mb-2 font-semibold text-base first:mt-0">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-2.5 mb-1.5 font-semibold text-sm first:mt-0">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-2 mb-1 font-medium text-sm first:mt-0">
                {children}
              </h3>
            ),

            p: ({ children }) => (
              <p className="mb-2 leading-relaxed last:mb-0">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="leading-relaxed">{children}</li>
            ),

            code: ({ children, className: codeClassName }) => {
              const isCodeBlock = codeClassName?.includes("language-");
              if (isCodeBlock) {
                return (
                  <code
                    className={cn(
                      "block overflow-x-auto rounded-lg bg-muted/60 p-3 font-mono text-xs",
                      "border border-border/40"
                    )}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-xs">
                  {children}
                </code>
              );
            },

            pre: ({ children }) => (
              <pre className="mb-2 overflow-hidden rounded-lg last:mb-0">
                {children}
              </pre>
            ),

            strong: ({ children }) => (
              <strong className="font-semibold">{children}</strong>
            ),
            em: ({ children }) => <em className="italic">{children}</em>,

            a: ({ children, href }) => (
              <a
                className="text-primary underline underline-offset-2 hover:text-primary/80"
                href={href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {children}
              </a>
            ),

            blockquote: ({ children }) => (
              <blockquote className="mb-2 border-border/60 border-l-2 pl-3 text-muted-foreground italic last:mb-0">
                {children}
              </blockquote>
            ),

            hr: () => <hr className="my-3 border-border/40" />,

            table: ({ children }) => (
              <div className="mb-2 overflow-x-auto last:mb-0">
                <table className="min-w-full border-collapse text-xs">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-muted/40">{children}</thead>
            ),
            tbody: ({ children }) => <tbody>{children}</tbody>,
            tr: ({ children }) => (
              <tr className="border-border/40 border-b">{children}</tr>
            ),
            th: ({ children }) => (
              <th className="px-2 py-1.5 text-left font-medium">{children}</th>
            ),
            td: ({ children }) => <td className="px-2 py-1.5">{children}</td>,
          }}
          remarkPlugins={[remarkGfm]}
        >
          {sanitizedContent}
        </Markdown>
      </div>
    );
  }
);

MarkdownRenderer.displayName = "MarkdownRenderer";
