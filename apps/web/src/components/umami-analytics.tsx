"use client";

import { useEffect } from "react";

export function UmamiAnalytics() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const isLocalhost =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "::1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.");

      if (!isLocalhost) {
        const websiteId = "1804ca83-124f-4df6-8883-0b1fe189fec6";
        const existingScript = document.querySelector(
          `script[data-website-id="${websiteId}"]`
        );

        if (!existingScript) {
          const script = document.createElement("script");
          script.defer = true;
          script.src = "https://tracking.przknv.cc/script.js";
          script.setAttribute("data-website-id", websiteId);
          document.head.appendChild(script);
        }
      }
    }
  }, []);

  return null;
}
