import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  /* ignore - already registered */
}

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render } from "@testing-library/react";
import { createElement } from "react";

const REPLY_BUTTON_REGEX = /reply/i;
const SEND_BUTTON_REGEX = /send/i;
const DELETE_BUTTON_REGEX = /delete/i;
const TYPING_TEXT_REGEX = /is typing/i;
const GUEST_MODE_REGEX = /Guest mode ·/;

const mockUpdateIsTyping = mock(() => undefined);
const mockSendChatMessage = mock(() => undefined);
const mockDeleteChatMessage = mock(() => undefined);

const mockLocalUser = {
  id: "user-1",
  name: "Test User",
  email: "test@test.com",
  role: "editor" as const,
  color: "#3b82f6",
  image: "https://example.com/user.png",
};

const mockCollaborators = [
  {
    id: "user-2",
    name: "Other User",
    email: "other@test.com",
    role: "editor" as const,
    color: "#22c55e",
    image: undefined,
    isTyping: false,
  },
];

const mockStore = {
  sendChatMessage: mockSendChatMessage,
  deleteChatMessage: mockDeleteChatMessage,
  chatMessages: { byId: {} as Record<string, unknown>, allIds: [] as string[] },
  comments: { byId: {} as Record<string, unknown>, allIds: [] as string[] },
  updateIsTyping: mockUpdateIsTyping,
  isGuestMode: false,
  openProfileModal: mock(() => undefined),
};

const mockUseKanbanStore = mock(
  (selector: (state: typeof mockStore) => unknown) => selector(mockStore)
);

mock.module("@/src/features/collab", () => ({
  useCollaboration: () => ({
    localUser: mockLocalUser,
    collaborators: mockCollaborators,
    updateIsTyping: mockUpdateIsTyping,
  }),
  getColorForUser: () => "#6e6e6e",
}));

mock.module("@/src/features/kanban/store/kanban-store", () => ({
  useKanbanStore: mockUseKanbanStore,
}));

mock.module("@/src/lib/date", () => ({
  formatRelativeTime: () => "2m ago",
}));

import { DiscussionTab } from "./discussion-tab";

function createChatMessage(
  id: string,
  content: string,
  authorId: string,
  authorName: string
) {
  return {
    id,
    content,
    workspaceId: "ws-1",
    authorId,
    authorName,
    authorImage: undefined,
    createdAt: new Date().toISOString(),
    isEdited: false,
    replyToId: undefined,
    replyToContent: undefined,
    replyToAuthorName: undefined,
  };
}

describe("DiscussionTab", () => {
  beforeEach(() => {
    mockUpdateIsTyping.mockClear();
    mockSendChatMessage.mockClear();
    mockDeleteChatMessage.mockClear();
    mockStore.chatMessages = { byId: {}, allIds: [] };
    mockStore.comments = { byId: {}, allIds: [] };
  });

  function renderDiscussionTab(workspaceId = "ws-1") {
    return render(createElement(DiscussionTab, { workspaceId }));
  }

  describe("empty state", () => {
    it("shows empty state when no messages", () => {
      const { getByText } = renderDiscussionTab();

      expect(getByText("Start the conversation")).toBeDefined();
      expect(getByText("Chat with your team in real-time")).toBeDefined();
    });
  });

  describe("message input", () => {
    it("renders message textarea", () => {
      const { getByRole } = renderDiscussionTab();

      expect(getByRole("textbox")).toBeDefined();
    });

    it("renders send button", () => {
      const { getByRole } = renderDiscussionTab();

      expect(getByRole("button", { name: SEND_BUTTON_REGEX })).toBeDefined();
    });
  });

  describe("reply flow", () => {
    it("shows reply button for messages", () => {
      mockStore.chatMessages = {
        byId: {
          "msg-1": createChatMessage(
            "msg-1",
            "Message to reply to",
            "user-2",
            "Other User"
          ),
        },
        allIds: ["msg-1"],
      };

      const { getAllByRole } = renderDiscussionTab();

      expect(
        getAllByRole("button", { name: REPLY_BUTTON_REGEX })[0]
      ).toBeDefined();
    });
  });

  describe("typing indicator", () => {
    it("does not show typing indicator when no one is typing", () => {
      const { queryByText } = renderDiscussionTab();

      expect(queryByText(TYPING_TEXT_REGEX)).toBeNull();
    });
  });

  describe("cleanup", () => {
    it("clears typing status on unmount", () => {
      const { unmount } = renderDiscussionTab();

      unmount();

      expect(mockUpdateIsTyping).toHaveBeenCalledWith(false);
    });
  });
});

