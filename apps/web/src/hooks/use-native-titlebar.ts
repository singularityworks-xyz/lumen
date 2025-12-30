"use client";

import { isTauri } from "@lumen/native-bridge";
import { useEffect, useState } from "react";

export const NATIVE_TITLEBAR_HEIGHT = 32;

export function useNativeTitlebarOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setOffset(isTauri() ? NATIVE_TITLEBAR_HEIGHT : 0);
  }, []);

  return offset;
}

export function useIsNative(): boolean {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(isTauri());
  }, []);

  return isNative;
}
