import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, GripVertical, Pencil, Plug, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

type Phase =
  | "idle"
  | "ide-typing-code"
  | "ide-typing-prompt"
  | "ide-click-mcp"
  | "ide-click-send"
  | "switch-to-canvas"
  | "canvas-focus"
  | "canvas-task-action"
  | "switch-to-ide"
  | "show-success"
  | "reset";

const TRANSITION_SMOOTH = {
  type: "spring",
  stiffness: 50,
  damping: 20,
  mass: 1.2,
} as const;

const TRANSITION_CAMERA = {
  type: "spring",
  stiffness: 40,
  damping: 20,
  mass: 1.5,
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
      className="-top-[3px] -left-[3px] relative z-10 h-4 w-4 fill-current text-zinc-300 drop-shadow-md sm:h-5 sm:w-5 md:h-6 md:w-6"
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

// Mock Board Component based on apps/web/src/features/kanban/components/board-node.tsx
const Board = ({ 
  title, 
  tasks = [], 
  activeTaskIndex = -1,
  phase,
  isTarget = false
}: { 
  title: string; 
  tasks?: string[]; 
  activeTaskIndex?: number;
  phase?: Phase;
  isTarget?: boolean;
}) => {
  return (
    <div className="h-full w-[400px] overflow-hidden rounded bg-zinc-900 border-2 border-zinc-800 shadow-xl flex flex-col">
      {/* Header */}
      <div className="group flex items-center justify-between gap-1.5 rounded-t border-b border-zinc-800 bg-zinc-800/50 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <div className="flex min-w-0 items-center gap-1">
            <h3 className="truncate font-semibold text-zinc-200 text-xs">
              {title}
            </h3>
            <Pencil className="h-2.5 w-2.5 text-zinc-500 opacity-50" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 flex items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
             <Plus className="h-3 w-3" />
          </div>
          <X className="h-3 w-3 text-zinc-500" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 space-y-3 overflow-hidden bg-[#171717]">
        {/* Columns */}
        <div className="grid grid-cols-3 gap-2 h-full">
          {/* To Do Column */}
          <div className="flex flex-col gap-2 min-w-[100px]">
            <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider mb-1">To Do</div>
            {tasks.map((task, i) => {
              const isActive = isTarget && i === activeTaskIndex;
              const isCompleted = isActive && phase === "canvas-task-action";
              
              return (
                <motion.div
                  key={i}
                  animate={isCompleted ? { 
                    opacity: 0, 
                    scale: 0.8,
                    x: 20,
                    filter: "blur(2px)"
                  } : { 
                    opacity: 1, 
                    scale: 1,
                    x: 0,
                    filter: "blur(0px)"
                  }}
                  className="bg-zinc-800/50 border border-zinc-700/50 rounded p-2 text-[10px] text-zinc-300 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span>{task}</span>
                    {isActive && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-1.5 w-1.5 rounded-full bg-blue-500" 
                      />
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <div className="h-1 w-4 rounded-full bg-zinc-700" />
                    <div className="h-3 w-3 rounded-full bg-zinc-700 ml-auto" />
                  </div>
                </motion.div>
              );
            })}
             {/* Placeholder tasks for visual density */}
             {!isTarget && (
                <>
                  <div className="bg-zinc-800/30 border border-zinc-800 rounded p-2 h-12" />
                  <div className="bg-zinc-800/30 border border-zinc-800 rounded p-2 h-16" />
                </>
             )}
          </div>
          
          {/* In Progress Column (Visual only) */}
          <div className="flex flex-col gap-2 min-w-[100px] opacity-50">
            <div className="text-[9px] font-medium text-zinc-600 uppercase tracking-wider mb-1">In Progress</div>
             <div className="bg-zinc-800/30 border border-zinc-800 rounded p-2 h-20" />
          </div>

          {/* Done Column (Visual only) */}
          <div className="flex flex-col gap-2 min-w-[100px] opacity-50">
            <div className="text-[9px] font-medium text-zinc-600 uppercase tracking-wider mb-1">Done</div>
             <div className="bg-zinc-800/30 border border-zinc-800 rounded p-2 h-14" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const MCPAnimation = () => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [codeValue, setCodeValue] = useState("");
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    let mounted = true;

    const runSequence = async () => {
      const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

      while (mounted) {
        setPhase("idle");
        setCodeValue("");
        setPromptValue("");
        await wait(1000);

        // 1. User types code
        setPhase("ide-typing-code");
        await wait(2000);

        // 2. User types prompt
        setPhase("ide-typing-prompt");
        await wait(3500);

        // 3. Click MCP
        setPhase("ide-click-mcp");
        await wait(2000);

        // 4. Click Send
        setPhase("ide-click-send");
        await wait(800);

        // 5. Switch to Canvas Overview
        setPhase("switch-to-canvas");
        await wait(2000); // Give time to see the overview

        // 6. Focus on Target Board
        setPhase("canvas-focus");
        await wait(2500);

        // 7. Task Action (Cutout/Complete)
        setPhase("canvas-task-action");
        await wait(3000);

        // 8. Switch back to IDE
        setPhase("switch-to-ide");
        await wait(1000);

        // 9. Show Success
        setPhase("show-success");
        await wait(2000);

        // Reset
        setPhase("reset");
        await wait(500);
      }
    };

    runSequence();
    return () => {
      mounted = false;
    };
  }, []);

  // Typing effect for code
  useEffect(() => {
    if (phase === "ide-typing-code") {
      const text = "const task = 'Update Todo';";
      let currentIndex = 0;
      const interval = setInterval(() => {
        setCodeValue(text.slice(0, currentIndex + 1));
        currentIndex++;
        if (currentIndex >= text.length) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [phase]);

  // Typing effect for prompt
  useEffect(() => {
    if (phase === "ide-typing-prompt") {
      const text = "Mark 'Update Todo' as done in workspace.";
      if (promptValue === text) return;
      let currentIndex = 0;
      const interval = setInterval(() => {
        setPromptValue(text.slice(0, currentIndex + 1));
        currentIndex++;
        if (currentIndex >= text.length) clearInterval(interval);
      }, 70);
      return () => clearInterval(interval);
    }
  }, [phase]);

  const isCanvasVisible = [
    "switch-to-canvas",
    "canvas-focus",
    "canvas-task-action",
  ].includes(phase);

  const isSuccessVisible = ["show-success"].includes(phase);

  const cursorVariants = {
    idle: { top: "110%", left: "50%", opacity: 1 },
    "ide-typing-code": { top: "30%", left: "30%", opacity: 1 },
    "ide-typing-prompt": { top: "85%", left: "85%", opacity: 1 },
    "ide-click-mcp": { top: "82%", left: "78%", scale: 0.9 },
    "ide-click-send": { top: "82%", left: "92%", scale: 0.9 },
    "switch-to-canvas": { top: "50%", left: "50%", opacity: 0 },
    "canvas-focus": { top: "50%", left: "50%", opacity: 0 },
    "canvas-task-action": { top: "50%", left: "50%", opacity: 0 },
    "switch-to-ide": { top: "50%", left: "50%", opacity: 0 },
    "show-success": { top: "90%", left: "10%", opacity: 1 },
    reset: { top: "110%", left: "50%", opacity: 1 },
  };

  // Camera transform for canvas
  const getCanvasTransform = () => {
    if (phase === "canvas-focus" || phase === "canvas-task-action") {
      // Focus on Board 2 (Bottom Right)
      // Board 2 is at top: 60%, left: 60%
      // To center it (50%, 50%), we need to shift:
      // x: 50 - 60 = -10%
      // y: 50 - 60 = -10%
      // But with scale 2, the shift needs to be adjusted.
      // Let's try a simple offset based on visual estimation.
      return {
        scale: 2,
        x: "-20%", 
        y: "-20%", 
      };
    }
    // Overview state
    return {
      scale: 0.5, // Zoom out more to see the spread out boards
      x: "0%",
      y: "0%",
    };
  };

  const canvasTransform = getCanvasTransform();

  return (
    <div className="perspective-[1000px] relative h-full w-full select-none overflow-hidden bg-[#1a1a1a] font-sans">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-size-[32px_32px] opacity-10" />
      </div>

      {/* IDE Window */}
      <motion.div
        animate={{
          scale: isCanvasVisible ? 0.8 : 1,
          opacity: isCanvasVisible ? 0 : 1,
          x: isCanvasVisible ? "-20%" : "0%",
          filter: isCanvasVisible ? "blur(4px)" : "blur(0px)",
        }}
        className="absolute inset-4 flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#1e1e1e] shadow-2xl z-10"
        transition={TRANSITION_SMOOTH}
      >
        {/* IDE Header */}
        <div className="flex h-8 shrink-0 items-center border-b border-zinc-800 bg-zinc-900 px-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/20" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/20" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/20" />
          </div>
          <div className="ml-4 text-[10px] text-zinc-500 font-mono">
            workspace/task.ts
          </div>
        </div>

        {/* IDE Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar (Files) */}
          <div className="w-12 border-r border-zinc-800 bg-zinc-900/50 hidden sm:block shrink-0" />
          
          {/* Code Area */}
          <div className="flex-1 p-4 font-mono text-[10px] sm:text-xs text-zinc-300 overflow-hidden">
            <div className="text-zinc-500">// TODO: Implement task update</div>
            <div className="mt-2">
              <span className="text-purple-400">const</span>{" "}
              <span className="text-blue-400">updateTask</span> = () ={">"} {"{"}
            </div>
            <div className="ml-4 mt-1">
              {codeValue}
              <span className="animate-pulse inline-block w-1.5 h-3 bg-zinc-500 align-middle ml-0.5" />
            </div>
            <div className="mt-1">{"}"}</div>
          </div>

          {/* Right Sidebar (Agent) */}
          <div className="w-1/3 min-w-[180px] max-w-[250px] border-l border-zinc-800 bg-zinc-900/30 flex flex-col backdrop-blur-sm">
             {/* Agent Header */}
             <div className="flex items-center justify-between border-b border-zinc-800/50 p-2">
                <span className="text-[10px] font-medium text-zinc-400">Agent</span>
                <div className="flex gap-1">
                   <div className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                   <div className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                </div>
             </div>

             {/* Chat History */}
             <div className="flex-1 p-2 overflow-y-auto space-y-3">
                {/* Agent greeting */}
                <div className="flex flex-col gap-1">
                   <div className="self-start rounded-lg rounded-tl-none bg-zinc-800 px-2 py-1 text-[9px] text-zinc-300">
                      Hello, how can I help you?
                   </div>
                </div>
             </div>

             {/* Input Area */}
             <div className="p-2 border-t border-zinc-800/50 bg-zinc-900/50">
                <div className="relative rounded-md border border-zinc-700/50 bg-black/40 p-2">
                   <div className="font-mono text-[9px] text-zinc-300 min-h-[40px] whitespace-pre-wrap break-words">
                      {promptValue}
                      {phase === "ide-typing-prompt" && (
                        <span className="animate-pulse inline-block w-1.5 h-2.5 bg-zinc-500 align-middle ml-0.5" />
                      )}
                   </div>
                   
                   {/* Action Buttons */}
                   <div className="absolute bottom-1 right-1 flex items-center gap-1">
                      {/* MCP Button & Dropdown */}
                      <div className="relative">
                         <motion.button
                           animate={phase === "ide-click-mcp" ? { scale: 0.9, backgroundColor: "#3b82f6" } : { scale: 1, backgroundColor: "#27272a" }}
                           className="flex items-center justify-center h-5 w-5 rounded bg-zinc-800 text-blue-400 transition-colors hover:bg-zinc-700"
                         >
                            <Plug className="h-2.5 w-2.5" />
                         </motion.button>
                         
                         {/* Dropdown Menu */}
                         <AnimatePresence>
                            {phase === "ide-click-mcp" && (
                            <motion.div
                               initial={{ opacity: 0, scale: 0.9, y: 5 }}
                               animate={{ opacity: 1, scale: 1, y: 0 }}
                               exit={{ opacity: 0, scale: 0.9, y: 5 }}
                               className="absolute bottom-full right-0 mb-1 w-24 rounded border border-zinc-700 bg-zinc-800 shadow-xl overflow-hidden z-20"
                            >
                               <div className="px-2 py-1 text-[8px] font-medium text-zinc-500 border-b border-zinc-700/50">TOOLS</div>
                               <div className="flex items-center gap-1.5 px-2 py-1.5 bg-blue-500/20 text-[9px] text-blue-200">
                                  <Plug className="h-2 w-2 text-blue-400" />
                                  Lumen
                               </div>
                               <div className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] text-zinc-400">
                                  <Plug className="h-2 w-2 text-purple-400" />
                                  Search
                               </div>
                            </motion.div>
                            )}
                         </AnimatePresence>
                      </div>
                      
                      {/* Send Button */}
                      <motion.button
                        animate={phase === "ide-click-send" ? { scale: 0.9, backgroundColor: "#3b82f6" } : { scale: 1, backgroundColor: "#27272a" }}
                        className="flex items-center justify-center h-5 w-5 rounded bg-zinc-800 text-blue-400 transition-colors hover:bg-zinc-700"
                      >
                         <ArrowUp className="h-2.5 w-2.5" />
                      </motion.button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </motion.div>

      {/* Lumen Canvas (Background/Overlay) */}
      <motion.div
        animate={{
          opacity: isCanvasVisible ? 1 : 0,
          zIndex: isCanvasVisible ? 20 : 0,
          pointerEvents: isCanvasVisible ? "auto" : "none",
        }}
        className="absolute inset-0 overflow-hidden bg-[#09090b]"
        initial={{ opacity: 0 }}
        transition={TRANSITION_SMOOTH}
      >
        {/* Dot Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:20px_20px] opacity-20" />

        {/* Canvas Container for Camera Movement */}
        <motion.div
          animate={canvasTransform}
          transition={TRANSITION_CAMERA}
          className="absolute inset-0 flex items-center justify-center w-full h-full origin-center"
        >
          <div className="relative w-[200%] h-[200%] flex items-center justify-center">
             {/* Connection Lines (SVG) */}
             <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                {/* Line from Board 1 (Top Center) to Board 2 (Bottom Right) */}
                <path d="M 50% 30% C 50% 45%, 60% 45%, 60% 60%" stroke="#52525b" strokeWidth="2" fill="none" />
                {/* Line from Board 1 (Top Center) to Board 3 (Bottom Left) */}
                <path d="M 50% 30% C 50% 45%, 40% 45%, 40% 60%" stroke="#52525b" strokeWidth="2" fill="none" />
             </svg>

             {/* Board 1 (Top Center) */}
             <div className="absolute top-[20%] left-[40%]">
                <Board title="Design System" tasks={["Typography", "Colors", "Components"]} />
             </div>

             {/* Board 2 (Target - Bottom Right) */}
             <div className="absolute top-[60%] left-[60%]">
                <Board 
                  title="Backend API" 
                  tasks={["Auth Middleware", "Update Todo", "DB Schema"]} 
                  activeTaskIndex={1}
                  phase={phase}
                  isTarget={true}
                />
             </div>

             {/* Board 3 (Bottom Left) */}
             <div className="absolute top-[60%] left-[20%]">
                <Board title="Frontend" tasks={["Landing Page", "Dashboard", "Settings"]} />
             </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Success Popup - Moved to Bottom Left */}
      <AnimatePresence>
        {isSuccessVisible && (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute bottom-8 left-8 z-50 flex items-center gap-2 rounded-lg border border-green-500/20 bg-zinc-900 p-3 shadow-2xl ring-1 ring-green-500/20"
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20 text-green-500">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-xs font-medium text-zinc-200">Updated successfully</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cursor */}
      <motion.div
        animate={phase}
        className="pointer-events-none absolute z-50"
        initial="idle"
        transition={TRANSITION_SMOOTH}
        variants={cursorVariants}
      >
        <Cursor label="User" />
      </motion.div>
    </div>
  );
};

