import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

type Phase =
  | "idle"
  | "ide-typing-code"
  | "ide-typing-prompt"
  | "ide-click-mcp"
  | "switch-to-canvas"
  | "canvas-update"
  | "switch-to-ide"
  | "show-success"
  | "reset";

const TRANSITION_SMOOTH = {
  type: "spring",
  stiffness: 50,
  damping: 20,
  mass: 1.2,
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
        await wait(2500);

        // 3. Click MCP
        setPhase("ide-click-mcp");
        await wait(800);

        // 4. Switch to Canvas
        setPhase("switch-to-canvas");
        await wait(1000);

        // 5. Canvas Update
        setPhase("canvas-update");
        await wait(1500);

        // 6. Switch back to IDE
        setPhase("switch-to-ide");
        await wait(1000);

        // 7. Show Success
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
      let currentIndex = 0;
      const interval = setInterval(() => {
        setPromptValue(text.slice(0, currentIndex + 1));
        currentIndex++;
        if (currentIndex >= text.length) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [phase]);

  const isCanvasFocused = [
    "switch-to-canvas",
    "canvas-update",
  ].includes(phase);

  const isSuccessVisible = ["show-success"].includes(phase);

  const cursorVariants = {
    idle: { top: "110%", left: "50%", opacity: 1 },
    "ide-typing-code": { top: "30%", left: "30%", opacity: 1 },
    "ide-typing-prompt": { top: "85%", left: "80%", opacity: 1 },
    "ide-click-mcp": { top: "8%", left: "90%", scale: 0.9 },
    "switch-to-canvas": { top: "50%", left: "50%", opacity: 0 }, // Hide cursor during transition
    "canvas-update": { top: "50%", left: "50%", opacity: 0 },
    "switch-to-ide": { top: "50%", left: "50%", opacity: 0 },
    "show-success": { top: "80%", left: "80%", opacity: 1 },
    reset: { top: "110%", left: "50%", opacity: 1 },
  };

  return (
    <div className="perspective-[1000px] relative h-full w-full select-none overflow-hidden bg-[#1a1a1a] font-sans">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-size-[32px_32px] opacity-10" />
      </div>

      {/* IDE Window */}
      <motion.div
        animate={{
          scale: isCanvasFocused ? 0.8 : 1,
          opacity: isCanvasFocused ? 0.5 : 1,
          x: isCanvasFocused ? "-20%" : "0%",
          filter: isCanvasFocused ? "blur(2px)" : "blur(0px)",
        }}
        className="absolute inset-4 flex overflow-hidden rounded-xl border border-zinc-800 bg-[#1e1e1e] shadow-2xl"
        transition={TRANSITION_SMOOTH}
      >
        {/* Left Side: Code Editor */}
        <div className="flex flex-1 flex-col border-r border-zinc-800">
          {/* IDE Header */}
          <div className="flex h-8 items-center border-b border-zinc-800 bg-zinc-900 px-3">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/20" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/20" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500/20" />
            </div>
            <div className="ml-4 text-[10px] text-zinc-500 font-mono">
              workspace/task.ts
            </div>
          </div>

          {/* Code Area */}
          <div className="flex-1 p-4 font-mono text-[10px] sm:text-xs text-zinc-300">
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
        </div>

        {/* Right Side: Agent Sidebar */}
        <div className="w-1/3 min-w-[150px] bg-zinc-900/50 flex flex-col">
          {/* Agent Header */}
          <div className="flex h-8 items-center justify-between border-b border-zinc-800 px-3">
            <span className="text-[10px] font-medium text-zinc-400">Agent</span>
            <div className="flex gap-2">
               <motion.button
                animate={phase === "ide-click-mcp" ? { scale: 0.9, backgroundColor: "#3b82f6" } : { scale: 1, backgroundColor: "#27272a" }}
                className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[8px] text-white transition-colors"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                MCP
              </motion.button>
            </div>
          </div>

          {/* Chat Area (Empty for now, could add chat bubbles later) */}
          <div className="flex-1 p-3">
             {/* Placeholder for chat history */}
          </div>

          {/* Prompt Input Area */}
          <div className="p-3 border-t border-zinc-800 bg-zinc-900/80">
            <div className="rounded border border-zinc-800 bg-black/50 p-2 font-mono text-[10px] text-zinc-300 min-h-[60px]">
              <span className="text-green-500">{">"}</span> {promptValue}
              {phase === "ide-typing-prompt" && (
                <span className="animate-pulse inline-block w-1.5 h-3 bg-zinc-500 align-middle ml-0.5" />
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Lumen Canvas (Background/Overlay) */}
      <motion.div
        animate={{
          scale: isCanvasFocused ? 1 : 0.8,
          opacity: isCanvasFocused ? 1 : 0,
          x: isCanvasFocused ? "0%" : "20%",
          zIndex: isCanvasFocused ? 20 : 0,
          pointerEvents: isCanvasFocused ? "auto" : "none",
        }}
        className="absolute inset-4 flex items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-[#171717] shadow-2xl"
        initial={{ opacity: 0, scale: 0.8, x: "20%" }}
        transition={TRANSITION_SMOOTH}
      >
        <div className="w-64 rounded-lg border border-zinc-800 bg-zinc-900 p-4 shadow-xl">
          <div className="mb-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">Todo List</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded bg-zinc-800/50 p-2 text-[10px] text-zinc-300">
              <div className="h-3 w-3 rounded border border-zinc-600" />
              <span>Design System</span>
            </div>
            <motion.div 
              animate={phase === "canvas-update" ? { opacity: 0.5, textDecoration: "line-through" } : {}}
              className="flex items-center gap-2 rounded bg-zinc-800/50 p-2 text-[10px] text-zinc-300"
            >
               <motion.div 
                 animate={phase === "canvas-update" ? { backgroundColor: "#10b981", borderColor: "#10b981" } : {}}
                 className="h-3 w-3 rounded border border-zinc-600 flex items-center justify-center"
               >
                 {phase === "canvas-update" && (
                   <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                     <path d="M20 6L9 17l-5-5" />
                   </svg>
                 )}
               </motion.div>
              <span>Update Todo</span>
            </motion.div>
            <div className="flex items-center gap-2 rounded bg-zinc-800/50 p-2 text-[10px] text-zinc-300">
              <div className="h-3 w-3 rounded border border-zinc-600" />
              <span>API Integration</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Success Popup */}
      <AnimatePresence>
        {isSuccessVisible && (
          <motion.div
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute bottom-8 right-8 z-50 flex items-center gap-2 rounded-lg border border-green-500/20 bg-zinc-900 p-3 shadow-2xl ring-1 ring-green-500/20"
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
