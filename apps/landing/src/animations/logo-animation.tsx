import { useCallback, useEffect, useRef, useState } from "react";

const LOGO_TEXT = "Lumen_";
const TYPING_SPEED = 120; // ms per character
const DELETE_SPEED = 70; // ms per character when deleting
const INITIAL_DELAY = 300; // delay before starting animation
const CURSOR_BLINK_SPEED = 530; // cursor blink interval

type AnimationState = "idle" | "deleting" | "typing" | "complete";

export function useLogoAnimation() {
  const [displayText, setDisplayText] = useState("");
  const [animationState, setAnimationState] = useState<AnimationState>("idle");
  const [showCursor, setShowCursor] = useState(true);
  const [hasHoverAnimated, setHasHoverAnimated] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startCursorBlink = useCallback(() => {
    if (cursorIntervalRef.current) {
      clearInterval(cursorIntervalRef.current);
    }
    setShowCursor(true);
    cursorIntervalRef.current = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, CURSOR_BLINK_SPEED);
  }, []);

  const stopCursorBlink = useCallback(() => {
    if (cursorIntervalRef.current) {
      clearInterval(cursorIntervalRef.current);
      cursorIntervalRef.current = null;
    }
    setShowCursor(false);
  }, []);

  // Typing animation logic
  const typeCharacter = useCallback(
    (currentIndex: number, onComplete?: () => void) => {
      if (currentIndex <= LOGO_TEXT.length) {
        setDisplayText(LOGO_TEXT.slice(0, currentIndex));
        if (currentIndex < LOGO_TEXT.length) {
          // Add slight randomness for natural feel
          const variance = Math.random() * 50 - 25;
          timeoutRef.current = setTimeout(
            () => typeCharacter(currentIndex + 1, onComplete),
            TYPING_SPEED + variance
          );
        } else {
          // Animation complete - hide cursor immediately when "_" is displayed
          setAnimationState("complete");
          onComplete?.();
        }
      }
    },
    []
  );

  // Delete animation logic
  const deleteCharacter = useCallback(
    (currentLength: number, onComplete: () => void) => {
      if (currentLength > 0) {
        setDisplayText(LOGO_TEXT.slice(0, currentLength - 1));
        const variance = Math.random() * 30 - 15;
        timeoutRef.current = setTimeout(
          () => deleteCharacter(currentLength - 1, onComplete),
          DELETE_SPEED + variance
        );
      } else {
        onComplete();
      }
    },
    []
  );

  // Start typing animation
  const startTyping = useCallback(() => {
    setAnimationState("typing");
    startCursorBlink();
    typeCharacter(1, stopCursorBlink);
  }, [typeCharacter, startCursorBlink, stopCursorBlink]);

  // Trigger animation on hover (only once per hover)
  const triggerHoverAnimation = useCallback(() => {
    if (animationState !== "complete" || hasHoverAnimated) {
      return;
    }

    setHasHoverAnimated(true);
    clearTimeouts();
    setAnimationState("deleting");
    startCursorBlink();

    deleteCharacter(LOGO_TEXT.length, () => {
      timeoutRef.current = setTimeout(() => {
        setAnimationState("typing");
        typeCharacter(1, stopCursorBlink);
      }, 150);
    });
  }, [
    animationState,
    hasHoverAnimated,
    clearTimeouts,
    deleteCharacter,
    typeCharacter,
    startCursorBlink,
    stopCursorBlink,
  ]);

  // Initial page load animation
  useEffect(() => {
    const initialTimeout = setTimeout(() => {
      startTyping();
    }, INITIAL_DELAY);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeouts();
      if (cursorIntervalRef.current) {
        clearInterval(cursorIntervalRef.current);
      }
    };
  }, [startTyping, clearTimeouts]);

  // Reset hover animation state on mouse leave
  const handleMouseLeave = () => {
    setHasHoverAnimated(false);
  };

  return {
    displayText,
    showCursor,
    triggerHoverAnimation,
    handleMouseLeave,
  };
}
