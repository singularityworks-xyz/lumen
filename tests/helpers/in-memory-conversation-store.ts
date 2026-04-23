export interface AIMessage {
  content: string;
  conversationId: string;
  createdAt: Date;
  id: string;
  role: "user" | "assistant" | "system";
  toolCalls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
}

export interface AIConversation {
  createdAt: Date;
  id: string;
  lastActiveAt: Date;
  messageCount: number;
  messages: AIMessage[];
  summary: string | null;
  summaryUpToIndex: number;
  title: string | null;
  userId: string;
  workspaceId: string;
}

export class InMemoryConversationStore {
  private readonly conversations: Map<string, AIConversation> = new Map();

  upsert(
    workspaceId: string,
    userId: string,
    conversationId?: string
  ): AIConversation {
    const id = conversationId ?? `conv-${Date.now()}`;
    const existing = this.conversations.get(id);

    if (existing) {
      existing.lastActiveAt = new Date();
      return existing;
    }

    const conv: AIConversation = {
      id,
      workspaceId,
      userId,
      title: null,
      messageCount: 0,
      summary: null,
      summaryUpToIndex: 0,
      lastActiveAt: new Date(),
      createdAt: new Date(),
      messages: [],
    };
    this.conversations.set(id, conv);
    return conv;
  }

  addMessage(
    conversationId: string,
    message: Omit<AIMessage, "conversationId">
  ): AIMessage {
    const conv = this.conversations.get(conversationId);
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const msg: AIMessage = { ...message, conversationId };
    conv.messages.push(msg);
    conv.messageCount = conv.messages.length;
    conv.lastActiveAt = new Date();
    return msg;
  }

  getConversation(conversationId: string): AIConversation | null {
    return this.conversations.get(conversationId) ?? null;
  }

  getMessages(conversationId: string): AIMessage[] {
    const conv = this.conversations.get(conversationId);
    return conv?.messages ?? [];
  }

  deleteMessage(conversationId: string, messageId: string): boolean {
    const conv = this.conversations.get(conversationId);
    if (!conv) {
      return false;
    }

    const idx = conv.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) {
      return false;
    }

    conv.messages.splice(idx, 1);
    conv.messageCount = conv.messages.length;
    return true;
  }

  clearMessages(conversationId: string): number {
    const conv = this.conversations.get(conversationId);
    if (!conv) {
      return 0;
    }

    const count = conv.messages.length;
    conv.messages = [];
    conv.messageCount = 0;
    return count;
  }

  deleteConversation(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }

  updateTitle(conversationId: string, title: string): boolean {
    const conv = this.conversations.get(conversationId);
    if (!conv) {
      return false;
    }
    conv.title = title;
    return true;
  }

  updateSummary(
    conversationId: string,
    summary: string,
    summaryUpToIndex: number
  ): boolean {
    const conv = this.conversations.get(conversationId);
    if (!conv) {
      return false;
    }
    conv.summary = summary;
    conv.summaryUpToIndex = summaryUpToIndex;
    return true;
  }

  listConversations(workspaceId: string, userId: string): AIConversation[] {
    return Array.from(this.conversations.values()).filter(
      (c) => c.workspaceId === workspaceId && c.userId === userId
    );
  }
}
