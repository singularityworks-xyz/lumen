/** biome-ignore-all lint/suspicious/noExplicitAny: skip */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: skip */
/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: skip */
"use client";

import { Volume2, VolumeX } from "lucide-react";
import { motion } from "motion/react";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type AudioContextType = {
  isMuted: boolean;
  toggleMute: () => void;
  playClick: () => void;
};

const SplitFlapAudioContext = createContext<AudioContextType | null>(null);

function useSplitFlapAudio() {
  return useContext(SplitFlapAudioContext);
}

export function SplitFlapAudioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMuted, setIsMuted] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }
    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }
    return audioContextRef.current;
  }, []);

  const triggerHaptic = useCallback(() => {
    if (isMuted) {
      return;
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
  }, [isMuted]);

  const playClick = useCallback(() => {
    if (isMuted) {
      return;
    }

    triggerHaptic();

    try {
      const ctx = getAudioContext();
      if (!ctx) {
        return;
      }

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const lowpass = ctx.createBiquadFilter();

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(
        800 + Math.random() * 400,
        ctx.currentTime
      );
      oscillator.frequency.exponentialRampToValueAtTime(
        200,
        ctx.currentTime + 0.015
      );

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1200, ctx.currentTime);
      filter.Q.setValueAtTime(0.8, ctx.currentTime);

      lowpass.type = "lowpass";
      lowpass.frequency.value = 2500;
      lowpass.Q.value = 0.5;

      gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);

      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(lowpass);
      lowpass.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.02);
    } catch {
      // Audio not supported
    }
  }, [isMuted, getAudioContext, triggerHaptic]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    if (isMuted) {
      try {
        const ctx = getAudioContext();
        if (ctx && ctx.state === "suspended") {
          ctx.resume();
        }
      } catch {
        // Audio not supported
      }
    }
  }, [isMuted, getAudioContext]);

  const value = useMemo(
    () => ({ isMuted, toggleMute, playClick }),
    [isMuted, toggleMute, playClick]
  );

  return (
    <SplitFlapAudioContext.Provider value={value}>
      {children}
    </SplitFlapAudioContext.Provider>
  );
}

export function SplitFlapMuteToggle({
  className = "",
}: {
  className?: string;
}) {
  const audio = useSplitFlapAudio();
  if (!audio) {
    return null;
  }

  return (
    <button
      aria-label={audio.isMuted ? "Unmute sound effects" : "Mute sound effects"}
      className={`inline-flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase tracking-widest transition-colors duration-200 hover:text-foreground ${className}`}
      onClick={audio.toggleMute}
      type="button"
    >
      {audio.isMuted ? (
        <VolumeX className="h-4 w-4" />
      ) : (
        <Volume2 className="h-4 w-4" />
      )}
      <span>{audio.isMuted ? "Sound Off" : "Sound On"}</span>
    </button>
  );
}

type SplitFlapTextProps = {
  text: string;
  className?: string;
  speed?: number;
};

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");

