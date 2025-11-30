import { Cloud, Phone, Shield, X } from "lucide-react";
import { motion } from "motion/react";
import React from "react";

const THEME = {
  bg: "bg-[#171717]",
  border: "border-zinc-800",
  accent: "bg-emerald-500",
  text: "text-zinc-400",
};

const GridBackground = () => (
  <div className="pointer-events-none absolute inset-0">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-size-[24px_24px] opacity-10" />
  </div>
);

const GrayCursor = ({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) => (
  <div className={`relative ${className}`}>
    {/** biome-ignore lint/a11y/noSvgWithoutTitle: mouse */}
    <svg
      className="-top-[3px] -left-[3px] relative z-10 fill-current text-zinc-300 drop-shadow-md"
      height="24"
      style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.5))" }}
      viewBox="0 0 24 24"
      width="24"
    >
      <path
        d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19135L11.7115 12.3673H5.65376Z"
        stroke="#52525b"
        strokeWidth="1"
      />
    </svg>
    {label && (
      <div className="pointer-events-none absolute top-4 left-3 z-0 whitespace-nowrap rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-bold text-[10px] text-zinc-300 shadow-sm">
        {label}
      </div>
    )}
  </div>
);

const DummyTask = ({ width = "w-full", color = "bg-zinc-700" }) => (
  <div className="mb-1.5 rounded border border-zinc-700/30 bg-zinc-800/50 p-1">
    <div
      className={`h-1 ${color} mb-1 rounded-full opacity-40`}
      style={{ width: "30%" }}
    />
    <div
      className={`mb-0.5 h-1 rounded-full bg-zinc-600 opacity-30 ${width}`}
    />
  </div>
);

