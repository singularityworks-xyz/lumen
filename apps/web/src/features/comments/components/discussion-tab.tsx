/** biome-ignore-all lint/complexity/noForEach: TODO: Change this someday */
"use client";

import { escapeRegExp } from "lodash-es";
import { Reply, Send, Tag, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import {
  type Collaborator,
  getColorForUser,
  useCollaboration,
} from "@/src/features/collab";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { ChatMessage } from "@/src/features/kanban/types";
import { formatRelativeTime } from "@/src/lib/date";
import { cn } from "@/src/lib/utils";

const MENTION_SEARCH_REGEX = /^[a-zA-Z0-9]*$/;

interface ChatBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  index: number;
  onReply: (message: ChatMessage) => void;
  onReplyClick: (replyId: string) => void;
  knownUserColors: Map<string, string>;
  onDelete: (messageId: string) => void;
  isHighlighted: boolean;
}

const ChatBubble = memo(
  ({
    message,
    isOwn,
    index,
    onReply,
    onReplyClick,
    knownUserColors,
    onDelete,
    isHighlighted,
  }: ChatBubbleProps) => {
    const { collaborators, localUser } = useCollaboration();
    const messageRef = useRef<HTMLDivElement>(null);
    const chatMessagesById = useKanbanStore((state) => state.chatMessages.byId);

    // Check if the replied-to message still exists
    const replyToMessageExists = message.replyToId
      ? !!chatMessagesById[message.replyToId]
      : false;

    // Scroll into view when highlighted
    useEffect(() => {
      if (isHighlighted && messageRef.current) {
        messageRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, [isHighlighted]);

    const contentElements = useMemo(() => {
      if (!knownUserColors || knownUserColors.size === 0) {
        return message.content;
      }

      const names = Array.from(knownUserColors.keys()).sort(
        (a, b) => b.length - a.length
      );
      const pattern = new RegExp(
        `@(${names.map((n) => escapeRegExp(n)).join("|")})`,
        "g"
      );

      const parts = message.content.split(pattern);

      return parts.map((part, i) => {
        const color = knownUserColors.get(part);
        if (color) {
          return (
            <span
              className="font-medium underline underline-offset-2"
              key={`${i}-${part}`}
              style={{ color, textDecorationColor: color }}
            >
              {part}
            </span>
          );
        }
        return part;
      });
    }, [message.content, knownUserColors]);

    const onlineAuthor = collaborators.find((c) => c.id === message.authorId);
    const authorName = onlineAuthor?.name ?? message.authorName ?? "Unknown";
    const authorImage = onlineAuthor?.image ?? message.authorImage;
    const authorColor = isOwn ? undefined : (onlineAuthor?.color ?? "#6e6e6e");
    const fallback = authorName.slice(0, 2).toUpperCase();

    return (
      <motion.div
        animate={{
          opacity: 1,
          x: 0,
          scale: isHighlighted ? 1.03 : 1,
        }}
        className={cn(
          "group flex max-w-[85%] gap-2.5",
          isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
        )}
        exit={{ opacity: 0, x: isOwn ? 20 : -20, scale: 0.95 }}
        id={`message-${message.id}`}
        initial={{ opacity: 0, x: isOwn ? 20 : -20, scale: 0.95 }}
        ref={messageRef}
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
          style={
            !isOwn && authorColor ? { borderColor: authorColor } : undefined
          }
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
            "relative flex flex-col gap-0.5",
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
            <button
              className={cn(
                "mb-0.5 flex max-w-full items-center gap-1 rounded px-2 py-0.5",
                "bg-muted/50 text-muted-foreground/70",
                "text-[9px] transition-colors",
                replyToMessageExists
                  ? "cursor-pointer hover:bg-muted/80 hover:text-foreground"
                  : "cursor-default",
                "text-left"
              )}
              onClick={
                replyToMessageExists
                  ? () => onReplyClick(message.replyToId as string)
                  : undefined
              }
              type="button"
            >
              <Reply className="h-2 w-2 shrink-0" />
              {replyToMessageExists ? (
                <>
                  <span className="max-w-20 shrink-0 truncate font-medium">
                    {message.replyToAuthorName === localUser?.name
                      ? "You"
                      : message.replyToAuthorName}
                    :
                  </span>
                  <span className="truncate">{message.replyToContent}</span>
                </>
              ) : (
                <span className="truncate text-muted-foreground/50 italic">
                  deleted message
                </span>
              )}
            </button>
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
              {contentElements}
            </p>
          </div>
          <div
            className={cn(
              "absolute right-0 -bottom-5 z-10",
              "flex items-center gap-1",
              "opacity-0 transition-all delay-500 duration-200 group-hover:opacity-100 group-hover:delay-0",
              "pointer-events-none group-hover:pointer-events-auto"
            )}
          >
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1",
                "border border-border/50 bg-background/95 shadow-sm backdrop-blur-sm",
                "font-medium text-[10px] text-muted-foreground",
                "hover:bg-accent hover:text-accent-foreground"
              )}
              onClick={() => onReply(message)}
              type="button"
            >
              <Reply className="h-3 w-3" />
              Reply
            </button>
            {isOwn && (
              <button
                aria-label="Delete message"
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1",
                  "border border-border/50 bg-background/95 shadow-sm backdrop-blur-sm",
                  "font-medium text-[10px] text-destructive",
                  "hover:border-destructive/20 hover:bg-destructive/10"
                )}
                onClick={() => onDelete(message.id)}
                type="button"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

ChatBubble.displayName = "ChatBubble";

interface DiscussionTabProps {
  workspaceId: string;
}

export const DiscussionTab = memo(({ workspaceId }: DiscussionTabProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [messageContent, setMessageContent] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const { localUser, collaborators, updateIsTyping } = useCollaboration();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sendChatMessage = useKanbanStore((state) => state.sendChatMessage);
  const deleteChatMessage = useKanbanStore((state) => state.deleteChatMessage);
  const chatMessages = useKanbanStore((state) => state.chatMessages);
  const comments = useKanbanStore((state) => state.comments);

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

  const allKnownCollaborators = useMemo(() => {
    const knownUsersMap = new Map<string, Collaborator>();

    if (localUser) {
      knownUsersMap.set(localUser.id, localUser);
    }

    // Add online collaborators
    for (const c of collaborators) {
      knownUsersMap.set(c.id, c);
    }

    // Add authors from messages
    for (const m of messages) {
      if (!knownUsersMap.has(m.authorId)) {
        knownUsersMap.set(m.authorId, {
          id: m.authorId,
          name: m.authorName || "Unknown",
          color: getColorForUser(m.authorId),
          role: "viewer",
          image: m.authorImage,
        });
      }
    }

    // Add authors from comments
    for (const c of Object.values(comments.byId)) {
      if (c.workspaceId === workspaceId && !knownUsersMap.has(c.authorId)) {
        knownUsersMap.set(c.authorId, {
          id: c.authorId,
          name: c.authorName || "Unknown",
          color: getColorForUser(c.authorId),
          role: "viewer",
          image: c.authorImage,
        });
      }
    }

    return Array.from(knownUsersMap.values());
  }, [collaborators, localUser, messages, comments, workspaceId]);

  const filteredCollaborators = useMemo(() => {
    const allUsers = allKnownCollaborators.filter(
      (u) => u.id !== localUser?.id
    );

    if (!mentionSearch) {
      return allUsers.slice(0, 5);
    }
    return allUsers
      .filter((u) => u.name.toLowerCase().includes(mentionSearch.toLowerCase()))
      .slice(0, 5);
  }, [allKnownCollaborators, localUser, mentionSearch]);

  const knownUserColors = useMemo(() => {
    const map = new Map<string, string>();
    allKnownCollaborators.forEach((u) => {
      if (u.color) {
        map.set(u.name, u.color);
      }
    });
    return map;
  }, [allKnownCollaborators]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: filteredCollaborators only needs to reset on its own change
  useEffect(() => {
    setMentionSelectedIndex(0);
  }, [filteredCollaborators]);

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      deleteChatMessage(messageId);
    },
    [deleteChatMessage]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setMessageContent(value);

      const lastAtIndex = value.lastIndexOf("@");
      if (lastAtIndex !== -1) {
        const textAfterAt = value.slice(lastAtIndex + 1);
        if (MENTION_SEARCH_REGEX.test(textAfterAt)) {
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
      if (showMentionDropdown && filteredCollaborators.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionSelectedIndex(
            (prev) => (prev + 1) % filteredCollaborators.length
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionSelectedIndex(
            (prev) =>
              (prev - 1 + filteredCollaborators.length) %
              filteredCollaborators.length
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const selectedUser = filteredCollaborators[mentionSelectedIndex];
          if (selectedUser) {
            handleMentionSelect(selectedUser);
          }
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "Escape") {
        setShowMentionDropdown(false);
        setReplyTo(null);
      }
    },
    [
      handleSend,
      showMentionDropdown,
      filteredCollaborators,
      mentionSelectedIndex,
      handleMentionSelect,
    ]
  );

  const handleReplyClick = useCallback((replyId: string) => {
    setHighlightedMessageId(replyId);
    // Clear highlight after animation completes
    setTimeout(() => {
      setHighlightedMessageId(null);
    }, 600);
  }, []);

  const getTypingText = useCallback(() => {
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
  }, [typingUsers]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
              <motion.div
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                key={message.id}
                layout
              >
                <ChatBubble
                  index={index}
                  isHighlighted={highlightedMessageId === message.id}
                  isOwn={message.authorId === localUser?.id}
                  knownUserColors={knownUserColors}
                  message={message}
                  onDelete={handleDeleteMessage}
                  onReply={setReplyTo}
                  onReplyClick={handleReplyClick}
                />
              </motion.div>
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
              Replying to{" "}
              {replyTo.authorId === localUser?.id
                ? "your own message"
                : replyTo.authorName}
            </span>
            <span className="max-w-40 truncate opacity-70">
              {replyTo.content}
            </span>
          </div>
          <button
            aria-label="Cancel reply"
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
          "relative border-border/50 border-t px-3 pt-3 pb-5",
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
                {filteredCollaborators.map((user, index) => (
                  <button
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors",
                      index === mentionSelectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50 hover:text-accent-foreground"
                    )}
                    key={user.id}
                    onClick={() => handleMentionSelect(user)}
                    onMouseEnter={() => setMentionSelectedIndex(index)}
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
            aria-label="Type a message"
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
            aria-label="Send message"
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
