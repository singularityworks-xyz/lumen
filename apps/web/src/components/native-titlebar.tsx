"use client";

import {
  closeWindow,
  isMaximized,
  isTauri,
  minimizeWindow,
  startDragging,
  toggleMaximize,
} from "@lumen/native-bridge";
import { Minus, Square } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { XIcon } from "./animated/icons/x";

export function NativeTitlebar() {
  const [isNative, setIsNative] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const native = isTauri();
    setIsNative(native);

    if (native) {
      isMaximized().then(setMaximized);
      document.documentElement.classList.add("native-app");
    }

    return () => {
      document.documentElement.classList.remove("native-app");
    };
  }, []);

  const handleMinimize = useCallback(() => {
    minimizeWindow();
  }, []);

  const handleMaximize = useCallback(async () => {
    await toggleMaximize();
    setMaximized(await isMaximized());
  }, []);

  const handleClose = useCallback(() => {
    closeWindow();
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    startDragging();
  }, []);

  if (!isNative) {
    return null;
  }

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip
    // biome-ignore lint/a11y/noStaticElementInteractions: skip
    <div
      className="fixed top-0 right-0 left-0 z-9999 flex h-8 select-none items-center justify-between border-border/50 border-b bg-card/95 shadow-[inset_0_2px_8px_rgba(0,0,0,0.15),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:shadow-[inset_0_2px_8px_rgba(255,255,255,0.1),inset_0_-2px_6px_rgba(0,0,0,0.4)]"
      data-tauri-drag-region
      onMouseDown={handleDragStart}
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div
        className="flex flex-1 cursor-default items-center gap-2 pl-3"
        data-tauri-drag-region
      >
        <div className="relative h-4 w-4">
          <Image
            alt="Lumen"
            className="object-contain dark:hidden"
            fill
            priority
            src="/lumen.svg"
          />
          <Image
            alt="Lumen"
            className="hidden object-contain dark:block"
            fill
            priority
            src="/lumen_white.svg"
          />
        </div>
        <span className="font-medium text-[12px] text-foreground">
          Lumen — Singularity Works
        </span>
      </div>
      <div className="flex h-full items-center gap-1.5 pr-2">
        <button
          className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/50 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.15)] transition-all hover:bg-green-500/25 hover:text-green-500 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_3px_rgba(0,0,0,0.2)] active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)] dark:hover:text-green-400"
          onClick={handleMinimize}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          title="Minimize"
          type="button"
        >
          <Minus size={10} strokeWidth={2.5} />
        </button>
        <button
          className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/50 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.15)] transition-all hover:bg-yellow-500/25 hover:text-yellow-500 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_3px_rgba(0,0,0,0.2)] active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)] dark:hover:text-yellow-400"
          onClick={handleMaximize}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          title={maximized ? "Restore" : "Maximize"}
          type="button"
        >
          <Square size={8} strokeWidth={2.5} />
        </button>
        <button
          className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/50 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.15)] transition-all hover:bg-red-500/25 hover:text-red-500 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_3px_rgba(0,0,0,0.2)] active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)] dark:hover:text-red-400"
          onClick={handleClose}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          title="Close"
          type="button"
        >
          <XIcon size={10} />
        </button>
      </div>
    </div>
  );
}
