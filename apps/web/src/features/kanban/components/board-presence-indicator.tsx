import { memo } from "react";
import type { Collaborator } from "@/src/features/collab";

type BoardPresenceIndicatorProps = {
  activeCollaborator: Collaborator;
};

export const BoardPresenceIndicator = memo<BoardPresenceIndicatorProps>(
  ({ activeCollaborator }) => (
    <>
      <div
        className="pointer-events-none absolute -inset-1.5 z-20 rounded-lg border-[3px]"
        style={{
          borderColor: activeCollaborator.color,
          boxShadow: `
              0 0 0 1px rgba(0,0,0,0.05),
              0 4px 12px -2px ${activeCollaborator.color}40,
              inset 0 1px 4px rgba(255,255,255,0.1)
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
          className="truncate rounded-md border border-white/20 px-2.5 py-1 font-bold text-[10px] text-white shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-1px_2px_rgba(0,0,0,0.1)] backdrop-blur-sm"
          style={{
            backgroundColor: activeCollaborator.color,
            textShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        >
          {activeCollaborator.name}
        </div>
      </div>
    </>
  )
);

BoardPresenceIndicator.displayName = "BoardPresenceIndicator";
