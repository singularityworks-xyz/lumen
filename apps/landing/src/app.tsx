/** biome-ignore-all lint/a11y/useButtonType: It's a VITE project */
/** biome-ignore-all lint/a11y/useValidAnchor: SOON */

import { Logo } from "./components/logo";
import { ColophonSection } from "./sections/colophon";
import { MinimalHero } from "./sections/minimal-hero";

export default function App() {
  return (
    <main className="relative min-h-screen">
      <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-background text-zinc-300 selection:bg-white selection:text-neutral-900">
        <div aria-hidden="true" className="grid-bg fixed inset-0 opacity-30" />
        <nav className="fixed top-0 z-50 w-full">
          <div className="mx-auto px-4 py-4 sm:px-8">
            <div className="relative flex items-center justify-between">
              <Logo />

              <div className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
                <div className="flex items-center gap-1 rounded-xl border border-border/30 bg-card/40 p-1 shadow-[inset_0_1px_8px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.3)] backdrop-blur-md">
                  {[
                    { label: "Features", href: "#features" },
                    { label: "Pricing", href: "#pricing" },
                    { label: "Docs", href: "#docs" },
                  ].map((item) => (
                    <a
                      className="relative rounded-lg px-4 py-2 text-muted-foreground text-sm transition-all hover:bg-primary/10 hover:text-foreground"
                      href={item.href}
                      key={item.label}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="hidden font-mono text-[10px] text-zinc-300 lg:block">
                  SINGULARITY WORKS ©
                </span>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/30 bg-card/40 backdrop-blur-sm transition-colors hover:bg-card/60 md:hidden"
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </nav>
        <div className="relative z-10">
          <div aria-hidden="true" className="noise-overlay" />
          <MinimalHero />
          <ColophonSection />
        </div>
      </div>
    </main>
  );
}
