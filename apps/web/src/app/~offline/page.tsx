"use client";

import { Signal } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="flex max-w-md flex-col items-center gap-6 px-4 text-center">
        <div className="rounded-full bg-muted p-6">
          <Signal className="h-12 w-12 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="font-semibold text-2xl">You're offline</h1>
          <p className="text-muted-foreground">
            Lumen works offline with local workspaces. You can continue working
            on your local boards. Shared workspaces will be available when
            you're back online.
          </p>
        </div>

        <button
          className="mt-4 rounded-lg bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          onClick={() => window.location.reload()}
          type="button"
        >
          Check Connection
        </button>
      </div>
    </div>
  );
}
