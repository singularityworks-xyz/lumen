"use client";

import { useState } from "react";
import { Logo } from "./components/logo";
import { VideoModal } from "./components/video-modal";
import { ArchitectureConceptsSection } from "./sections/architecture-concepts";
import { ColophonSection } from "./sections/colophon";
import { ConnectedCardsSection } from "./sections/connected-cards";
import { KanbanShowcase } from "./sections/kanban-showcase";
import { MinimalHero } from "./sections/minimal-hero";

export default function App() {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleWatchDemo = () => {
    setVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    setIsVideoModalOpen(true);
  };

  const navItems = [
    {
      label: "Demo",
      onClick: handleWatchDemo,
      isButton: true,
    },
    { label: "Kanban", href: "#canvas" },
    { label: "Connectors", href: "#connectors" },
    { label: "Architecture", href: "#architecture" },
    {
      label: "Github",
      href: "https://github.com/singularityworks-xyz/lumen",
    },
  ];

  return (
    <main className="relative min-h-screen">
      <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-background text-zinc-300 selection:bg-white selection:text-neutral-900">
        <div aria-hidden="true" className="grid-bg fixed inset-0 opacity-30" />
        <nav className="fixed top-0 z-50 w-full">
          <div className="mx-auto px-4 py-4 sm:px-8">
            <div className="relative flex items-center justify-between">
              <Logo onClick={scrollToTop} />

              <div className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
                <div className="relative flex items-center gap-1 rounded-2xl border border-border/30 bg-linear-to-br from-background via-background to-muted p-1 shadow-[inset_0_1px_10px_rgba(255,255,255,0.08),inset_0_-1px_10px_rgba(0,0,0,0.3)]">
                  <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-40" />
                  <div className="relative z-10 flex items-center gap-1">
                    {navItems.map((item) =>
                      item.isButton ? (
                        <button
                          className="cursor-pointer rounded-lg px-3.5 py-1.5 text-muted-foreground text-xs transition-all hover:text-foreground"
                          key={item.label}
                          onClick={item.onClick}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ) : (
                        <a
                          className="cursor-pointer rounded-lg px-3.5 py-1.5 text-muted-foreground text-xs transition-all hover:text-foreground"
                          href={item.href}
                          key={item.label}
                        >
                          {item.label}
                        </a>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="absolute top-1/2 right-4 flex -translate-y-1/2 items-center gap-4 md:hidden">
                {navItems.map((item) =>
                  item.isButton ? (
                    <button
                      className="cursor-pointer text-muted-foreground text-xs transition-all hover:text-foreground"
                      key={item.label}
                      onClick={item.onClick}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <a
                      className="cursor-pointer text-muted-foreground text-xs transition-all hover:text-foreground"
                      href={item.href}
                      key={item.label}
                    >
                      {item.label}
                    </a>
                  )
                )}
              </div>

              <div className="flex items-center gap-4">
                <span className="hidden font-mono text-[10px] text-zinc-300 lg:block">
                  SINGULARITY WORKS ©
                </span>
              </div>
            </div>
          </div>
        </nav>

        <div className="relative z-10">
          <div aria-hidden="true" className="noise-overlay" />
          <MinimalHero onWatchDemo={handleWatchDemo} />
          <KanbanShowcase />
          <ConnectedCardsSection />
          <ArchitectureConceptsSection />
          <ColophonSection />
        </div>
      </div>

      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        videoUrl={videoUrl}
      />
    </main>
  );
}
