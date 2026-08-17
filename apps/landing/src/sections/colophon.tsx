"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Database, Network, Share2, Zap } from "lucide-react";
import { useEffect, useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

export function ColophonSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!sectionRef.current) {
      return;
    }

    const ctx = gsap.context(() => {
      if (headerRef.current) {
        gsap.from(headerRef.current, {
          x: -40,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headerRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        });
      }

      if (gridRef.current) {
        const columns = gridRef.current.querySelectorAll(":scope > div");
        gsap.from(columns, {
          y: 30,
          opacity: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        });
      }

      if (footerRef.current) {
        gsap.from(footerRef.current, {
          y: 20,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: footerRef.current,
            start: "top 95%",
            toggleActions: "play none none reverse",
          },
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      className="relative border-border/30 border-t px-6 py-28 md:px-12 lg:py-36"
      id="colophon"
      ref={sectionRef}
    >
      <div
        className="mb-16 flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between"
        ref={headerRef}
      >
        <div className="lg:w-2/5 lg:shrink-0">
          <h2 className="font-(--font-bebas) text-5xl tracking-tight md:text-7xl">
            LUMEN
          </h2>
          <span className="ml-2 font-mono text-[10px] text-accent uppercase tracking-[0.3em]">
            By Singularity Works
          </span>

          <p className="mt-8 text-foreground/70 text-sm leading-relaxed">
            A management system built on an infinite canvas. Work spatially
            instead of hierarchically. Place Kanban boards anywhere, draw
            relationships directly between them, and shape workflows visually as
            they evolve. Collaborate with real-time presence rendered as live
            cursors inside a shared workspace rather than delayed updates or
            comment threads.
          </p>
          <p className="mt-4 text-foreground/70 text-sm leading-relaxed">
            Engineered for reliability rather than spectacle. It is
            offline-first, state-durable, and conflict-resistant by default.
            Real-time sync through CRDTs proven at scale, ensuring consistency
            without central locks. Persistence is local, observability is built
            in, and the system is designed to survive network failure,
            concurrency, and production load without degrading the user's mental
            model.
          </p>

          <div className="mt-10 flex gap-12" ref={gridRef}>
            <div>
              <h4 className="mb-3 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
                Design
              </h4>
              <ul className="space-y-1">
                <li className="font-mono text-foreground/80 text-xs">
                  Singularity Works
                </li>
                <li className="font-mono text-foreground/80 text-xs">
                  Design Studio
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
                Runtime
              </h4>
              <ul className="space-y-1">
                <li className="font-mono text-foreground/80 text-xs">
                  Local-First CRDT
                </li>
                <li className="font-mono text-foreground/80 text-xs">
                  WebGL 2D Canvas
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
                Year
              </h4>
              <ul className="space-y-1">
                <li className="font-mono text-foreground/80 text-xs">2026</li>
                <li className="font-mono text-foreground/80 text-xs">
                  Continuous
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="lg:w-3/5">
          <h4 className="mb-6 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
            Technical Principles
          </h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-6 shadow-[inset_0_1px_3px_rgba(255,255,255,0.08)] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-mono text-[9px] text-emerald-400 uppercase tracking-wider">
                    01 / Storage
                  </span>
                  <h5 className="font-semibold text-foreground text-sm">
                    Local-First SQLite & IndexedDB
                  </h5>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-foreground/70 leading-relaxed">
                Your data lives on your device first. Reads and writes complete
                in 0.2ms with zero dependency on internet connectivity.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-6 shadow-[inset_0_1px_3px_rgba(255,255,255,0.08)] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-mono text-[9px] text-purple-400 uppercase tracking-wider">
                    02 / Replication
                  </span>
                  <h5 className="font-semibold text-foreground text-sm">
                    Yjs CRDT Synchronization
                  </h5>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-foreground/70 leading-relaxed">
                Mathematical conflict-free state resolution ensures multiple
                teammates can edit simultaneously without data loss.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-6 shadow-[inset_0_1px_3px_rgba(255,255,255,0.08)] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Share2 className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-mono text-[9px] text-blue-400 uppercase tracking-wider">
                    03 / Presence
                  </span>
                  <h5 className="font-semibold text-foreground text-sm">
                    Phoenix Ephemeral Broadcast
                  </h5>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-foreground/70 leading-relaxed">
                High-throughput channels for live cursor interpolation, drag
                ghosting, and in-situ threaded discussions on canvas.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-6 shadow-[inset_0_1px_3px_rgba(255,255,255,0.08)] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <Network className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-mono text-[9px] text-amber-400 uppercase tracking-wider">
                    04 / Architecture
                  </span>
                  <h5 className="font-semibold text-foreground text-sm">
                    Spatial Graph Navigation
                  </h5>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-foreground/70 leading-relaxed">
                Draw Bezier relationship connectors between boards to track
                upstream dependencies and map non-linear workflows.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="mb-3 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
              Built For High-Velocity Teams
            </h4>
            <p className="text-foreground/70 text-sm leading-relaxed">
              Designed for visual thinkers, software architects, and product
              engineers who need to see how entire systems connect. Zoom, pan,
              and shape workflows with zero friction.
            </p>
          </div>
        </div>
      </div>

      <div
        className="mt-20 flex flex-col gap-4 border-border/20 border-t pt-8 md:flex-row md:items-center md:justify-between"
        ref={footerRef}
      >
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          © {currentYear} Singularity Works. All rights reserved.
        </p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
          <a
            className="font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            href="mailto:work@singularityworks.xyz"
          >
            Contact: work@singularityworks.xyz
          </a>
          <p className="font-mono text-[10px] text-muted-foreground">
            Crafted with precision. Illuminated with vision.
          </p>
        </div>
      </div>
    </section>
  );
}
