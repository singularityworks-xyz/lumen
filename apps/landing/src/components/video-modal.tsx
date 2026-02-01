"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

const YOUTUBE_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^&\n?#]+)/,
  /(?:https?:\/\/)?youtu\.be\/([^&\n?#]+)/,
];

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
}

export const VideoModal = ({ isOpen, onClose, videoUrl }: VideoModalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: skip
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    } else {
      document.removeEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!(mounted && isOpen)) {
    return null;
  }

  // Convert YouTube URL to embed URL
  const getEmbedUrl = (url: string) => {
    if (!url) {
      return "";
    }

    // Handle various YouTube URL formats

    for (const pattern of YOUTUBE_PATTERNS) {
      const match = url.match(pattern);
      if (match) {
        return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`;
      }
    }

    return url;
  };

  const embedUrl = getEmbedUrl(videoUrl || "");

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Modal backdrop should be clickable to close
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      tabIndex={-1}
    >
      <div className="relative mx-4 aspect-video w-full max-w-4xl overflow-hidden rounded-lg bg-black shadow-2xl">
        {/* Close button */}
        <button
          aria-label="Close video"
          className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
          onClick={onClose}
          type="button"
        >
          <X size={24} />
        </button>

        {/* Video iframe */}
        {embedUrl ? (
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
            frameBorder="0"
            src={embedUrl}
            title="Demo Video"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white">
            <div className="text-center">
              <p className="mb-2 text-xl">Video URL not provided</p>
              <p className="text-gray-400 text-sm">
                Please provide a valid YouTube URL
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