export const OfflineAnimation = () => (
  <div
    className={`relative flex h-full w-full flex-col items-center justify-between py-8 ${THEME.bg} overflow-hidden font-sans`}
  >
    <GridBackground />

    <div className="relative z-20">
      <div className="group relative flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-[#171717] shadow-2xl">
        <div className="absolute inset-0 animate-pulse rounded-xl bg-zinc-800/20" />
        <Cloud className="h-6 w-6 text-zinc-400" />{" "}
        <motion.div
          animate={{ scale: [0, 0, 1.2, 1, 0] }}
          className="-right-1 -top-1 absolute h-3 w-3 rounded-full border-2 border-[#171717] bg-emerald-500"
          transition={{
            duration: 4,
            times: [0, 0.8, 0.85, 0.9, 1],
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
      </div>
    </div>

    <div className="relative flex w-full flex-1 items-center justify-center">
      <div className="h-full w-0.5 rounded-full bg-zinc-800/50" />

      <motion.div
        animate={{ opacity: [1, 0, 0, 1] }}
        className="absolute top-0 bottom-0 w-0.5 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
        transition={{
          duration: 4,
          times: [0, 0.3, 0.7, 0.8],
          repeat: Number.POSITIVE_INFINITY,
        }}
      />

      <motion.div
        animate={{ opacity: [0, 1, 1, 0] }}
        className="absolute top-0 bottom-0 w-0.5 border-red-500/50 border-l-2 border-dashed"
        transition={{
          duration: 4,
          times: [0, 0.3, 0.7, 0.8],
          repeat: Number.POSITIVE_INFINITY,
        }}
      />

      <motion.div
        animate={{
          bottom: ["0%", "50%", "50%", "100%"],
          scale: [0, 1, 0.8, 1, 0],
          backgroundColor: [
            "#10b981",
            "#10b981",
            "#ef4444",
            "#10b981",
            "#10b981",
          ],
        }}
        className="absolute z-10 h-3 w-3 rounded bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
        initial={{ bottom: "0%" }}
        transition={{
          duration: 4,
          times: [0, 0.3, 0.7, 1],
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      <motion.div
        animate={{ scale: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
        className="absolute z-20 rounded-full border border-red-500/50 bg-[#171717] p-1.5 shadow-xl"
        transition={{
          duration: 4,
          times: [0.25, 0.3, 0.7, 0.75],
          repeat: Number.POSITIVE_INFINITY,
        }}
      >
        <X className="h-3 w-3 text-red-500" strokeWidth={3} />
      </motion.div>
    </div>

    <div className="relative z-20">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-[#171717] shadow-2xl">
        <Phone className="h-6 w-6 text-zinc-400" />{" "}
        <motion.div
          animate={{ scale: [0, 1, 1, 0] }}
          className="-right-1 -top-1 absolute h-3 w-3 rounded-full border-2 border-[#171717] bg-emerald-500"
          transition={{
            duration: 4,
            times: [0, 0.1, 0.2, 0.3],
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
      </div>
    </div>
  </div>
);

export const SyncAnimation = () => (
  <div
    className={`relative flex h-full w-full items-center justify-center ${THEME.bg} overflow-hidden`}
  >
    <GridBackground />

    <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-[#171717] shadow-2xl">
      <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/10" />
      <Shield className="h-5 w-5 text-emerald-500" />
    </div>

    {[0, 120, 240].map((angle, i) => (
      <React.Fragment key={angle}>
        <div
          className="absolute top-1/2 left-1/2 z-0 h-px w-[70px] origin-left bg-linear-to-r from-zinc-700 to-transparent"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <motion.div
            animate={{ left: ["0%", "100%"], opacity: [0, 1, 0] }}
            className="-translate-y-1/2 absolute top-1/2 left-0 h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]"
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.5,
              ease: "linear",
            }}
          />
          <motion.div
            animate={{ left: ["100%", "0%"], opacity: [0, 1, 0] }}
            className="-translate-y-1/2 absolute top-1/2 left-0 h-1 w-1 rounded-full bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.8)]"
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.5 + 1,
              ease: "linear",
            }}
          />
        </div>

        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            borderColor: ["#3f3f46", "#10b981", "#3f3f46"],
          }}
          className="absolute z-10 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-[#171717] shadow-lg"
          style={{
            top: `calc(50% + ${Math.sin((angle * Math.PI) / 180) * 70}px)`,
            left: `calc(50% + ${Math.cos((angle * Math.PI) / 180) * 70}px)`,
            x: "-50%",
            y: "-50%",
          }}
          transition={{
            duration: 3,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.3,
          }}
        >
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
        </motion.div>
      </React.Fragment>
    ))}
  </div>
);

export const CanvasAnimation = () => (
  <div className={`relative h-full w-full ${THEME.bg} overflow-hidden`}>
    <GridBackground />

    <motion.div
      animate={{ y: [0, 10, 0] }}
      className="-rotate-6 absolute top-12 right-12 h-20 w-16 rounded-lg border border-zinc-800/50 bg-zinc-900/50"
      transition={{
        duration: 8,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
    />

    <motion.div
      animate={{
        x: ["-50%", "-35%", "-35%", "-65%", "-50%"],
        y: ["-50%", "-60%", "-40%", "-40%", "-50%"],
        rotate: [0, 2, -1, -2, 0],
        scale: [1, 1.02, 1, 1.02, 1],
      }}
      className="absolute top-1/2 left-1/2 z-20 flex h-40 w-60 origin-center flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#171717] shadow-2xl"
      transition={{
        duration: 12,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
    >
      <div className="flex h-6 items-center justify-between border-zinc-800 border-b bg-zinc-900/50 px-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-purple-500" />
          <div className="h-1.5 w-10 rounded-full bg-zinc-700" />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-3 divide-x divide-zinc-800/50">
        <div className="bg-zinc-900/20 p-1.5">
          <div className="flex h-full w-full flex-col gap-1 rounded border border-zinc-800/50 border-dashed p-0.5">
            <DummyTask width="w-2/3" />
            <DummyTask width="w-full" />
          </div>
        </div>
        <div className="bg-zinc-900/20 p-1.5">
          <div className="flex h-full w-full flex-col gap-1 rounded border border-zinc-800/50 border-dashed p-0.5">
            <DummyTask color="bg-blue-500" width="w-1/2" />
          </div>
        </div>
        <div className="bg-zinc-900/20 p-1.5">
          <div className="flex h-full w-full flex-col gap-1 rounded border border-zinc-800/50 border-dashed p-0.5">
            <DummyTask color="bg-emerald-500" width="w-3/4" />
          </div>
        </div>
      </div>
      <motion.div
        animate={{ x: [0, 5, 0], y: [0, -5, 0] }}
        className="absolute right-8 bottom-4 z-30"
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      >
        <GrayCursor />
      </motion.div>
    </motion.div>
  </div>
);
