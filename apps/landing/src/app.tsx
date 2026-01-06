/** biome-ignore-all lint/a11y/useButtonType: It's a VITE project */
/** biome-ignore-all lint/a11y/useValidAnchor: SOON */

import { Logo } from "./components/logo";
import { HeroSection } from "./sections/hero";

export default function App() {
  return (
    <main className="relative min-h-screen">
      <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-background text-zinc-300 selection:bg-white selection:text-neutral-900">
        <div aria-hidden="true" className="grid-bg fixed inset-0 opacity-30" />
        <nav className="fixed top-0 z-50 w-full bg-neutral-900/60 backdrop-blur-md">
          <div className="mx-auto px-10">
            <div className="relative flex h-16 items-center justify-between px-4 md:px-6">
              <Logo />
              <div className="flex items-center gap-4">
                <span className="hidden font-mono text-[10px] text-zinc-600 sm:block">
                  SINGULARITY WORKS ©
                </span>
              </div>
            </div>
          </div>
        </nav>
        <div className="relative z-10">
          <div aria-hidden="true" className="noise-overlay" />
          <HeroSection />
        </div>
      </div>
    </main>
  );
}
