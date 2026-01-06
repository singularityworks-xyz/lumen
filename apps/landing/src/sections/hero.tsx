"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";
import { AnimatedNoise } from "../animations/animated-noise";
import { ScrambleTextOnHover } from "../animations/scramble-text";
import {
  SplitFlapAudioProvider,
  SplitFlapMuteToggle,
  SplitFlapText,
} from "../animations/split-flap-text";
import { BitmapChevron } from "../components/bitmap-chevron";

gsap.registerPlugin(ScrollTrigger);

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!(sectionRef.current && contentRef.current)) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.to(contentRef.current, {
        y: -100,
        opacity: 0,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      className="relative flex min-h-screen items-center px-6 md:px-12"
      id="hero"
      ref={sectionRef}
    >
      <AnimatedNoise opacity={0.03} />

      {/* Main content */}
      <div className="w-full flex-1" ref={contentRef}>
        <SplitFlapAudioProvider>
          <div className="relative">
            <SplitFlapText speed={80} text="LUMEN" />
            <div className="mt-4">
              <SplitFlapMuteToggle />
            </div>
          </div>
        </SplitFlapAudioProvider>

        <h2 className="mt-4 font-(--font-bebas) text-[clamp(1rem,3vw,2rem)] text-muted-foreground/60 tracking-wide">
          Illuminating the Future of Design
        </h2>

        <p className="mt-12 max-w-md font-mono text-muted-foreground text-sm leading-relaxed">
          Singularity Works creates luminous experiences through precision
          engineering and visionary design. Where technology meets artistry.
        </p>

        <div className="mt-16 flex items-center gap-8">
          <a
            className="group inline-flex items-center gap-3 border border-foreground/20 px-6 py-3 font-mono text-foreground text-xs uppercase tracking-widest transition-all duration-200 hover:border-accent hover:text-accent"
            href="#work"
          >
            <ScrambleTextOnHover
              as="span"
              duration={0.6}
              text="View Portfolio"
            />
            <BitmapChevron className="transition-transform duration-400 ease-in-out group-hover:rotate-45" />
          </a>
          <a
            className="font-mono text-muted-foreground text-xs uppercase tracking-widest transition-colors duration-200 hover:text-foreground"
            href="#signals"
          >
            Explore Work
          </a>
        </div>
      </div>

      {/* Floating info tag */}
      <div className="absolute right-8 bottom-8 md:right-12 md:bottom-12">
        <div className="border border-border px-4 py-2 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          v.01 / Lumen Edition
        </div>
      </div>
    </section>
  );
}
