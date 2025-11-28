import { useEffect, useState } from "react";

/**
 * Hook to track browser online/offline status
 * @returns Object containing:
 *  - isOnline: true if browser is online
 *  - isOffline: true if browser is offline
 */
export function useConnectionStatus(): {
  isOnline: boolean;
  isOffline: boolean;
} {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}
