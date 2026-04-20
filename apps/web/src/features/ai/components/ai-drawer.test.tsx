import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  /* ignore - already registered */
}

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { AiDrawer } from "./ai-drawer";

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

const mockMotion = (props: { children?: unknown; [key: string]: unknown }) => {
  const { children, ...rest } = props;
  return createElement(
    props.type === "button" ? "button" : "div",
    rest as Record<string, unknown>,
    children as React.ReactNode
  );
};

mockMotion.displayName = "mockMotion";

mock.module("motion/react", () => ({
  AnimatePresence: ({ children }: { children: unknown }) => children,
  motion: {
    div: mockMotion,
    button: mockMotion,
    span: mockMotion,
  },
}));

mock.module("./floating-indicator", () => ({
  FloatingIndicator: () =>
    createElement("div", { "data-testid": "floating-indicator" }),
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

  it("renders FloatingIndicator when workspaceId is provided", () => {
    render(
      createElement(AiDrawer, {
        workspaceId: "ws-1",
        isOpen: false,
        onOpenChange: mockOnOpenChange,
        boardCount: 5,
        commentCount: 10,
      })
    );

    expect(screen.getByTestId("floating-indicator")).toBeDefined();
  });
});
