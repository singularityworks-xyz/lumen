import { beforeEach, describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { AiDrawer } from "./ai-drawer";

const CLOSE_BUTTON_REGEX = /close/i;

const mockOnOpenChange = mock(() => undefined);
const mockOnSwitchToBoards = mock(() => undefined);
const mockOnSwitchToComments = mock(() => undefined);

const mockMessages = [
  { id: "1", role: "user" as const, content: "Hello", createdAt: Date.now() },
  {
    id: "2",
    role: "assistant" as const,
    content: "Hi there!",
    createdAt: Date.now(),
  },
];

const mockSetOffline = mock(() => undefined);

const mockAiStoreState = {
  conversations: {
    "ws-1": {
      messages: mockMessages,
      isLoading: false,
      error: null,
    },
  },
  isOffline: false,
  setOffline: mockSetOffline,
  addMessage: mock(),
  clearConversation: mock(),
};

const mockUseAiStore = Object.assign(
  mock((selector?: (state: unknown) => unknown) => {
    if (selector) {
      return selector(mockAiStoreState);
    }
    return mockAiStoreState;
  }),
  { getState: () => mockAiStoreState }
);

mock.module("../store/ai-store", () => ({
  useAiStore: mockUseAiStore,
}));

mock.module("motion/react", () => ({
  AnimatePresence: ({ children }: { children: unknown }) => children,
  motion: {
    div: (props: { children?: unknown; [key: string]: unknown }) => {
      const { children, ...rest } = props;
      return createElement(
        "div",
        rest as Record<string, unknown>,
        children as React.ReactNode
      );
    },
  },
}));

describe("AiDrawer", () => {
  beforeEach(() => {
    mockOnOpenChange.mockClear();
    mockOnSwitchToBoards.mockClear();
    mockOnSwitchToComments.mockClear();
  });

  it("renders nothing when workspaceId is empty", () => {
    const { container } = render(
      createElement(AiDrawer, {
        workspaceId: "",
        isOpen: true,
        onOpenChange: mockOnOpenChange,
      })
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders when workspaceId is provided and isOpen is true", () => {
    render(
      createElement(AiDrawer, {
        workspaceId: "ws-1",
        isOpen: true,
        onOpenChange: mockOnOpenChange,
        boardCount: 5,
        commentCount: 10,
      })
    );

    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("calls onOpenChange with false when close button is clicked", () => {
    render(
      createElement(AiDrawer, {
        workspaceId: "ws-1",
        isOpen: true,
        onOpenChange: mockOnOpenChange,
        boardCount: 5,
        commentCount: 10,
      })
    );

    const closeButton = screen.queryByRole("button", {
      name: CLOSE_BUTTON_REGEX,
    });
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    }
  });
});
