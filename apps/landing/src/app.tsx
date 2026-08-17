"use client";

import { useState } from "react";
import { Logo } from "./components/logo";
import { VideoModal } from "./components/video-modal";
import { AiCapabilitiesSection } from "./sections/ai-capabilities";
import { ArchitectureConceptsSection } from "./sections/architecture-concepts";
import { ColophonSection } from "./sections/colophon";
import { ConnectedCardsSection } from "./sections/connected-cards";
import { KanbanShowcase } from "./sections/kanban-showcase";
import { MinimalHero } from "./sections/minimal-hero";
import { TestimonialsSection } from "./sections/testimonials";
import { WorkspaceFeaturesSection } from "./sections/workspace-features";

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
    { label: "Board", href: "#canvas" },
    { label: "Sidebar", href: "#sidebar" },
    { label: "Workspace", href: "#workspace" },
    { label: "Larity", href: "#larity" },
    {
      label: "Github",
      href: "https://github.com/singularityworks-xyz/lumen",
    },
  ];

  // Mobile keeps the nav minimal: visit the app or open the repo
  const mobileNavItems = [
    { label: "Visit", href: "https://canvas.itssingularity.com" },
    {
      label: "Github",
      href: "https://github.com/singularityworks-xyz/lumen",
    },
  ];

  return (
    <main className="relative min-h-screen">
      <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-[#0A0A0A] text-zinc-300 selection:bg-white selection:text-neutral-900">
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
                {mobileNavItems.map((item) => (
                  <a
                    className="cursor-pointer text-muted-foreground text-xs transition-all hover:text-foreground"
                    href={item.href}
                    key={item.label}
                  >
                    {item.label}
                  </a>
                ))}
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
          <MinimalHero onWatchDemo={handleWatchDemo} />
          <KanbanShowcase />
          <ConnectedCardsSection />
          <WorkspaceFeaturesSection />
          <ArchitectureConceptsSection />
          <AiCapabilitiesSection />
          <TestimonialsSection />
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
