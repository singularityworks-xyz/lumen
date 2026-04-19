import { memo } from "react";
import type { Collaborator } from "@/src/features/collab";

interface BoardPresenceIndicatorProps {
  activeCollaborator: Collaborator;
}

export const BoardPresenceIndicator = memo<BoardPresenceIndicatorProps>(
  ({ activeCollaborator }) => (
    <>
      <div
        className="pointer-events-none absolute -inset-1.5 z-20 rounded-lg border-[3px]"
        data-testid="peer-selection"
        style={{
          borderColor: activeCollaborator.color,
          boxShadow: `
              0 0 0 1px rgba(0,0,0,0.08),
              0 4px 16px -2px ${activeCollaborator.color}50,
              0 8px 24px -4px rgba(0,0,0,0.15),
              inset 0 2px 8px rgba(255,255,255,0.15),
              inset 0 -2px 6px rgba(0,0,0,0.2)
            `,
        }}
      />

      <div
        className="absolute -top-8 -left-2 z-20 flex items-center overflow-visible px-0.5"
        style={{
          maxWidth: "100%",
        }}
      >
        <div
          className="truncate rounded-md border border-white/25 px-2.5 py-1 font-bold text-[10px] text-white backdrop-blur-sm"
          style={{
            backgroundColor: activeCollaborator.color,
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            boxShadow: `
              0 4px 12px rgba(0,0,0,0.25),
              0 2px 6px rgba(0,0,0,0.15),
              inset 0 2px 4px rgba(255,255,255,0.35),
              inset 0 -2px 6px rgba(0,0,0,0.25),
              inset 1px 0 2px rgba(255,255,255,0.1),
              inset -1px 0 2px rgba(0,0,0,0.15)
            `,
          }}
        >
          {activeCollaborator.name}
        </div>
      </div>
    </>
  )
);

BoardPresenceIndicator.displayName = "BoardPresenceIndicator";
