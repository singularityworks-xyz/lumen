/** biome-ignore-all lint/a11y/useButtonType: It's a VITE project */
/** biome-ignore-all lint/a11y/useValidAnchor: SOON */

import { Edit3, Github } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  CanvasAnimation,
  OfflineAnimation,
  SyncAnimation,
} from "./animations/card-animation";
import { FlashlightCard } from "./animations/flashlight";
import { Marquee } from "./animations/marquee";
import { HeroAnimation } from "./animations/preview-animation";
import RotatingText from "./animations/rotating-text";
import { Logo } from "./components/logo";
import { OpenSource } from "./components/open-source";
import { ScaleContainer } from "./components/scale-container";
import { Pricing } from "./pricing";

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
    <div className="fixed inset-0 z-0 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 scale-110 bg-grid transition-transform duration-75 ease-out"
        ref={bgRef}
      />
    </div>
  );
};

export default function App() {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const [currentView, setCurrentView] = useState<"home" | "pricing">("home");

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const heroContentWidth = windowWidth < 768 ? 450 : 1200;
  const heroContentHeight = windowWidth < 768 ? 300 : 675;

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-background text-zinc-300 selection:bg-white selection:text-neutral-900">
      <ParallaxBackground />
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full bg-neutral-900/60 backdrop-blur-md">
        <div className="mx-auto max-w-7xl border-zinc-800 border-r border-b border-l">
          <div className="relative flex h-16 items-center justify-between px-4 md:px-6">
            <Logo onClick={() => setCurrentView("home")} />
            {/* <div className="-translate-x-1/2 absolute left-1/2 hidden items-center gap-x-6 font-mono text-xs text-zinc-500 tracking-wide md:flex">
              <a className="transition-colors hover:text-white" href="#">
                MANIFESTO
              </a>
              <a className="transition-colors hover:text-white" href="#">
                ENGINE
              </a>
              <button
                className={`font-sans transition-colors hover:text-white ${currentView === "pricing" ? "text-white" : ""}`}
                onClick={() => setCurrentView("pricing")}
              >
                PRICING
              </button>
            </div> */}
            <div className="flex items-center gap-4">
              <span className="hidden font-mono text-[10px] text-zinc-600 sm:block">
                SINGULARITY WORKS ©
              </span>
              <button
                className={`rounded border border-transparent bg-transparent px-3 py-1.5 font-sans text-sm text-zinc-400 transition-colors hover:text-white md:px-4 md:py-2 ${currentView === "pricing" ? "text-white" : ""}`}
                onClick={() => setCurrentView("pricing")}
                type="button"
              >
                PRICING
              </button>
              <a
                className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-text-primary text-xs transition-all hover:bg-zinc-700 md:px-4 md:py-2"
                href="https://canvas.itssingularity.com"
                rel="noopener"
                target="_blank"
              >
                EARLY ACCESS
              </a>
            </div>
          </div>
        </div>
      </nav>{" "}
      <div className="mx-auto max-w-7xl border-zinc-800 border-r border-l">
        <main className="relative z-10 flex w-full max-w-[100vw] grow animate-slide-up flex-col items-center overflow-x-hidden px-6 pt-24 md:px-10 md:pt-32">
          {currentView === "pricing" ? (
            <Pricing />
          ) : (
            <>
              {/* Hero Section */}
              <section className="relative flex min-h-[60vh] w-full max-w-full flex-col items-center justify-center overflow-hidden text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-neutral-900/80 px-3 py-1 backdrop-blur md:mb-8">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400 tracking-tight md:text-xs">
                    OFFLINE FIRST ALPHA LIVE
                  </span>
                </div>

                <h1 className="mx-auto mb-6 max-w-4xl font-bold font-heading text-2xl text-text-primary leading-normal sm:text-4xl md:text-5xl">
                  Infinite spatial{" "}
                  {/* <span className="gradient-text font-black font-handwriting italic md:text-6xl">
                canvas{" "}
              </span> */}
                  canvas for
                  <br />
                  <span className="inline-flex items-center font-bold font-heading text-text-primary md:text-5xl">
                    high-{" "}
                    <RotatingText
                      animate={{ y: 0 }}
                      elementLevelClassName="gradient-text inline-flex items-center font-black font-handwriting italic md:text-6xl overflow-visible"
                      exit={{ y: "-120%" }}
                      initial={{ y: "100%" }}
                      mainClassName="overflow-hidden bg-white justify-center rounded-md px-2 py-1"
                      rotationInterval={2000}
                      splitLevelClassName="inline-block"
                      staggerDuration={0.025}
                      staggerFrom={"last"}
                      texts={["precision", "accuracy", "detail", "clarity"]}
                      transition={{
                        type: "spring",
                        damping: 30,
                        stiffness: 400,
                      }}
                    />{" "}
                  </span>{" "}
                  workflow
                </h1>

                <p className="mx-auto mb-8 max-w-2xl px-4 font-light font-sans text-sm text-zinc-400 sm:text-base md:mb-10 md:text-xl">
                  Organize work through free-form kanban structures and
                  arbitrary task objects. Durable offline storage with
                  deterministic state.
                </p>

                <div className="flex w-full flex-col items-center gap-3 px-4 sm:w-auto sm:flex-row sm:gap-4 sm:px-0">
                  <a
                    className="group relative flex w-full items-center overflow-hidden rounded bg-text-primary px-8 py-3 font-mono text-neutral-900 text-sm shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.5)] sm:w-auto"
                    href="https://canvas.itssingularity.com"
                    rel="noopener"
                    target="_blank"
                  >
                    <Edit3 className="mr-2 h-4 w-4 shrink-0" />
                    <span className="relative z-10">START CANVAS</span>
                  </a>
                  <a
                    className="flex w-full items-center rounded border border-zinc-800 bg-neutral-900/50 px-8 py-3 font-mono text-sm text-zinc-400 transition-all hover:border-zinc-600 hover:text-white sm:w-auto"
                    href="https://github.com/singularityworks-xyz/lumen"
                    rel="noopener"
                    target="_blank"
                  >
                    <Github className="mr-2 h-4 w-4 shrink-0" />
                    GITHUB
                  </a>
                </div>

                {/* Hero Visual / Dashboard Preview */}
                <div className="group relative mt-16 w-full md:mt-20">
                  <div className="-inset-1 absolute rounded-lg bg-linear-to-r from-zinc-800 to-zinc-900 opacity-25 blur transition duration-1000 group-hover:opacity-50 group-hover:duration-200" />
                  <div className="relative w-full overflow-hidden rounded-lg border border-zinc-800 bg-neutral-900 shadow-2xl">
                    {/* Simulated Interface Header */}
                    <div className="absolute top-0 left-0 z-20 flex h-6 w-full items-center gap-1.5 border-zinc-800 border-b bg-neutral-900/90 px-3 md:h-8 md:gap-2 md:px-4">
                      <div className="h-2 w-2 rounded-full bg-zinc-700 md:h-2.5 md:w-2.5" />
                      <div className="h-2 w-2 rounded-full bg-zinc-700 md:h-2.5 md:w-2.5" />
                      <div className="h-2 w-2 rounded-full bg-zinc-700 md:h-2.5 md:w-2.5" />
                    </div>

                    {/* Complex Animation Container */}
                    <div className="relative w-full overflow-hidden bg-neutral-900 pt-6 md:pt-8">
                      <ScaleContainer
                        contentHeight={heroContentHeight}
                        contentWidth={heroContentWidth}
                      >
                        <HeroAnimation />
                      </ScaleContainer>
                    </div>
                  </div>
                </div>
              </section>

              {/* Open Source section */}
              <OpenSource />

              {/* Marquee Section */}
              <section className="w-full overflow-hidden py-12 md:py-16">
                <Marquee />
              </section>

              {/* Features Section */}
              <section className="grid w-full grid-cols-1 gap-6 pb-8 md:pb-12 lg:grid-cols-2">
                {/* Card 1: Full Width Top */}
                <FlashlightCard
                  className="lg:col-span-2"
                  description="Escape the grid. Place tasks, notes, and media anywhere on an infinite 2D plane. Structure emerges from chaos."
                  horizontal
                  meta="Canvas: React Flow"
                  title="Free-form Kanban"
                  visual={
                    <ScaleContainer
                      contentHeight={400}
                      contentWidth={windowWidth < 768 ? 900 : 800}
                    >
                      <CanvasAnimation />
                    </ScaleContainer>
                  }
                />

                {/* Card 2: Half Width */}
                <FlashlightCard
                  description="Work continues without internet. State is stored locally in IndexedDB and synchronized deterministically when back online."
                  horizontal
                  meta="Engine: IndexedDB + CRDTs"
                  title="Offline Durable"
                  visual={
                    <ScaleContainer
                      contentHeight={400}
                      contentWidth={windowWidth < 768 ? 700 : 600}
                    >
                      <OfflineAnimation />
                    </ScaleContainer>
                  }
                />

                {/* Card 3: Half Width */}
                <FlashlightCard
                  description="Shared workspaces with granular permissions. Realtime multiplayer with conflict-free resolution strategies."
                  horizontal
                  meta="Latency: < 50ms"
                  title="Governed Sync"
                  visual={
                    <ScaleContainer
                      contentHeight={400}
                      contentWidth={windowWidth < 768 ? 700 : 600}
                    >
                      <SyncAnimation />
                    </ScaleContainer>
                  }
                />
              </section>
            </>
          )}
        </main>
      </div>
      <footer className="z-100 mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 border-zinc-800 border-t border-r border-l pt-12 pb-12 font-mono text-xs text-zinc-600 md:flex-row">
        <div className="text-center md:text-left">
          <p className="ml-0 font-sans md:ml-4">PRODUCT BY SINGULARITY WORKS</p>
        </div>
        <div className="mr-0 flex gap-6 md:mr-4">
          <a
            className="font-sans hover:text-zinc-400"
            href="https://x.com/singularitywork"
          >
            TWITTER
          </a>
          <a
            className="font-sans hover:text-zinc-400"
            href="https://github.com/singularityworks-xyz"
          >
            GITHUB
          </a>
          <a
            className="font-sans hover:text-zinc-400"
            href="https://www.linkedin.com/company/itssingularity"
          >
            LINKEDIN
          </a>
        </div>
      </footer>
    </div>
  );
}