function SplitFlapTextInner({
  text,
  className = "",
  speed = 50,
}: SplitFlapTextProps) {
  const chars = useMemo(() => text.split(""), [text]);
  const [animationKey, setAnimationKey] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const audio = useSplitFlapAudio();

  const handleMouseEnter = useCallback(() => {
    setAnimationKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasInitialized(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`inline-flex cursor-pointer items-center gap-[0.08em] ${className}`}
      onMouseEnter={handleMouseEnter}
      style={{ perspective: "1000px" }}
    >
      {chars.map((char, index) => (
        <SplitFlapChar
          animationKey={animationKey}
          char={char.toUpperCase()}
          index={index}
          key={`${char}-${index}-${animationKey}`}
          playClick={audio?.playClick}
          skipEntrance={hasInitialized}
          speed={speed}
        />
      ))}
    </div>
  );
}

export function SplitFlapText(props: SplitFlapTextProps) {
  return <SplitFlapTextInner {...props} />;
}

type SplitFlapCharProps = {
  char: string;
  index: number;
  animationKey: number;
  skipEntrance: boolean;
  speed: number;
  playClick?: () => void;
};

function SplitFlapChar({
  char,
  index,
  animationKey,
  skipEntrance,
  speed,
  playClick,
}: SplitFlapCharProps) {
  const displayChar = CHARSET.includes(char) ? char : " ";
  const isSpace = char === " ";
  const [currentChar, setCurrentChar] = useState(
    skipEntrance ? displayChar : " "
  );
  const [isSettled, setIsSettled] = useState(skipEntrance);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tileDelay = 0.15 * index;

  const bgColor = isSettled ? "hsl(0, 0%, 0%)" : "rgba(249, 115, 22, 0.2)";
  const textColor = isSettled ? "#ffffff" : "#f97316";

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isSpace) {
      setCurrentChar(" ");
      setIsSettled(true);
      return;
    }

    setIsSettled(false);
    setCurrentChar(CHARSET[Math.floor(Math.random() * CHARSET.length)]);

    const baseFlips = 8;
    const startDelay = skipEntrance ? tileDelay * 400 : tileDelay * 800;
    let flipIndex = 0;
    let hasStartedSettling = false;

    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        const settleThreshold = baseFlips + index * 3;

        if (flipIndex >= settleThreshold && !hasStartedSettling) {
          hasStartedSettling = true;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          setCurrentChar(displayChar);
          setIsSettled(true);
          if (playClick) {
            playClick();
          }
          return;
        }
        setCurrentChar(CHARSET[Math.floor(Math.random() * CHARSET.length)]);
        if (flipIndex % 2 === 0 && playClick) {
          playClick();
        }
        flipIndex += 1;
      }, speed);
    }, startDelay);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [displayChar, isSpace, tileDelay, skipEntrance, index, speed, playClick]);

  if (isSpace) {
    return (
      <div
        style={{
          width: "0.3em",
          fontSize: "clamp(4rem, 15vw, 14rem)",
        }}
      />
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="relative flex items-center justify-center overflow-hidden font-bebas"
      initial={skipEntrance ? false : { opacity: 0, y: 20 }}
      style={{
        fontSize: "clamp(4rem, 15vw, 14rem)",
        width: "0.65em",
        height: "1.05em",
        backgroundColor: bgColor,
        transformStyle: "preserve-3d",
        transition: "background-color 0.15s ease",
      }}
      transition={{ delay: tileDelay, duration: 0.3, ease: "easeOut" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px bg-black/20" />

      <div className="absolute inset-x-0 top-0 bottom-1/2 flex items-end justify-center overflow-hidden">
        <span
          className="block translate-y-[0.52em] leading-none transition-colors duration-150"
          style={{ color: textColor }}
        >
          {currentChar}
        </span>
      </div>

      <div className="absolute inset-x-0 top-1/2 bottom-0 flex items-start justify-center overflow-hidden">
        <span
          className="-translate-y-[0.52em] leading-none transition-colors duration-150"
          style={{ color: textColor }}
        >
          {currentChar}
        </span>
      </div>

      <motion.div
        animate={{ rotateX: 0 }}
        className="absolute inset-x-0 top-0 bottom-1/2 origin-bottom overflow-hidden"
        initial={{ rotateX: -90 }}
        key={`${animationKey}-${isSettled}`}
        style={{
          backgroundColor: bgColor,
          transformStyle: "preserve-3d",
          backfaceVisibility: "hidden",
          transition: "background-color 0.15s ease",
        }}
        transition={{
          delay: skipEntrance ? tileDelay * 0.5 : tileDelay + 0.15,
          duration: 0.25,
          ease: [0.22, 0.61, 0.36, 1],
        }}
      >
        <div className="flex h-full items-end justify-center">
          <span
            className="translate-y-[0.52em] leading-none transition-colors duration-150"
            style={{ color: textColor }}
          >
            {currentChar}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
