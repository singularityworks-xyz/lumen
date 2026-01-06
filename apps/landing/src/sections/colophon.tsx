"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

export function ColophonSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) {
      return;
    }

    const ctx = gsap.context(() => {
      if (headerRef.current) {
        gsap.from(headerRef.current, {
          x: -60,
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
          y: 40,
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
      className="relative border-border/30 border-t px-6 py-32 md:px-12"
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
            concurrency, and production load without degrading the user’s mental
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
                Year
              </h4>
              <ul className="space-y-1">
                <li className="font-mono text-foreground/80 text-xs">2025</li>
                <li className="font-mono text-foreground/80 text-xs">
                  Ongoing
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="lg:w-3/5" id="pricing">
          <h4 className="mb-6 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
            Pricing
          </h4>
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            <div className="flex-1 rounded-xl border border-border/30 bg-card/20 p-5 backdrop-blur-sm">
              <p className="font-mono text-[10px] text-primary uppercase tracking-wider">
                Offline
              </p>
              <p className="mt-2 font-bold text-2xl text-foreground">Free</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                permanently
              </p>
              <p className="mt-3 text-[10px] text-foreground/60 leading-relaxed">
                1 workspace
                <br />
                Shareable
              </p>
            </div>

            <div className="flex-1 rounded-xl border border-primary/30 bg-primary/5 p-5 backdrop-blur-sm">
              <p className="font-mono text-[10px] text-primary uppercase tracking-wider">
                Individual
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-muted-foreground text-sm line-through">
                  $12
                </span>
                <span className="font-bold text-2xl text-foreground">$8</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  /mo
                </span>
              </div>
              <p className="mt-3 text-[10px] text-foreground/60 leading-relaxed">
                Unlimited workspaces
                <br />
                All shareable
              </p>
            </div>

            <div className="relative flex-1 overflow-hidden rounded-xl border border-border/30 bg-card/20 p-5 backdrop-blur-sm">
              <div className="absolute top-0 right-0 rounded-bl-lg bg-primary/80 px-2 py-0.5">
                <span className="font-mono text-[8px] text-primary-foreground uppercase">
                  Limited
                </span>
              </div>
              <p className="font-mono text-[10px] text-primary uppercase tracking-wider">
                Permanent
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-muted-foreground text-sm line-through">
                  $320
                </span>
                <span className="font-bold text-2xl text-foreground">$220</span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">
                one-time
              </p>
              <p className="mt-2 text-[10px] text-foreground/60 leading-relaxed">
                Lifetime access
              </p>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="mb-3 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
              How it Works
            </h4>
            <p className="text-foreground/70 text-sm leading-relaxed">
              Zoom, pan, and place boards anywhere on an infinite canvas with no
              limits. Watch teammates' cursors move in real-time as you
              collaborate. Work offline seamlessly your changes sync
              automatically when you reconnect. Drop comment clusters anywhere
              for contextual discussions, and connect related boards with visual
              links to see the big picture at a glance.
            </p>
          </div>

          <div className="mt-6">
            <h4 className="mb-3 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
              Built For
            </h4>
            <p className="text-foreground/70 text-sm leading-relaxed">
              Visual thinkers who sketch ideas before typing them. Remote teams
              who want to collaborate as if they're in the same room. Complex
              projects with multiple interconnected boards. Privacy-conscious
              users who want data to stay local until they choose to sync.
            </p>
          </div>
        </div>
      </div>

      <div
        className="mt-24 flex flex-col gap-4 border-border/20 border-t pt-8 md:flex-row md:items-center md:justify-between"
        ref={footerRef}
      >
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          © 2025 Singularity Works. All rights reserved.
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          Crafted with precision. Illuminated with vision.
        </p>
      </div>
    </section>
  );
}
