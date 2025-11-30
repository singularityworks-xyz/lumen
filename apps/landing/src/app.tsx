/** biome-ignore-all lint/a11y/useButtonType: It's a VITE project */
/** biome-ignore-all lint/a11y/useValidAnchor: SOON */
import { useEffect, useRef } from "react";
import {
  CanvasAnimation,
  OfflineAnimation,
  SyncAnimation,
} from "./animations/card-animation";
import { FlashlightCard } from "./animations/flashlight";
import { Marquee } from "./animations/marquee";
import { HeroAnimation } from "./animations/preview-animation";

const ParallaxBackground = () => {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!bgRef.current) {
        return;
      }
      const xVal = (window.innerWidth - e.clientX) / 90;
      const yVal = (window.innerHeight - e.clientY) / 90;
      bgRef.current.style.transform = `translate(${xVal}px, ${yVal}px) scale(1.1)`;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 scale-110 bg-grid transition-transform duration-75 ease-out"
      ref={bgRef}
    />
  );
};

export default function App() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-neutral-900 text-zinc-300 selection:bg-white selection:text-neutral-900">
      <ParallaxBackground />

      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-zinc-800/50 border-b bg-neutral-900/60 backdrop-blur-md">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-white shadow-lg">
              <div className="h-2 w-2 rounded-full bg-neutral-900" />
            </div>
            <span className="font-mono text-sm text-white uppercase tracking-widest">
              Lumen_
            </span>
          </div>
          <div className="-translate-x-1/2 absolute left-1/2 hidden items-center gap-x-6 font-mono text-xs text-zinc-500 tracking-wide md:flex">
            <a className="transition-colors hover:text-white" href="#">
              MANIFESTO
            </a>
            <a className="transition-colors hover:text-white" href="#">
              ENGINE
            </a>
            <a
              className="font-sans transition-colors hover:text-white"
              href="#"
            >
              PRICING
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-[10px] text-zinc-600 sm:block">
              SINGULARITY WORKS ©
            </span>
            <button className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-white text-xs transition-all hover:bg-zinc-700 md:px-4 md:py-2">
              EARLY ACCESS
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl grow animate-slide-up flex-col items-center px-4 pt-24 pb-20 md:px-8 md:pt-32">
        {/* Hero Section */}
        <section className="relative flex min-h-[60vh] w-full flex-col items-center justify-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-neutral-900/80 px-3 py-1 backdrop-blur md:mb-8">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] text-zinc-400 tracking-tight md:text-xs">
              READY FOR EARLY ACCESS
            </span>
          </div>

          <h1 className="mx-auto mb-6 max-w-4xl font-medium font-sans text-3xl text-white leading-[1.1] sm:text-4xl md:text-6xl">
            Infinite spatial canvas for
            <br />
            <span className="font-medium text-zinc-500">
              high-fidelity workflow.
            </span>
          </h1>

          <p className="mx-auto mb-8 max-w-2xl px-4 font-light font-sans text-base text-zinc-400 leading-relaxed md:mb-10 md:text-xl">
            Organize work through free-form kanban structures and arbitrary task
            objects. Durable offline storage with deterministic state.
          </p>

          <div className="flex w-full flex-col items-center gap-3 px-4 sm:w-auto sm:flex-row sm:gap-4 sm:px-0">
            <button className="group relative w-full overflow-hidden rounded bg-white px-8 py-3 font-mono text-neutral-900 text-sm shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.5)] sm:w-auto">
              <span className="relative z-10">START CANVAS</span>
            </button>
            <button className="w-full rounded border border-zinc-800 bg-neutral-900/50 px-8 py-3 font-mono text-sm text-zinc-400 transition-all hover:border-zinc-600 hover:text-white sm:w-auto">
              READ THE DOCS
            </button>
          </div>

          {/* Hero Visual / Dashboard Preview */}
          <div className="group relative mt-16 w-full max-w-5xl md:mt-20">
            <div className="-inset-1 absolute rounded-lg bg-linear-to-r from-zinc-800 to-zinc-900 opacity-25 blur transition duration-1000 group-hover:opacity-50 group-hover:duration-200" />
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-zinc-800 bg-neutral-900 shadow-2xl">
              {/* Simulated Interface Header */}
              <div className="absolute top-0 left-0 z-20 flex h-6 w-full items-center gap-1.5 border-zinc-800 border-b bg-neutral-900/90 px-3 md:h-8 md:gap-2 md:px-4">
                <div className="h-2 w-2 rounded-full bg-zinc-700 md:h-2.5 md:w-2.5" />
                <div className="h-2 w-2 rounded-full bg-zinc-700 md:h-2.5 md:w-2.5" />
                <div className="h-2 w-2 rounded-full bg-zinc-700 md:h-2.5 md:w-2.5" />
              </div>

              {/* Complex Animation Container */}
              <div className="relative h-full w-full overflow-hidden bg-neutral-900 pt-6 md:pt-8">
                <HeroAnimation />
              </div>
            </div>
          </div>
        </section>

        {/* Marquee Section */}
        <section className="mt-12 w-full overflow-hidden border-zinc-800/50 border-y bg-neutral-900/50 py-12 md:py-16">
          <Marquee />
        </section>

        {/* Features Section */}
        <section className="grid w-full grid-cols-1 gap-6 py-16 md:grid-cols-2 md:py-24">
          {/* Card 1: Full Width Top */}
          <FlashlightCard
            className="md:col-span-2"
            description="Escape the grid. Place tasks, notes, and media anywhere on an infinite 2D plane. Structure emerges from chaos."
            horizontal // Side-by-side on tablet+
            meta="Canvas: WebGL"
            title="Free-form Kanban"
            visual={<CanvasAnimation />}
          />

          {/* Card 2: Half Width */}
          <FlashlightCard
            description="Work continues without internet. State is stored locally in IndexedDB and synchronized deterministically when back online."
            horizontal // Vertical Stack on tablet, Side-by-side on large screens
            meta="Engine: Sqlite-WASM"
            title="Offline Durable"
            visual={<OfflineAnimation />}
          />

          {/* Card 3: Half Width */}
          <FlashlightCard
            description="Shared workspaces with granular permissions. Realtime multiplayer with conflict-free resolution strategies."
            horizontal
            meta="Latency: < 50ms"
            title="Governed Sync"
            visual={<SyncAnimation />}
          />
        </section>

        <footer className="flex w-full flex-col items-center justify-between gap-4 border-zinc-800 border-t pt-12 pb-6 font-mono text-xs text-zinc-600 md:flex-row">
          <div className="text-center md:text-left">
            <p className="font-sans">PRODUCT BY SINGULARITY WORKS</p>
          </div>
          <div className="flex gap-6">
            <a className="font-sans hover:text-zinc-400" href="#">
              TWITTER
            </a>
            <a className="font-sans hover:text-zinc-400" href="#">
              GITHUB
            </a>
            <a className="font-sans hover:text-zinc-400" href="#">
              DISCORD
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
