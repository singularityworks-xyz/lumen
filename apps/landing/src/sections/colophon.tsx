"use client";

import { ArrowRight, Check } from "lucide-react";
import PixelSnow from "../animations/pixel-snow";

export function ColophonSection() {
  const currentYear = new Date().getFullYear();

  return (
    <section
      className="relative overflow-hidden border-border/30 border-t"
      id="colophon"
    >
      {/* Light bleeding up from the bottom edge, behind the wordmark */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-[radial-gradient(ellipse_70%_55%_at_50%_100%,rgba(255,255,255,0.14),transparent_65%)]" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-[radial-gradient(ellipse_45%_100%_at_50%_100%,rgba(255,255,255,0.07),transparent_70%)]" />
        <PixelSnow
          brightness={0.2}
          color="#ffffff"
          density={0.45}
          direction={75}
          flakeSize={0.01}
          minFlakeSize={1.25}
          pixelResolution={200}
          speed={0.6}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-20 sm:px-6 lg:px-8 lg:pt-28">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2
                className="font-bold text-2xl text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Lumen
              </h2>
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
                By Singularity Works
              </span>
            </div>
            <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
              A management system built on an infinite canvas. Offline-first,
              state-durable, and conflict-resistant by default.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-2.5 py-1 font-medium text-[10px] text-muted-foreground">
                <Check className="h-3 w-3 text-primary" />
                Free
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-2.5 py-1 font-medium text-[10px] text-muted-foreground">
                <Check className="h-3 w-3 text-primary" />
                Secure
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-2.5 py-1 font-medium text-[10px] text-muted-foreground">
                <Check className="h-3 w-3 text-primary" />
                Offline-first
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-8 md:items-end">
            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-stretch">
              <a
                className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-b from-primary to-primary/90 px-4 font-semibold text-primary-foreground text-sm shadow-[0_0_24px_rgba(255,255,255,0.22),0_4px_12px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.3)] sm:flex-1"
                href="https://canvas.itssingularity.com"
              >
                <ArrowRight className="h-4 w-4" />
                Try it out
              </a>
              <a
                className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-border/50 bg-card/50 px-4 font-medium text-sm shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.3)] backdrop-blur-sm transition-colors hover:bg-card/70 sm:flex-1"
                href="https://github.com/singularityworks-xyz/lumen"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
                GitHub
              </a>
            </div>

            <div className="flex gap-12">
              <div>
                <h4 className="mb-3 font-semibold text-muted-foreground text-xs">
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
                <h4 className="mb-3 font-semibold text-muted-foreground text-xs">
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
                <h4 className="mb-3 font-semibold text-muted-foreground text-xs">
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
        </div>

        {/* Giant wordmark fading into the light from below */}
        <div className="relative mt-6 flex justify-center overflow-hidden lg:mt-8">
          <h2
            className="translate-y-[8%] select-none bg-linear-to-b from-foreground via-foreground/55 to-transparent bg-clip-text text-center font-bold text-[28vw] text-transparent leading-[0.75] tracking-tight sm:text-[24vw] lg:text-[19rem]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Lumen
          </h2>
        </div>
      </div>

      <div className="relative z-10 border-border/20 border-t px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-muted-foreground text-xs">
            © {currentYear} Singularity Works. All rights reserved.
          </p>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
            <a
              className="font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              href="mailto:work@singularityworks.xyz"
            >
              work@singularityworks.xyz
            </a>
            <p className="text-muted-foreground text-xs">
              Crafted with precision. Illuminated with vision.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
