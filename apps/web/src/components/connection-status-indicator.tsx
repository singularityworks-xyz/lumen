"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function ConnectionStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowIndicator(true);
      setTimeout(() => setShowIndicator(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showIndicator) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-lg">
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="font-medium text-sm">Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-orange-500" />
          <span className="font-medium text-sm">Offline mode</span>
        </>
      )}
    </div>
  );
}
