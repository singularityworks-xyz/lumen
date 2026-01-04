"use client";

import { Reply, Send, Tag } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { useCollaboration } from "@/src/features/collab";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { ChatMessage } from "@/src/features/kanban/types";
import { cn } from "@/src/lib/utils";

const ALPHANUMERIC_REGEX = /^[a-zA-Z0-9]*$/;

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  if (diffDay === 1) {
    return "yesterday";
  }
  if (diffDay < 7) {
    return `${diffDay}d ago`;
  }
  return date.toLocaleDateString();
}

type ChatBubbleProps = {
  message: ChatMessage;
  isOwn: boolean;
  index: number;
};

const ChatBubble = memo(({ message, isOwn, index }: ChatBubbleProps) => {
  const { collaborators } = useCollaboration();

  const onlineAuthor = collaborators.find((c) => c.id === message.authorId);
  const authorName = onlineAuthor?.name ?? message.authorName ?? "Unknown";
  const authorImage = onlineAuthor?.image ?? message.authorImage;
  const authorColor = isOwn ? undefined : (onlineAuthor?.color ?? "#6e6e6e");
  const fallback = authorName.slice(0, 2).toUpperCase();

  return (
    <motion.div
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className={cn(
        "flex max-w-[85%] gap-2.5",
        isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
      exit={{ opacity: 0, x: isOwn ? 20 : -20, scale: 0.95 }}
      initial={{ opacity: 0, x: isOwn ? 20 : -20, scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
        delay: index * 0.03,
      }}
    >
      <Avatar
        className={cn(
          "h-7 w-7 shrink-0 border-2 shadow-sm",
          isOwn ? "border-primary/30" : "border-border"
        )}
        style={!isOwn && authorColor ? { borderColor: authorColor } : undefined}
      >
        <AvatarImage src={authorImage ?? undefined} />
        <AvatarFallback
          className="font-medium text-[10px]"
          style={
            !isOwn && authorColor
              ? { backgroundColor: `${authorColor}20`, color: authorColor }
              : undefined
          }
        >
          {fallback}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "flex flex-col gap-0.5",
          isOwn ? "items-end" : "items-start"
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "max-w-20 truncate font-medium text-[10px]",
              isOwn ? "text-primary" : "text-muted-foreground"
            )}
            title={isOwn ? undefined : authorName}
          >
            {isOwn ? "You" : authorName}
          </span>
          <span className="text-[9px] text-muted-foreground/60">
            {formatRelativeTime(message.createdAt)}
          </span>
          {message.isEdited && (
            <span className="text-[8px] text-muted-foreground/40 italic">
              edited
            </span>
          )}
        </div>

        {message.replyToId && message.replyToContent && (
          <div
            className={cn(
              "mb-0.5 flex items-center gap-1 rounded px-2 py-0.5",
              "bg-muted/50 text-muted-foreground/70",
              "text-[9px]"
            )}
          >
            <Reply className="h-2 w-2" />
            <span className="max-w-32 truncate font-medium">
              {message.replyToAuthorName}:
            </span>
            <span className="max-w-40 truncate">{message.replyToContent}</span>
          </div>
        )}

        <div
          className={cn(
            "relative rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
            "shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(255,255,255,0.1)]",
            "dark:shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(255,255,255,0.05)]",
            isOwn
              ? "rounded-br-md bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.15)]"
              : "rounded-bl-md bg-muted/80 text-foreground"
          )}
          style={
            !isOwn && authorColor
              ? {
                  background: `linear-gradient(135deg, ${authorColor}08, ${authorColor}03)`,
                  borderLeft: `2px solid ${authorColor}40`,
                }
              : undefined
          }
        >
          <p className="wrap-break-word whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    </motion.div>
  );
});

ChatBubble.displayName = "ChatBubble";

type DiscussionTabProps = {
  workspaceId: string;
};

