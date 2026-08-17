"use client";

import { useEffect } from "react";

export function UmamiAnalytics() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        const script = document.createElement("script");
        script.defer = true;
        script.src = "https://tracking.przknv.cc/script.js";
        script.setAttribute(
          "data-website-id",
          "1804ca83-124f-4df6-8883-0b1fe189fec6"
        );
        document.head.appendChild(script);
      }
    }
  }, []);

  return null;
}
