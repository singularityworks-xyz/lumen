"use client";

import { useQuery } from "@tanstack/react-query";

export function useCachedProfileImage(imageUrl: string | null | undefined) {
  const { data: cachedUrl, isLoading } = useQuery({
    queryKey: ["profile-image", imageUrl],
    queryFn: () => {
      if (!imageUrl) {
        return null;
      }

      return new Promise<string>((resolve) => {
        const img = new Image();

        img.onload = () => {
          resolve(imageUrl);
        };

        img.onerror = () => {
          resolve(imageUrl);
        };

        img.src = imageUrl;
      });
    },
    enabled: !!imageUrl,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  return {
    imageUrl: cachedUrl ?? imageUrl,
    isLoading,
    hasImage: !!imageUrl,
  };
}