export const DiscussionTab = memo(({ workspaceId }: DiscussionTabProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [messageContent, setMessageContent] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const { localUser, collaborators, updateIsTyping } = useCollaboration();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sendChatMessage = useKanbanStore((state) => state.sendChatMessage);
  const chatMessages = useKanbanStore((state) => state.chatMessages);

  const messages = useMemo(
    () =>
      chatMessages.allIds
        .map((id) => chatMessages.byId[id])
        .filter((m): m is ChatMessage => !!m && m.workspaceId === workspaceId)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [chatMessages, workspaceId]
  );

  // Auto-scroll to bottom when new messages arrive
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollRef only needs to be set once
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const filteredCollaborators = useMemo(() => {
    const allUsers = [
      ...(localUser ? [localUser] : []),
      ...collaborators,
    ].filter((u) => u.id !== localUser?.id);

    if (!mentionSearch) {
      return allUsers.slice(0, 5);
    }
    return allUsers
      .filter((u) => u.name.toLowerCase().includes(mentionSearch.toLowerCase()))
      .slice(0, 5);
  }, [collaborators, localUser, mentionSearch]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setMessageContent(value);

      const lastAtIndex = value.lastIndexOf("@");
      if (lastAtIndex !== -1) {
        const textAfterAt = value.slice(lastAtIndex + 1);
        if (ALPHANUMERIC_REGEX.test(textAfterAt)) {
          setShowMentionDropdown(true);
          setMentionSearch(textAfterAt);
          return;
        }
      }
      setShowMentionDropdown(false);
      setMentionSearch("");

      if (localUser) {
        updateIsTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          updateIsTyping(false);
        }, 2000);
      }
    },
    [localUser, updateIsTyping]
  );

  const handleMentionSelect = useCallback(
    (user: { id: string; name: string }) => {
      const lastAtIndex = messageContent.lastIndexOf("@");
      if (lastAtIndex === -1) {
        return;
      }

      const newContent = `${messageContent.slice(0, lastAtIndex)}@${user.name} `;
      setMessageContent(newContent);
      setShowMentionDropdown(false);
      setMentionSearch("");
      inputRef.current?.focus();
    },
    [messageContent]
  );

  const handleSend = useCallback(() => {
    if (!(messageContent.trim() && localUser)) {
      return;
    }

    sendChatMessage(
      messageContent.trim(),
      {
        id: localUser.id,
        name: localUser.name,
        image: localUser.image ?? undefined,
      },
      replyTo
        ? {
            replyToId: replyTo.id,
            replyToContent: replyTo.content.slice(0, 100),
            replyToAuthorName: replyTo.authorName,
          }
        : undefined
    );

    setMessageContent("");
    setReplyTo(null);

    updateIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [messageContent, localUser, sendChatMessage, replyTo, updateIsTyping]);

  useEffect(
    () => () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      updateIsTyping(false);
    },
    [updateIsTyping]
  );

  const typingUsers = useMemo(
    () =>
      collaborators.filter(
        (c) => c.isTyping && c.id !== localUser?.id && c.id !== "local"
      ),
    [collaborators, localUser]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        setShowMentionDropdown(false);
        setReplyTo(null);
      }
    },
    [handleSend]
  );

  const getTypingText = () => {
    if (typingUsers.length === 0) {
      return null;
    }
    if (typingUsers.length === 1 && typingUsers[0]) {
      return `${typingUsers[0].name} is typing...`;
    }
    if (typingUsers.length === 2 && typingUsers[0] && typingUsers[1]) {
      return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
    }
    return `${typingUsers.length} people are typing...`;
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden",
          "space-y-3 px-4 py-4",
          "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
        )}
        ref={scrollRef}
      >
        {messages.length === 0 ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex h-full flex-col items-center justify-center py-12 text-center"
            initial={{ opacity: 0, y: 10 }}
          >
            <div
              className={cn(
                "mb-4 h-16 w-16 rounded-2xl",
                "flex items-center justify-center",
                "bg-muted/50",
                "shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_-1px_2px_rgba(255,255,255,0.05)]",
                "dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_-1px_2px_rgba(255,255,255,0.03)]"
              )}
            >
              <Tag className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="font-medium text-muted-foreground text-sm">
              Start the conversation
            </p>
            <p className="mt-1 text-muted-foreground/60 text-xs">
              Chat with your team in real-time
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((message, index) => (
              <ChatBubble
                index={index}
                isOwn={message.authorId === localUser?.id}
                key={message.id}
                message={message}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      <div
        className={cn(
          "pointer-events-none relative z-10 -mt-6 h-6",
          "bg-linear-to-t from-card to-transparent"
        )}
      />

      {replyTo && (
        <div
          className={cn(
            "mx-3 flex items-center justify-between rounded-t-lg border border-border/50 border-b-0 bg-muted/30 px-3 py-1.5",
            "text-[11px] text-muted-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Reply className="h-3 w-3" />
            <span className="font-medium">
              Replying to {replyTo.authorName}
            </span>
            <span className="max-w-40 truncate opacity-70">
              {replyTo.content}
            </span>
          </div>
          <button
            className="ml-2 text-muted-foreground/50 hover:text-muted-foreground"
            onClick={() => setReplyTo(null)}
            type="button"
          >
            ×
          </button>
        </div>
      )}

      <div
        className={cn(
          "relative border-border/50 border-t px-3 py-3",
          "bg-linear-to-t from-muted/30 to-transparent"
        )}
      >
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-full left-4 mb-2 flex items-center gap-2"
              exit={{ opacity: 0, y: 10 }}
              initial={{ opacity: 0, y: 10 }}
            >
              <div className="flex -space-x-1">
                {typingUsers.slice(0, 3).map((user) => (
                  <Avatar
                    className="h-4 w-4 border-2 border-background"
                    key={user.id}
                  >
                    <AvatarImage src={user.image ?? undefined} />
                    <AvatarFallback className="text-[6px]">
                      {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="animate-pulse text-[10px] text-muted-foreground">
                {getTypingText()}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showMentionDropdown && filteredCollaborators.length > 0 && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "absolute right-3 bottom-full left-3 mb-1",
                "rounded-lg border border-border/50 bg-card/95 backdrop-blur-sm",
                "shadow-lg"
              )}
              exit={{ opacity: 0, y: 8 }}
              initial={{ opacity: 0, y: 8 }}
            >
              <div className="p-1">
                {filteredCollaborators.map((user) => (
                  <button
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5",
                      "text-foreground text-sm",
                      "transition-colors hover:bg-muted/80"
                    )}
                    key={user.id}
                    onClick={() => handleMentionSelect(user)}
                    type="button"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={user.image ?? undefined} />
                      <AvatarFallback className="text-[8px]">
                        {user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{user.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2">
          <textarea
            className={cn(
              "max-h-24 min-h-10 flex-1 resize-none rounded-xl border border-border/30 bg-background/80 px-4 py-2.5",
              "text-sm placeholder:text-muted-foreground/50",
              "shadow-[inset_0_2px_4px_rgba(0,0,0,0.05),inset_0_-1px_2px_rgba(255,255,255,0.05)]",
              "dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.03)]",
              "focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/20",
              "transition-shadow"
            )}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            ref={inputRef}
            rows={1}
            value={messageContent}
          />
          <button
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
              "shadow-[0_2px_8px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]",
              messageContent.trim()
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted/50 text-muted-foreground/30"
            )}
            disabled={!messageContent.trim()}
            onClick={handleSend}
            type="button"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

DiscussionTab.displayName = "DiscussionTab";
