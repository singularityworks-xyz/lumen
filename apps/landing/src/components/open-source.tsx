import { Github } from "lucide-react";
import { motion } from "motion/react";

export function OpenSource() {
  return (
    <motion.section
      className="mt-16 w-full max-w-full rounded-xl border border-zinc-800/80 bg-neutral-900/80 px-6 py-8 shadow-[0_0_40px_rgba(0,0,0,0.45)] md:px-10 md:py-10"
      initial={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      viewport={{ once: true, amount: 0.4 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-col gap-6 text-left md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1"
            initial={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
          >
            <motion.span
              animate={{ scale: [1, 1.4, 1], opacity: [0.9, 1, 0.9] }}
              className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]"
              transition={{
                duration: 1.6,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
            <span className="font-mono text-[10px] text-emerald-300 uppercase tracking-[0.26em]">
              Open Source • GitHub First
            </span>
          </motion.div>

          <motion.h2
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-2xl text-text-primary md:text-3xl"
            initial={{ opacity: 0, y: 12 }}
            transition={{ delay: 0.28, duration: 0.4, ease: "easeOut" }}
          >
            Built in the open. MIT-licensed.
          </motion.h2>

          <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl font-sans text-sm text-zinc-400 md:text-base"
            initial={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.34, duration: 0.4, ease: "easeOut" }}
          >
            Lumen is completely open source. Explore the codebase, open issues,
            suggest improvements, and help shape the future of spatial
            productivity.
          </motion.p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <motion.a
            className="inline-flex items-center justify-center rounded-md border border-zinc-600/70 bg-text-primary px-7 py-3 font-mono text-neutral-900 text-xs shadow-[0_0_18px_rgba(255,255,255,0.18)] transition-colors hover:border-zinc-300 hover:bg-white"
            href="https://github.com/singularityworks-xyz/lumen"
            rel="noopener"
            target="_blank"
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Github className="mr-2 h-4 w-4" />
            View repository
          </motion.a>

          <motion.a
            className="inline-flex items-center justify-center rounded-md border border-zinc-700 border-dashed px-7 py-3 font-mono text-xs text-zinc-300 transition-colors hover:border-zinc-400 hover:text-white"
            href="https://github.com/singularityworks-xyz/lumen/contribute"
            rel="noopener"
            target="_blank"
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Start contributing
          </motion.a>
        </div>
      </div>
    </motion.section>
  );
}
