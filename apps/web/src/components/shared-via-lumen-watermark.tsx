"use client";

import { memo } from "react";

function LumenLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-label="Lumen Logo"
      className={className}
      fill="none"
      viewBox="0 0 40 41"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20 0.889954C31.0457 0.889954 40 9.84426 40 20.89V34.89C40 38.2037 37.3137 40.89 34 40.89H21V32.1161C21 30.114 21.1224 28.0404 22.1725 26.3357C23.6625 23.9168 26.1515 22.1871 29.0764 21.7093L29.4595 21.6467C29.7828 21.5358 30 21.2318 30 20.89C30 20.5481 29.7828 20.2441 29.4595 20.1332L29.0764 20.0706C24.836 19.378 21.512 16.054 20.8193 11.8135L20.7568 11.4305C20.6459 11.1071 20.3418 10.89 20 10.89C19.6582 10.89 19.3541 11.1071 19.2432 11.4305L19.1807 11.8135C18.7029 14.7385 16.9731 17.2274 14.5542 18.7175C12.8496 19.7676 10.7759 19.89 8.77382 19.89H0.0245667C0.545597 9.30884 9.28963 0.889954 20 0.889954Z"
        fill="currentColor"
      />
      <path
        className="opacity-75"
        d="M0 21.89H8.77382C10.7759 21.89 12.8495 22.0123 14.5541 23.0624C15.8852 23.8823 17.0076 25.0047 17.8276 26.3358C18.8776 28.0405 19 30.114 19 32.1161V40.89H6C2.68629 40.89 0 38.2037 0 34.89V21.89Z"
        fill="currentColor"
      />
      <path
        d="M40 2.88995C40 3.99452 39.1046 4.88995 38 4.88995C36.8954 4.88995 36 3.99452 36 2.88995C36 1.78538 36.8954 0.889954 38 0.889954C39.1046 0.889954 40 1.78538 40 2.88995Z"
        fill="currentColor"
      />
    </svg>
  );
}

export const SharedViaLumenWatermark = memo(function SharedViaLumenWatermark() {
  return (
    <div
      className="pointer-events-auto fixed right-4 bottom-4 z-40 select-none"
      data-testid="shared-via-lumen-watermark"
    >
      <a
        className="flex items-center gap-2 rounded-full border-2 border-border/50 bg-card/95 px-3 py-1.5 text-foreground shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
        href="https://lumen.itssingularity.com"
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className="flex h-4 w-4 items-center justify-center text-foreground">
          <LumenLogo className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium text-muted-foreground text-xs">
          Shared via{" "}
          <strong className="font-semibold text-foreground">Lumen</strong>
        </span>
      </a>
    </div>
  );
});
