/** biome-ignore-all lint/a11y/noSvgWithoutTitle: TODO: fix acc */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

type Phase =
  | "idle"
  | "cursors-enter"
  | "alex-right-click"
  | "alex-menu-open"
  | "alex-click-create"
  | "alex-spawn-board"
  | "sam-right-click"
  | "sam-menu-open"
  | "sam-click-create"
  | "sam-spawn-board"
  | "alex-creates-task"
  | "alex-submits-task"
  | "alex-leaves"
  | "sam-intercepts"
  | "sam-drags"
  | "sam-drops"
  | "sam-leaves"
  | "taylor-enters"
  | "taylor-comments"
  | "taylor-posts"
  | "taylor-move-close-b2"
  | "taylor-click-close-b2"
  | "taylor-move-drag-b1"
  | "taylor-drag-b1-start"
  | "taylor-drag-b1-move"
  | "reset";

const TRANSITION_SMOOTH = {
  type: "spring",
  stiffness: 50,
  damping: 20,
  mass: 1.2,
} as const;
const TRANSITION_SNAP = {
  type: "spring",
  stiffness: 200,
  damping: 25,
  mass: 1,
} as const;
const TRANSITION_DRAG_HEAVY = {
  type: "tween",
  ease: [0.4, 0.0, 0.2, 1],
  duration: 2.5,
} as const;
const TRANSITION_BOARD_DRAG = {
  type: "tween",
  ease: [0.4, 0.0, 0.2, 1],
  duration: 1.5,
} as const;

const Cursor = ({
  label,
  className,
}: {
  label: string;
  className?: string;
}) => (
  <div className={`relative ${className}`}>
    <svg
      className="relative -top-[3px] -left-[3px] z-10 h-4 w-4 fill-current text-zinc-300 drop-shadow-md sm:h-5 sm:w-5 md:h-6 md:w-6"
      style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.5))" }}
      viewBox="0 0 24 24"
    >
      <path
        d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19135L11.7115 12.3673H5.65376Z"
        stroke="#52525b"
        strokeWidth="1"
      />
    </svg>
    <div className="pointer-events-none absolute top-3 left-2 z-0 whitespace-nowrap rounded-full border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-bold text-[6px] text-zinc-300 shadow-sm sm:top-4 sm:left-3 sm:text-[8px] md:text-[10px]">
      {label}
    </div>
  </div>
);

const ContextMenu = ({
  x,
  y,
  label = "Create Board",
}: {
  x: string | number;
  y: string | number;
  label?: string;
}) => (
  <motion.div
    animate={{ opacity: 1, scale: 1 }}
    className="absolute z-40 flex origin-top-left cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg border border-zinc-800 bg-[#171717] p-1 shadow-xl ring-1 ring-white/10 sm:gap-2"
    exit={{ opacity: 0, scale: 0.95 }}
    initial={{ opacity: 0, scale: 0.9, originX: 0, originY: 0 }}
    style={{ left: x, top: y }}
    transition={{ duration: 0.2 }}
  >
    <div className="flex h-3 w-3 items-center justify-center rounded bg-zinc-800 text-zinc-400 sm:h-4 sm:w-4 md:h-5 md:w-5">
      <svg
        className="h-2 w-2 sm:h-2.5 sm:w-2.5 md:h-3 md:w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        viewBox="0 0 24 24"
      >
        <path d="M12 4v16m8-8H4" />
      </svg>
    </div>
    <span className="whitespace-nowrap pr-1 font-medium text-[6px] text-zinc-300 sm:pr-2 sm:text-[8px] md:text-[10px]">
      {label}
    </span>
  </motion.div>
);

