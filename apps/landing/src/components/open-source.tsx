import { Github } from "lucide-react";

export function OpenSource() {
  return (
    <section className="w-full max-w-full border border-zinc-800 bg-neutral-900/70 rounded-lg px-6 py-6 md:px-8 md:py-8 mt-10 mb-6">
      <div className="flex flex-col gap-4 text-left md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-400 uppercase">
            Open Source
          </p>
          <h2 className="font-heading text-xl text-text-primary md:text-2xl">
            Built in the open. MIT-licensed.
          </h2>
          <p className="max-w-xl font-sans text-sm text-zinc-400 md:text-base">
            Lumen is completely open source. Explore the codebase, report issues,
            and help shape the future of spatial productivity.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <a
            href="https://github.com/singularityworks-xyz/lumen"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center rounded border border-zinc-700 bg-neutral-900/80 px-6 py-2.5 font-mono text-xs text-text-primary transition-colors hover:border-zinc-500 hover:bg-neutral-800"
          >
            <Github className="mr-2 h-4 w-4" />
            View on GitHub
          </a>
          <a
            href="https://github.com/singularityworks-xyz/lumen/contribute"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center rounded border border-dashed border-zinc-700 px-6 py-2.5 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Start contributing
          </a>
        </div>
      </div>
    </section>
  );
}