describe("ChatBubble rendering", () => {
  beforeEach(() => {
    mockUpdateIsTyping.mockClear();
    mockSendChatMessage.mockClear();
    mockDeleteChatMessage.mockClear();
  });

  function renderWithMessages(
    messages: ReturnType<typeof createChatMessage>[]
  ) {
    mockStore.chatMessages = {
      byId: Object.fromEntries(messages.map((m) => [m.id, m])),
      allIds: messages.map((m) => m.id),
    };
    mockStore.comments = { byId: {}, allIds: [] };

    return render(createElement(DiscussionTab, { workspaceId: "ws-1" }));
  }

  it("renders own message with You label", () => {
    const messages = [
      createChatMessage("msg-1", "My message", "user-1", "Test User"),
    ];
    const { getByText } = renderWithMessages(messages);

    expect(getByText("My message")).toBeDefined();
    expect(getByText("You")).toBeDefined();
  });

  it("renders other user's message with their name", () => {
    const messages = [
      createChatMessage("msg-1", "Their message", "user-2", "Other User"),
    ];
    const { getByText } = renderWithMessages(messages);

    expect(getByText("Their message")).toBeDefined();
    expect(getByText("Other User")).toBeDefined();
  });

  it("shows delete button for own messages", () => {
    const messages = [
      createChatMessage("msg-1", "My message", "user-1", "Test User"),
    ];
    const { getByRole } = renderWithMessages(messages);

    expect(getByRole("button", { name: DELETE_BUTTON_REGEX })).toBeDefined();
  });

  it("does not show delete button for other user's messages", () => {
    const messages = [
      createChatMessage("msg-1", "Their message", "user-2", "Other User"),
    ];
    const { queryByRole } = renderWithMessages(messages);

    expect(queryByRole("button", { name: DELETE_BUTTON_REGEX })).toBeNull();
  });

  it("shows reply button for all messages", () => {
    const messages = [
      createChatMessage("msg-1", "Some message", "user-2", "Other User"),
    ];
    const { getAllByRole } = renderWithMessages(messages);

    expect(
      getAllByRole("button", { name: REPLY_BUTTON_REGEX })[0]
    ).toBeDefined();
  });

  it("renders multiple messages", () => {
    const messages = [
      createChatMessage("msg-1", "First message", "user-1", "Test User"),
      createChatMessage("msg-2", "Second message", "user-2", "Other User"),
    ];
    const { getByText } = renderWithMessages(messages);

    expect(getByText("First message")).toBeDefined();
    expect(getByText("Second message")).toBeDefined();
  });
});

describe("Guest Mode spam resistance in DiscussionTab", () => {
  beforeEach(() => {
    mockUpdateIsTyping.mockClear();
    mockSendChatMessage.mockClear();
    mockDeleteChatMessage.mockClear();
    mockStore.chatMessages = { byId: {}, allIds: [] };
    mockStore.comments = { byId: {}, allIds: [] };
    mockStore.isGuestMode = true;
  });

  it("shows guest limit indicator footer when in guest mode", () => {
    const { getByText } = render(
      createElement(DiscussionTab, { workspaceId: "ws-1" })
    );

    expect(getByText(GUEST_MODE_REGEX)).toBeDefined();
    expect(getByText("Log in to chat more")).toBeDefined();
  });
});