const DummyTask = ({ width = "w-full", color = "bg-zinc-700" }) => (
  <div className="mb-1 rounded border border-zinc-700/30 bg-zinc-800/50 p-0.5 sm:mb-2 sm:p-1 md:p-1.5">
    <div
      className={`h-0.5 sm:h-1 ${color} mb-0.5 rounded-full opacity-40 sm:mb-1`}
      style={{ width: "30%" }}
    />
    <div
      className={`mb-0.5 h-0.5 rounded-full bg-zinc-600 opacity-30 sm:h-1 ${width}`}
    />
  </div>
);

export const HeroAnimation = () => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    let mounted = true;

    const runSequence = async () => {
      const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

      while (mounted) {
        setPhase("idle");
        setInputValue("");
        await wait(1000);

        // 1. SETUP
        setPhase("cursors-enter");
        await wait(1000);
        setPhase("alex-right-click");
        await wait(400);
        setPhase("alex-menu-open");
        await wait(800);
        setPhase("alex-click-create");
        await wait(300);
        setPhase("alex-spawn-board");
        await wait(800);

        setPhase("sam-right-click");
        await wait(400);
        setPhase("sam-menu-open");
        await wait(800);
        setPhase("sam-click-create");
        await wait(300);
        setPhase("sam-spawn-board");
        await wait(800);

        // 2. TASK CREATION
        setPhase("alex-creates-task");
        await wait(1500);
        setPhase("alex-submits-task");
        await wait(400);

        // 3. ALEX EXITS
        setPhase("alex-leaves");
        await wait(600);

        // 4. SAM DRAGS & LEAVES
        setPhase("sam-intercepts");
        await wait(600);
        setPhase("sam-drags");
        await wait(2600);
        setPhase("sam-drops");
        await wait(500);
        setPhase("sam-leaves");
        await wait(500); // Sam goes away

        // 5. TAYLOR COMMENTS
        setPhase("taylor-enters");
        await wait(600);
        setPhase("taylor-comments");
        await wait(1500);
        setPhase("taylor-posts");
        await wait(1000);

        // 6. TAYLOR CLEANUP
        setPhase("taylor-move-close-b2");
        await wait(800);
        setPhase("taylor-click-close-b2");
        await wait(400);

        setPhase("taylor-move-drag-b1");
        await wait(800);
        setPhase("taylor-drag-b1-start");
        await wait(300);
        setPhase("taylor-drag-b1-move");
        await wait(1500);

        // 7. RESET
        setPhase("reset");
        await wait(500);
      }
    };

    runSequence();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let text = "";
    if (phase === "alex-creates-task") {
      text = "Fix Sync Bug";
    }
    if (phase === "taylor-comments") {
      text = "Looks good!";
    }

    if (text) {
      let currentIndex = 0;
      const typeInterval = setInterval(() => {
        setInputValue(text.slice(0, currentIndex + 1));
        // biome-ignore lint/nursery/noIncrementDecrement: just like your ahh
        currentIndex++;
        if (currentIndex >= text.length) {
          clearInterval(typeInterval);
        }
      }, 60);
      return () => clearInterval(typeInterval);
    }
    if (["reset", "cursors-enter"].includes(phase)) {
      setInputValue("");
    }
  }, [phase]);

  const showBoard1 = ![
    "idle",
    "reset",
    "cursors-enter",
    "alex-right-click",
    "alex-menu-open",
    "alex-click-create",
  ].includes(phase);
  const showBoard2 =
    showBoard1 &&
    ![
      "alex-spawn-board",
      "sam-right-click",
      "sam-menu-open",
      "sam-click-create",
      "taylor-click-close-b2",
      "taylor-move-drag-b1",
      "taylor-drag-b1-start",
      "taylor-drag-b1-move",
    ].includes(phase);

  const showAlexMenu = ["alex-menu-open", "alex-click-create"].includes(phase);
  const showSamMenu = ["sam-menu-open", "sam-click-create"].includes(phase);
  const showCreateDialog = ["alex-creates-task", "alex-submits-task"].includes(
    phase
  );
  const showCommentDialog = ["taylor-comments", "taylor-posts"].includes(phase);

  const taskInCol2 = ["sam-intercepts", "sam-drags"].includes(phase);
  const taskFloating = ["sam-drags"].includes(phase);

  // Task lands in Col 3, stays there until Taylor closes board 2
  const taskInCol3 = [
    "sam-drops",
    "sam-leaves",
    "taylor-enters",
    "taylor-comments",
    "taylor-posts",
    "taylor-move-close-b2",
    "taylor-click-close-b2",
    "taylor-move-drag-b1",
    "taylor-drag-b1-start",
    "taylor-drag-b1-move",
  ].includes(phase);

  const isBoard1BeingDragged = ["taylor-drag-b1-move"].includes(phase);
  const isBoard1Grabbed = [
    "taylor-drag-b1-start",
    "taylor-drag-b1-move",
  ].includes(phase);

  const POS = {
    board1: { left: "25%", top: "45%" },
    board2: { left: "75%", top: "58%" },
    board1Header: { left: "25%", top: "38%" },
    board1Exit: { left: "-30%", top: "45%" },
    alexCreate: { left: "25%", top: "45%" },
    samCreate: { left: "75%", top: "58%" },
    col2: { top: "48%", left: "25%" },
    col3: { top: "63%", left: "85%" },
    comment: { top: "73%", left: "88%" },

    closeB2: { left: "83%", top: "48%" },
  };

  const cursorAlex = {
    idle: { top: "110%", left: "20%", opacity: 1 },
    "cursors-enter": { ...POS.alexCreate },
    "alex-right-click": { ...POS.alexCreate, scale: 0.9 },
    "alex-menu-open": { top: "47%", left: "27%" },
    "alex-click-create": { top: "47%", left: "27%", scale: 0.9 },
    "alex-spawn-board": { top: "35%", left: "25%" },

    "sam-right-click": { top: "35%", left: "25%" },
    "sam-menu-open": { top: "35%", left: "25%" },
    "sam-click-create": { top: "35%", left: "25%" },
    "sam-spawn-board": { top: "35%", left: "25%" },

    "alex-creates-task": { ...POS.col2 },
    "alex-submits-task": { top: "55%", left: "28%", scale: 0.9 },
    "alex-leaves": { top: "55%", left: "28%", opacity: 0 },

    reset: { top: "110%", left: "20%", opacity: 1 },
  };

  const cursorSam = {
    idle: { top: "110%", left: "80%" },
    "cursors-enter": { top: "110%", left: "80%" },
    "alex-right-click": { top: "110%", left: "80%" },
    "alex-menu-open": { top: "110%", left: "80%" },
    "alex-click-create": { top: "110%", left: "80%" },
    "alex-spawn-board": { ...POS.samCreate },

    "sam-right-click": { ...POS.samCreate, scale: 0.9 },
    "sam-menu-open": { top: "60%", left: "77%" },
    "sam-click-create": { top: "60%", left: "77%", scale: 0.9 },
    "sam-spawn-board": { top: "58%", left: "83%" },

    "alex-creates-task": { top: "58%", left: "83%" },
    "alex-submits-task": { top: "58%", left: "83%" },
    "alex-leaves": { top: "58%", left: "83%" },

    "sam-intercepts": { ...POS.col2, scale: 0.9, transition: TRANSITION_SNAP },
    "sam-drags": { ...POS.col3, scale: 0.9, transition: TRANSITION_DRAG_HEAVY },
    "sam-drops": { ...POS.col3, scale: 1 },

    "sam-leaves": { ...POS.col3, opacity: 0 },

    "taylor-enters": { opacity: 0 },
    "taylor-comments": { opacity: 0 },
    "taylor-posts": { opacity: 0 },
    "taylor-move-close-b2": { opacity: 0 },
    reset: { top: "110%", left: "90%", opacity: 1 },
  };

  const cursorTaylor = {
    idle: { top: "110%", left: "-10%", opacity: 0 },
    "cursors-enter": { opacity: 0 },
    "alex-right-click": { opacity: 0 },
    "sam-right-click": { opacity: 0 },
    "alex-creates-task": { opacity: 0 },
    "sam-drags": { opacity: 0 },
    "sam-drops": { opacity: 0 },
    "sam-leaves": { opacity: 0 },

    "taylor-enters": { ...POS.comment, opacity: 1 },
    "taylor-comments": { ...POS.comment, scale: 1, opacity: 1 },
    "taylor-posts": { ...POS.comment, scale: 0.9, opacity: 1 },

    "taylor-move-close-b2": { ...POS.closeB2, scale: 1, opacity: 1 },
    "taylor-click-close-b2": { ...POS.closeB2, scale: 0.9, opacity: 1 },

    "taylor-move-drag-b1": { ...POS.board1Header, scale: 1, opacity: 1 },
    "taylor-drag-b1-start": { ...POS.board1Header, scale: 0.9, opacity: 1 },
    "taylor-drag-b1-move": {
      ...POS.board1Exit,
      scale: 0.9,
      transition: TRANSITION_BOARD_DRAG,
      opacity: 1,
    },

    reset: { top: "110%", left: "-10%", opacity: 0 },
  };

  const floatingTask = {
    "sam-intercepts": { ...POS.col2, scale: 1, opacity: 1, rotate: 0 },
    "sam-drags": {
      ...POS.col3,
      scale: 1.05,
      opacity: 1,
      rotate: 3,
      transition: TRANSITION_DRAG_HEAVY,
    },
  };

  return (
    <div className="perspective-[1000px] relative h-full w-full select-none overflow-hidden bg-[#1a1a1a] font-sans">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-size-[32px_32px] opacity-10" />
      </div>

      <AnimatePresence>
        {showAlexMenu && (
          <ContextMenu
            key="ctx-1"
            x={POS.alexCreate.left}
            y={POS.alexCreate.top}
          />
        )}
        {showSamMenu && (
          <ContextMenu
            key="ctx-2"
            x={POS.samCreate.left}
            y={POS.samCreate.top}
          />
        )}

        {/* === BOARD 1 (ALEX) === */}
        {showBoard1 && (
          <motion.div
            animate={
              isBoard1BeingDragged
                ? { ...POS.board1Exit, scale: 1.05, rotate: -5, opacity: 0 }
                : isBoard1Grabbed
                  ? { ...POS.board1, scale: 1.05, zIndex: 50 }
                  : { opacity: 1, scale: 1, ...POS.board1 }
            }
            className="absolute z-10 flex h-25 w-35 origin-center flex-col overflow-hidden rounded-lg border border-zinc-800 bg-[#171717] shadow-2xl sm:h-40 sm:w-55 sm:rounded-xl md:h-55 md:w-75"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0, scale: 0.9, ...POS.board1 }}
            key="board-1"
            style={{ x: "-50%", y: "-50%" }}
            transition={
              isBoard1BeingDragged ? TRANSITION_BOARD_DRAG : TRANSITION_SMOOTH
            }
          >
            <div className="flex h-4 cursor-grab items-center justify-between border-zinc-800 border-b bg-zinc-800/30 px-2 active:cursor-grabbing sm:h-6 sm:px-3 md:h-8">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] sm:h-1.5 sm:w-1.5 md:h-2 md:w-2" />
                <span className="font-bold font-mono text-[6px] text-zinc-400 tracking-widest sm:text-[8px] md:text-[10px]">
                  BACKLOG
                </span>
              </div>
            </div>

            <div className="grid flex-1 grid-cols-3 gap-0 divide-x divide-zinc-800/50 p-0">
              <div className="relative flex flex-col bg-zinc-900/10 p-1 sm:p-2">
                <div className="mb-1 font-mono text-[5px] text-zinc-600 sm:mb-2 sm:text-[6px] md:text-[8px]">
                  TODO
                </div>
                <DummyTask width="w-3/4" />
                <DummyTask width="w-1/2" />
              </div>

              {/* DOING COL (Middle) */}
              <div className="relative border-zinc-800/50 border-r bg-zinc-900/10 p-1 sm:p-2">
                <div className="mb-1 font-mono text-[5px] text-zinc-600 sm:mb-2 sm:text-[6px] md:text-[8px]">
                  DOING
                </div>

                <motion.div
                  animate={
                    phase === "alex-creates-task"
                      ? { backgroundColor: "rgba(39, 39, 42, 1)" }
                      : { backgroundColor: "transparent" }
                  }
                  className="mb-1 flex h-3 items-center justify-center rounded border border-zinc-800 border-dashed text-zinc-600 sm:mb-2 sm:h-4 md:h-6"
                >
                  <svg
                    className="h-2 w-2 sm:h-3 sm:w-3 md:h-4 md:w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </motion.div>

                {taskInCol2 && phase !== "sam-drags" && (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded border border-zinc-700/50 bg-[#171717] p-0.5 shadow-sm sm:p-1 md:p-1.5"
                    initial={{ opacity: 0, y: 10 }}
                  >
                    <div className="mb-0.5 h-0.5 w-4 rounded-full bg-emerald-500/50 sm:mb-1 sm:h-1 sm:w-6 md:w-8" />
                    <div className="mb-0.5 h-0.5 w-full rounded-full bg-zinc-600 sm:h-1" />
                    <div className="h-0.5 w-2/3 rounded-full bg-zinc-600 sm:h-1" />
                  </motion.div>
                )}
                <DummyTask color="bg-blue-500" width="w-full" />
              </div>

              <div className="bg-zinc-900/10 p-1 sm:p-2">
                <div className="mb-1 font-mono text-[5px] text-zinc-600 sm:mb-2 sm:text-[6px] md:text-[8px]">
                  DONE
                </div>
                <DummyTask color="bg-green-500" width="w-2/3" />
              </div>
            </div>

            <AnimatePresence>
              {showCreateDialog && (
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px]"
                  exit={{ opacity: 0, scale: 0.9 }}
                  initial={{ opacity: 0, scale: 0.9 }}
                >
                  <div className="flex w-24 flex-col gap-1 rounded-lg border border-zinc-800 bg-[#171717] p-1.5 shadow-2xl ring-1 ring-white/5 sm:w-32 sm:gap-2 sm:p-2 md:w-48 md:p-3">
                    <div className="font-mono text-[6px] text-zinc-500 sm:text-[8px] md:text-[10px]">
                      New Issue
                    </div>
                    <div className="flex h-4 items-center overflow-hidden rounded border border-zinc-800 bg-black px-1 sm:h-5 sm:px-2 md:h-6">
                      <span className="whitespace-nowrap font-mono text-[6px] text-zinc-200 sm:text-[8px] md:text-[10px]">
                        {inputValue}
                      </span>
                      <span className="ml-0.5 h-2 w-0.5 animate-pulse bg-emerald-500 sm:h-2.5 md:h-3" />
                    </div>
                    <div className="mt-0.5 flex justify-end sm:mt-1">
                      <motion.div
                        animate={
                          phase === "alex-submits-task"
                            ? { scale: 0.9 }
                            : { scale: 1 }
                        }
                        className="rounded bg-zinc-200 px-1.5 py-0.5 font-bold text-[#171717] text-[5px] sm:px-2 sm:py-1 sm:text-[6px] md:text-[8px]"
                      >
                        Create
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* === BOARD 2 (SAM) === */}
        {showBoard2 && (
          <motion.div
            animate={{ opacity: 1, scale: 1, ...POS.board2 }}
            className="absolute z-0 flex h-[100px] w-[140px] flex-col overflow-visible rounded-lg border border-zinc-800 bg-[#171717] shadow-2xl sm:h-40 sm:w-[220px] sm:rounded-xl md:h-[220px] md:w-[300px]"
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            initial={{ opacity: 0, scale: 0.9, ...POS.board2 }}
            key="board-2"
            style={{ x: "-50%", y: "-50%" }}
            transition={TRANSITION_SMOOTH}
          >
            <div className="flex h-4 items-center justify-between border-zinc-800 border-b bg-zinc-800/30 px-2 sm:h-6 sm:px-3 md:h-8">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="h-1 w-1 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)] sm:h-1.5 sm:w-1.5 md:h-2 md:w-2" />
                <span className="font-bold font-mono text-[6px] text-zinc-400 tracking-widest sm:text-[8px] md:text-[10px]">
                  SPRINT
                </span>
              </div>
              <motion.div
                animate={
                  phase === "taylor-click-close-b2"
                    ? { scale: 0.8, backgroundColor: "rgba(63, 63, 70, 0.5)" }
                    : { scale: 1 }
                }
                className="flex h-2 w-2 items-center justify-center rounded transition-colors hover:bg-zinc-800 sm:h-3 sm:w-3 md:h-4 md:w-4"
              >
                <svg
                  className="h-1.5 w-1.5 text-zinc-600 sm:h-2 sm:w-2 md:h-3 md:w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </motion.div>
            </div>
            <div className="relative grid flex-1 grid-cols-3 gap-0 divide-x divide-zinc-800/50 p-0">
              <div className="flex flex-col bg-zinc-900/10 p-1 sm:p-2">
                <div className="mb-1 font-mono text-[5px] text-zinc-600 sm:mb-2 sm:text-[6px] md:text-[8px]">
                  TODO
                </div>
                <DummyTask width="w-2/3" />
              </div>
              <div className="flex flex-col bg-zinc-900/10 p-1 sm:p-2">
                <div className="mb-1 font-mono text-[5px] text-zinc-600 sm:mb-2 sm:text-[6px] md:text-[8px]">
                  DOING
                </div>
                <DummyTask color="bg-orange-500" width="w-full" />
              </div>
              <div className="relative flex flex-col bg-zinc-900/10 p-1 sm:p-2">
                <div className="mb-1 font-mono text-[5px] text-zinc-600 sm:mb-2 sm:text-[6px] md:text-[8px]">
                  DONE
                </div>
                <DummyTask color="bg-green-500" width="w-1/2" />

                {taskInCol3 && (
                  <motion.div
                    className="relative rounded border border-zinc-700/50 bg-[#171717] p-0.5 shadow-sm sm:p-1 md:p-1.5"
                    layoutId="task-card"
                  >
                    <div className="mb-0.5 h-0.5 w-4 rounded-full bg-emerald-500/50 sm:mb-1 sm:h-1 sm:w-6 md:w-8" />
                    <div className="mb-0.5 h-0.5 w-full rounded-full bg-zinc-600 sm:h-1" />
                    <div className="h-0.5 w-2/3 rounded-full bg-zinc-600 sm:h-1" />
                    {phase === "taylor-posts" ||
                    phase.includes("close") ||
                    phase.includes("drag") ? (
                      <motion.div
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 flex h-1.5 w-1.5 items-center justify-center rounded-full border border-zinc-800 bg-purple-500 sm:h-2 sm:w-2 md:h-3 md:w-3"
                        initial={{ scale: 0 }}
                      >
                        <div className="h-0.5 w-0.5 rounded-full bg-white md:h-1 md:w-1" />
                      </motion.div>
                    ) : null}
                  </motion.div>
                )}

                <AnimatePresence>
                  {showCommentDialog && (
                    <motion.div
                      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                      className="absolute top-5 -left-2.5 z-50 w-20 rounded-lg border border-zinc-800 bg-[#171717] p-1 shadow-2xl ring-1 ring-white/10 sm:top-8 sm:left-[-15px] sm:w-24 sm:p-1.5 md:top-10 md:-left-5 md:w-32 md:p-2"
                      exit={{ opacity: 0, scale: 0.9 }}
                      initial={{ opacity: 0, y: 5, x: 10, scale: 0.9 }}
                    >
                      <div className="mb-0.5 flex items-center gap-1 sm:mb-1">
                        <div className="flex h-2 w-2 items-center justify-center rounded-full bg-purple-500 font-bold text-[4px] text-white sm:h-2.5 sm:w-2.5 sm:text-[5px] md:h-3 md:w-3 md:text-[6px]">
                          T
                        </div>
                        <span className="text-[5px] text-zinc-400 sm:text-[6px] md:text-[8px]">
                          Taylor
                        </span>
                      </div>
                      <div className="mb-0.5 min-h-2.5 rounded border border-zinc-900 bg-black p-0.5 sm:mb-1 sm:min-h-3.5 sm:p-1 md:min-h-4 md:p-1.5">
                        <span className="text-[5px] text-zinc-200 sm:text-[6px] md:text-[8px]">
                          {inputValue}
                        </span>
                        <span className="ml-0.5 inline-block h-1.5 w-0.5 animate-pulse bg-purple-500 align-middle sm:h-2" />
                      </div>
                      <motion.div
                        animate={
                          phase === "taylor-posts"
                            ? { scale: 0.9 }
                            : { scale: 1 }
                        }
                        className="w-full rounded bg-zinc-800 py-0.5 text-center font-medium text-[4px] text-zinc-300 sm:text-[5px] md:text-[7px]"
                      >
                        Comment
                      </motion.div>
                      <div className="absolute -top-1 left-4 h-1.5 w-1.5 rotate-45 transform border-zinc-800 border-t border-l bg-[#171717] sm:h-2 sm:w-2" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === FLOATING DRAGGED TASK === */}
      {taskFloating && (
        <motion.div
          animate="sam-drags"
          className="pointer-events-none absolute z-50 w-9 origin-top-left rounded border border-blue-500/50 bg-[#171717] p-0.5 shadow-2xl sm:w-14 sm:p-1 md:w-20 md:p-1.5"
          initial="sam-intercepts"
          layoutId="task-card"
          style={{ marginLeft: 10, marginTop: 10 }}
          variants={floatingTask}
        >
          <div className="mb-0.5 h-0.5 w-4 rounded-full bg-emerald-500/50 sm:mb-1 sm:h-1 sm:w-6 md:w-8" />
          <div className="mb-0.5 h-0.5 w-full rounded-full bg-zinc-600 sm:h-1" />
          <div className="h-0.5 w-2/3 rounded-full bg-zinc-600 sm:h-1" />
          <div className="absolute -top-1.5 -right-1.5 rounded-full bg-blue-500/80 px-1 py-0.5 font-bold text-[5px] text-white shadow-sm backdrop-blur-sm sm:-top-2 sm:-right-2 sm:px-1.5 sm:text-[6px] md:text-[8px]">
            Sam
          </div>
        </motion.div>
      )}

      {/* === CURSORS (Gray) === */}
      <motion.div
        animate={phase}
        className="pointer-events-none absolute z-100"
        initial="idle"
        transition={TRANSITION_SMOOTH}
        variants={cursorAlex}
      >
        <Cursor label="Alex" />
      </motion.div>

      <motion.div
        animate={phase}
        className="pointer-events-none absolute z-100"
        initial="idle"
        transition={TRANSITION_SMOOTH}
        variants={cursorSam}
      >
        <Cursor label="Sam" />
      </motion.div>

      <motion.div
        animate={phase}
        className="pointer-events-none absolute z-100"
        initial="idle"
        transition={TRANSITION_SMOOTH}
        variants={cursorTaylor}
      >
        <Cursor label="Taylor" />
      </motion.div>
    </div>
  );
};
