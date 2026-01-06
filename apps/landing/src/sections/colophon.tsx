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
      // Header slide in
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

      // Grid columns fade up with stagger
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

      // Footer fade in
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
      <div className="mb-16" ref={headerRef}>
        <h2 className="mt-4 font-(--font-bebas) text-5xl tracking-tight md:text-7xl">
          LUMEN
        </h2>
        <span className="ml-2 font-mono text-[10px] text-accent uppercase tracking-[0.3em]">
          By Singularity Works
        </span>
      </div>

      <div
        className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12 lg:grid-cols-6"
        ref={gridRef}
      >
        <div className="col-span-1">
          <h4 className="mb-4 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
            Design
          </h4>
          <ul className="space-y-2">
            <li className="font-mono text-foreground/80 text-xs">
              Singularity Works
            </li>
            <li className="font-mono text-foreground/80 text-xs">
              Design Studio
            </li>
          </ul>
        </div>

        <div className="col-span-1">
          <h4 className="mb-4 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
            Stack
          </h4>
          <ul className="space-y-2">
            <li className="font-mono text-foreground/80 text-xs">Next.js</li>
            <li className="font-mono text-foreground/80 text-xs">
              Tailwind CSS
            </li>
            <li className="font-mono text-foreground/80 text-xs">Vercel</li>
          </ul>
        </div>

        <div className="col-span-1">
          <h4 className="mb-4 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
            Typography
          </h4>
          <ul className="space-y-2">
            <li className="font-mono text-foreground/80 text-xs">Bebas Neue</li>
            <li className="font-mono text-foreground/80 text-xs">IBM Plex</li>
            <li className="font-mono text-foreground/80 text-xs">Plex Mono</li>
          </ul>
        </div>

        <div className="col-span-1">
          <h4 className="mb-4 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
            Location
          </h4>
          <ul className="space-y-2">
            <li className="font-mono text-foreground/80 text-xs">Remote</li>
            <li className="font-mono text-foreground/80 text-xs">Everywhere</li>
          </ul>
        </div>

        <div className="col-span-1">
          <h4 className="mb-4 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
            Contact
          </h4>
          <ul className="space-y-2">
            <li>
              <a
                className="font-mono text-foreground/80 text-xs transition-colors duration-200 hover:text-accent"
                href="/"
              >
                Email
              </a>
            </li>
            <li>
              <a
                className="font-mono text-foreground/80 text-xs transition-colors duration-200 hover:text-accent"
                href="/"
              >
                Twitter/X
              </a>
            </li>
          </ul>
        </div>

        <div className="col-span-1">
          <h4 className="mb-4 font-mono text-[9px] text-muted-foreground uppercase tracking-[0.3em]">
            Year
          </h4>
          <ul className="space-y-2">
            <li className="font-mono text-foreground/80 text-xs">2025</li>
            <li className="font-mono text-foreground/80 text-xs">Ongoing</li>
          </ul>
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
