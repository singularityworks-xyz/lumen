import type React from "react";
import { useEffect, useRef } from "react";

type FlashlightCardProps = {
  title: string;
  description: string;
  meta: string;
  visual?: React.ReactNode;
  icon?: React.ReactNode;
  horizontal?: boolean;
  className?: string;
};

export const FlashlightCard: React.FC<FlashlightCardProps> = ({
  title,
  description,
  meta,
  icon,
  visual,
  horizontal = false,
  className = "",
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    };

    card.addEventListener("mousemove", handleMouseMove);
    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div
      className={`flashlight-card group relative h-auto overflow-hidden rounded-xl border border-zinc-800 bg-neutral-900 shadow-lg transition-shadow duration-300 ${className} ${horizontal ? "min-h-88 md:min-h-72" : "flex min-h-88 flex-col justify-between p-6"}`}
      ref={cardRef}
    >
      <style>{`
            .flashlight-card::before {
                content: "";
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: radial-gradient(800px circle at var(--mouse-x, 0) var(--mouse-y, 0), rgba(255, 255, 255, 0.04), transparent 40%);
                z-index: 1;
                opacity: 0;
                transition: opacity 0.5s ease;
                pointer-events: none;
            }
            .flashlight-card::after {
                content: "";
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: radial-gradient(600px circle at var(--mouse-x, 0) var(--mouse-y, 0), rgba(255, 255, 255, 0.15), transparent 40%);
                z-index: 3;
                opacity: 0;
                transition: opacity 0.5s ease;
                pointer-events: none;
                border-radius: inherit;
                mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                mask-composite: exclude;
                -webkit-mask-composite: xor;
                padding: 1px;
            }
            .flashlight-card:hover::before,
            .flashlight-card:hover::after {
                opacity: 1;
            }
        `}</style>

      {horizontal ? (
        <div className="pointer-events-none relative z-10 flex h-full w-full flex-col md:flex-row">
          <div className="order-2 flex w-full flex-col justify-between border-zinc-800 border-t p-6 md:order-1 md:w-5/12 md:border-t-0 md:p-8">
            <div>
              <div className="mb-6 hidden md:block">
                <div className="flex h-10 w-10 items-center justify-center rounded border border-zinc-700/50 bg-zinc-800/50 text-white text-xl">
                  {icon || (
                    // biome-ignore lint/a11y/noSvgWithoutTitle: TODO: improve accessibility
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <h3 className="mb-3 font-normal font-sans text-white text-xl tracking-tight sm:text-2xl">
                {title}
              </h3>
              <p className="font-sans text-sm text-zinc-500 leading-relaxed">
                {description}
              </p>
            </div>
            <div className="mt-8 border-zinc-800 border-t border-dashed pt-4">
              <span className="font-mono text-[10px] text-zinc-600 uppercase">
                {meta}
              </span>
            </div>
          </div>

          <div className="relative order-1 h-48 min-h-[200px] w-full overflow-hidden border-zinc-800 bg-zinc-900/30 md:order-2 md:h-auto md:min-h-full md:w-7/12 md:border-l">
            {visual}
          </div>
        </div>
      ) : (
        <>
          <div className="pointer-events-none relative z-10 w-full">
            {visual ? (
              <div className="relative mb-6 h-32 w-full overflow-hidden rounded-lg border border-zinc-800/50 bg-zinc-900/50 shadow-inner md:h-40">
                {visual}
              </div>
            ) : (
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded border border-zinc-700/50 bg-zinc-800/50 text-white text-xl">
                {icon}
              </div>
            )}

            <h3 className="mb-3 font-normal font-sans text-white text-xl tracking-tight">
              {title}
            </h3>
            <p className="font-sans text-sm text-zinc-500 leading-relaxed">
              {description}
            </p>
          </div>
          <div className="pointer-events-none relative z-10 mt-4 border-zinc-800 border-t border-dashed pt-4">
            <span className="font-mono text-[10px] text-zinc-600 uppercase">
              {meta}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
