"use client";
import AnimatedGradientBackground from "../animations/animated-gradient-bg";
import PixelSnow from "../animations/pixel-snow";

const SnakeArrowTopLeft = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 100 120"
  >
    <path
      d="M20 10 Q30 35, 45 55 Q60 75, 80 95"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
    />
    <path
      d="M68 88 L85 100 L78 82"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

const SnakeArrowTopRight = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 100 120"
  >
    <path
      d="M80 10 Q70 35, 55 55 Q40 75, 20 95"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
    />
    <path
      d="M32 88 L15 100 L22 82"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

const SnakeArrowLeftMiddle = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 120 80"
  >
    <path
      d="M10 40 Q30 25, 50 45 Q70 65, 90 40 Q100 30, 110 40"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
    />
    <path
      d="M100 32 L115 40 L100 48"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

const SnakeArrowRightMiddle = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 120 80"
  >
    <path
      d="M110 40 Q90 55, 70 35 Q50 15, 30 40 Q20 50, 10 40"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
    />
    <path
      d="M20 32 L5 40 L20 48"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

const CurvedArrowUp = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 60 100"
  >
    <path
      d="M30 95 Q25 70, 32 50 Q38 30, 30 10"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="3"
    />
    <path
      d="M22 22 L30 5 L38 22"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
    />
  </svg>
);

const CollabIcon = () => (
  <div className="relative h-8 w-14">
    {[
      { x: 0, y: 0, color: "#FF6B6B", delay: 0 },
      { x: 18, y: 12, color: "#4ECDC4", delay: 0.3 },
      { x: 8, y: 20, color: "#45B7D1", delay: 0.6 },
    ].map((cursor) => (
      <svg
        aria-hidden="true"
        className="absolute h-4 w-4"
        fill={cursor.color}
        key={`${cursor.x}-${cursor.y}-${cursor.color}`}
        style={{
          left: cursor.x,
          top: cursor.y,
          animation: "cursorMove 2s ease-in-out infinite",
          animationDelay: `${cursor.delay}s`,
        }}
        viewBox="0 0 24 24"
      >
        <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L5.94 2.39a.5.5 0 0 0-.44.82z" />
      </svg>
    ))}
  </div>
);

const CanvasIcon = () => (
  <div className="relative h-8 w-10 overflow-hidden rounded border border-border/40 bg-card/40">
    <div className="absolute inset-0 grid grid-cols-3 gap-0.5 p-0.5">
      {[...new Array(6)].map((_, i) => {
        const uniqueKey = `canvas-cell-${1.5 + i * 0.1}-${i * 0.1}`;
        return (
          <div
            className="rounded-xs bg-primary/30"
            key={uniqueKey}
            style={{
              animation: `pulse ${1.5 + i * 0.1}s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        );
      })}
    </div>
  </div>
);

const SyncIcon = () => (
  <svg
    aria-hidden="true"
    className="h-7 w-7 text-primary/80"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={{ animation: "spin 3s linear infinite" }}
    viewBox="0 0 24 24"
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const ChatIcon = () => (
  <div className="relative h-6 w-8">
    <div
      className="absolute top-0 left-0 h-5 w-6 rounded-lg rounded-bl-none bg-primary/40"
      style={{ animation: "fadeInOut 2s ease-in-out infinite" }}
    />
    <div
      className="absolute right-1 bottom-0 h-4 w-5 rounded-lg rounded-br-none bg-muted/60"
      style={{ animation: "fadeInOut 2s ease-in-out infinite 0.5s" }}
    />
  </div>
);

const MindMapIcon = () => (
  <div className="relative h-8 w-10">
    <div
      className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/60"
      style={{ animation: "pulse 2s ease-in-out infinite" }}
    />
    <div
      className="absolute top-0 left-1 h-2 w-2 rounded-full bg-primary/40"
      style={{ animation: "pulse 2s ease-in-out infinite 0.2s" }}
    />
    <div
      className="absolute top-1 right-0 h-2 w-2 rounded-full bg-primary/40"
      style={{ animation: "pulse 2s ease-in-out infinite 0.4s" }}
    />
    <div
      className="absolute bottom-0 left-0 h-2 w-2 rounded-full bg-primary/40"
      style={{ animation: "pulse 2s ease-in-out infinite 0.6s" }}
    />
    <div
      className="absolute right-1 bottom-1 h-2 w-2 rounded-full bg-primary/40"
      style={{ animation: "pulse 2s ease-in-out infinite 0.8s" }}
    />
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.5"
    >
      <line className="text-primary/30" x1="50%" x2="25%" y1="50%" y2="15%" />
      <line className="text-primary/30" x1="50%" x2="85%" y1="50%" y2="25%" />
      <line className="text-primary/30" x1="50%" x2="15%" y1="50%" y2="85%" />
      <line className="text-primary/30" x1="50%" x2="80%" y1="50%" y2="75%" />
    </svg>
  </div>
);

const VerticalArrowDown = ({ className }: { className?: string }) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 40 60">
    <path
      d="M20 5 Q22 20, 18 35 Q16 45, 20 55"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
    />
    <path
      d="M14 48 L20 58 L26 48"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const VerticalArrowUp = ({ className }: { className?: string }) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 40 60">
    <path
      d="M20 55 Q18 40, 22 25 Q24 15, 20 5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
    />
    <path
      d="M14 12 L20 2 L26 12"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const SnakeArrowBottomLeft = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 100 120"
  >
    <path
      d="M20 110 Q30 85, 45 65 Q60 45, 80 25"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.5"
    />
    <path
      d="M68 32 L85 20 L78 38"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
    />
  </svg>
);

interface FeatureProps {
  title: string;
  tagline: string;
  icon: React.ReactNode;
}

const features: FeatureProps[] = [
  {
    title: "Live Together",
    tagline: "Multiplayer cursors. Real humans. Real-time.",
    icon: <CollabIcon />,
  },
  {
    title: "Infinite Canvas",
    tagline: "One workspace. Unlimited boards. Zero limits.",
    icon: <CanvasIcon />,
  },
  {
    title: "Always In Sync",
    tagline: "Online or offline. Your work follows you.",
    icon: <SyncIcon />,
  },
  {
    title: "Share & Chat",
    tagline: "One link. Built-in chat. Team unlocked.",
    icon: <ChatIcon />,
  },
  {
    title: "Second Brain",
    tagline: "Everything connected. Nothing forgotten.",
    icon: <MindMapIcon />,
  },
];

interface MinimalHeroProps {
  onWatchDemo?: () => void;
}

export const MinimalHero = ({ onWatchDemo }: MinimalHeroProps) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden pb-24">
      {/* Layer 1: Gradient background at the bottom */}
      <AnimatedGradientBackground Breathing={true} />

      {/* Layer 2: Pixel snow with radial mask */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          maskImage:
            "radial-gradient(ellipse 70% 55% at 45% 30%, black 0%, black 35%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 55% at 45% 30%, black 0%, black 35%, transparent 75%)",
        }}
      >
        <PixelSnow
          brightness={0.25}
          color="#ffffff"
          density={0.5}
          direction={125}
          flakeSize={0.01}
          minFlakeSize={1.25}
          pixelResolution={200}
          speed={1}
        />
      </div>

      <div className="relative z-10 flex h-full flex-col items-center justify-start px-4 pt-40 text-center sm:pt-48">
        {/* MOBILE/TABLET LAYOUT (below lg) */}
        <div className="flex flex-col items-center lg:hidden">
          {/* Top 3 features */}
          <div className="mb-4 flex w-full max-w-md justify-between gap-2 px-2">
            {/* Feature 0 - Live Together */}
            <div className="flex -translate-x-8 -rotate-14 animate-[fadeIn_0.5s_ease-out_0.1s_both] flex-col items-center">
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <div className="scale-75">{features[0].icon}</div>
                <p
                  className="font-bold text-foreground text-xs"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {features[0].title}
                </p>
              </div>
              <p className="max-w-24 text-center text-[9px] text-muted-foreground italic leading-tight">
                {features[0].tagline}
              </p>
              <VerticalArrowDown className="mt-1 h-8 w-6 text-primary/50" />
            </div>

            {/* Feature 1 - Infinite Canvas */}
            <div className="flex animate-[fadeIn_0.5s_ease-out_0.2s_both] flex-col items-center">
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <div className="scale-75">{features[1].icon}</div>
                <p
                  className="font-bold text-foreground text-xs"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {features[1].title}
                </p>
              </div>
              <p className="max-w-24 text-center text-[9px] text-muted-foreground italic leading-tight">
                {features[1].tagline}
              </p>
              <VerticalArrowDown className="mt-1 h-8 w-6 text-primary/50" />
            </div>

            {/* Feature 2 - Always In Sync*/}
            <div className="flex translate-x-8 rotate-12 animate-[fadeIn_0.5s_ease-out_0.3s_both] flex-col items-center">
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <div className="scale-75">{features[2].icon}</div>
                <p
                  className="font-bold text-foreground text-xs"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {features[2].title}
                </p>
              </div>
              <p className="max-w-24 text-center text-[9px] text-muted-foreground italic leading-tight">
                {features[2].tagline}
              </p>
              <VerticalArrowDown className="mt-1 h-8 w-6 text-primary/50" />
            </div>
          </div>

          {/* Mobile Welcome Dialog Card */}
          <div className="pointer-events-auto relative w-full max-w-sm animate-[fadeIn_0.5s_ease-out] px-4">
            <div className="relative rounded-2xl bg-linear-to-br from-background via-background to-muted p-6 shadow-[inset_0_3px_20px_rgba(255,255,255,0.12),inset_0_-3px_20px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />

              <div className="relative space-y-5">
                <div className="text-center">
                  <div className="mb-3 flex items-center justify-center">
                    <div className="relative h-12 w-12">
                      <div className="absolute inset-0 rounded-full bg-white/40 blur-xl" />
                      {/** biome-ignore lint/correctness/useImageSize: tdfl */}
                      {/** biome-ignore lint/performance/noImgElement: tdfl */}
                      <img
                        alt="Lumen Logo"
                        className="relative h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]"
                        src="/lumen_white.svg"
                      />
                    </div>
                  </div>
                  <h1 className="bg-linear-to-b from-foreground/90 to-foreground/60 bg-clip-text font-bold text-3xl text-transparent">
                    Lumen
                  </h1>
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    by{" "}
                    <span className="font-semibold text-foreground/80">
                      Singularity Works
                    </span>
                  </p>
                  <p className="mt-2 text-muted-foreground text-sm">
                    The canvas that thinks with you.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <a
                    className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-b from-primary to-primary/90 font-semibold text-primary-foreground text-sm shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.3)] transition-transform hover:scale-[1.02] active:scale-[0.97]"
                    href="https://canvas.itssingularity.com"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 12h14M12 5v14" />
                    </svg>
                    Start Building Free
                  </a>

                  <button
                    className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-border/50 bg-card/50 font-medium text-sm shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.3)] backdrop-blur-sm transition-colors hover:bg-card/70"
                    onClick={onWatchDemo}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Watch Demo
                  </button>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-linear-to-br from-primary/20 via-transparent to-primary/10 opacity-30 blur-2xl" />
          </div>

          {/* Bottom 2 features with arrows pointing UP */}
          <div className="mt-4 flex w-full max-w-sm justify-between gap-4 px-2">
            {/* Feature 3 - Share & Chat (left, tilted left) */}
            <div className="flex -translate-x-3 rotate-8 animate-[fadeIn_0.5s_ease-out_0.5s_both] flex-col items-center">
              <VerticalArrowUp className="mb-1 h-8 w-6 text-primary/50" />
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <div className="scale-75">{features[3].icon}</div>
                <p
                  className="font-bold text-foreground text-xs"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {features[3].title}
                </p>
              </div>
              <p className="max-w-24 text-center text-[9px] text-muted-foreground italic leading-tight">
                {features[3].tagline}
              </p>
            </div>

            {/* Feature 4 - Second Brain (right, tilted right) */}
            <div className="flex translate-x-3 -rotate-8 animate-[fadeIn_0.5s_ease-out_0.6s_both] flex-col items-center">
              <VerticalArrowUp className="mb-1 h-8 w-6 text-primary/50" />
              <div className="mb-1 flex items-center justify-center gap-1.5">
                <div className="scale-75">{features[4].icon}</div>
                <p
                  className="font-bold text-foreground text-xs"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {features[4].title}
                </p>
              </div>
              <p className="max-w-24 text-center text-[9px] text-muted-foreground italic leading-tight">
                {features[4].tagline}
              </p>
            </div>
          </div>
        </div>

        {/*  DESKTOP LAYOUT (lg and up)  */}
        {/* Features positioned around the top of the card - only shown on large screens */}
        <div className="relative mx-auto hidden w-full max-w-5xl origin-top lg:block">
          {/* Top-left feature - positioned higher */}
          <div className="absolute -top-8 left-[10%] flex animate-[fadeIn_0.5s_ease-out_0.2s_both] flex-col items-center">
            <div className="mb-2 -translate-x-24 text-center">
              <div className="mb-1 flex items-center justify-center gap-2">
                {features[0].icon}
                <p
                  className="font-bold text-foreground text-xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {features[0].title}
                </p>
              </div>
              <p className="max-w-50 text-muted-foreground text-sm italic">
                {features[0].tagline}
              </p>
            </div>
            <SnakeArrowTopLeft className="h-28 w-20 text-primary/50" />
          </div>

          {/* Top-right feature - positioned lower and more right */}
          <div className="absolute top-4 -right-12 flex animate-[fadeIn_0.5s_ease-out_0.3s_both] flex-col items-start">
            <div className="mb-1 text-left">
              <div className="mb-1 flex items-center gap-2">
                <p
                  className="font-bold text-foreground text-xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {features[1].title}
                </p>
                {features[1].icon}
              </div>
              <p className="max-w-50 text-muted-foreground text-sm italic">
                {features[1].tagline}
              </p>
            </div>
            <SnakeArrowTopRight className="h-24 w-20 -translate-x-12 text-primary/50" />
          </div>

          {/* Left-middle feature - positioned higher and further out */}
          <div className="absolute top-[35%] -left-20 flex animate-[fadeIn_0.5s_ease-out_0.4s_both] items-center gap-2">
            <div className="text-right">
              <div className="mb-1 flex items-center justify-end gap-2">
                {features[2].icon}
                <p
                  className="font-bold text-foreground text-xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {features[2].title}
                </p>
              </div>
              <p className="ml-auto max-w-50 text-muted-foreground text-sm italic">
                {features[2].tagline}
              </p>
            </div>
            <SnakeArrowLeftMiddle className="h-16 w-24 text-primary/50" />
          </div>

          {/* Right-middle feature - positioned lower */}
          <div className="absolute top-[65%] -right-20 flex animate-[fadeIn_0.5s_ease-out_0.5s_both] items-center gap-2">
            <SnakeArrowRightMiddle className="h-16 w-24 text-primary/50" />
            <div className="text-left">
              <div className="mb-1 flex items-center gap-2">
                <p
                  className="font-bold text-foreground text-xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {features[3].title}
                </p>
                {features[3].icon}
              </div>
              <p className="max-w-50 text-muted-foreground text-sm italic">
                {features[3].tagline}
              </p>
            </div>
          </div>

          {/* Bottom-left feature - Second Brain */}
          <div className="absolute bottom-[5%] -left-16 flex animate-[fadeIn_0.5s_ease-out_0.6s_both] items-center gap-2">
            <div className="text-right">
              <div className="mb-1 flex items-center justify-end gap-2">
                {features[4].icon}
                <p
                  className="font-bold text-foreground text-xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {features[4].title}
                </p>
              </div>
              <p className="ml-auto max-w-50 text-muted-foreground text-sm italic">
                {features[4].tagline}
              </p>
            </div>
            <SnakeArrowBottomLeft className="ml-4 h-24 w-16 rotate-40 text-primary/50" />
          </div>

          {/* Welcome Dialog Card - Center (Desktop) */}
          <div className="pointer-events-auto relative mx-auto mt-8 w-full max-w-md animate-[fadeIn_0.5s_ease-out]">
            <div className="relative rounded-3xl bg-linear-to-br from-background via-background to-muted p-12 shadow-[inset_0_3px_20px_rgba(255,255,255,0.12),inset_0_-3px_20px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />

              <div className="relative space-y-8">
                <div className="text-center">
                  <div className="mb-4 flex items-center justify-center">
                    <div className="relative h-20 w-20">
                      <div className="absolute inset-0 rounded-full bg-white/40 blur-xl" />
                      {/** biome-ignore lint/correctness/useImageSize: tdfl */}
                      {/** biome-ignore lint/performance/noImgElement: tdfl */}
                      <img
                        alt="Lumen Logo"
                        className="relative h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)]"
                        src="/lumen_white.svg"
                      />
                    </div>
                  </div>
                  <h1 className="bg-linear-to-b from-foreground/90 to-foreground/60 bg-clip-text font-bold text-6xl text-transparent">
                    Lumen
                  </h1>
                  <p className="mt-2 text-muted-foreground/60 text-xs">
                    by{" "}
                    <span className="font-semibold text-foreground/80">
                      Singularity Works
                    </span>
                  </p>
                  <p className="mt-4 text-base text-muted-foreground">
                    The canvas that thinks with you.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    className="flex h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-linear-to-b from-primary to-primary/90 font-semibold text-lg text-primary-foreground shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.3)] transition-transform hover:scale-[1.02] active:scale-[0.97]"
                    onClick={() => {
                      window.location.href =
                        "https://canvas.itssingularity.com";
                    }}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 12h14M12 5v14" />
                    </svg>
                    Start Building Free
                  </button>

                  <button
                    className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-border/50 bg-card/50 font-medium text-base shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.3)] backdrop-blur-sm transition-colors hover:bg-card/70"
                    onClick={onWatchDemo}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Watch Demo
                  </button>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-linear-to-br from-primary/20 via-transparent to-primary/10 opacity-30 blur-2xl" />
          </div>
        </div>

        {/* Bottom problem statement with arrow */}
        <div className="mt-10 flex animate-[fadeIn_0.5s_ease-out_0.8s_both] flex-col items-center">
          <CurvedArrowUp className="mb-6 h-20 w-10 text-primary/50" />
          <div className="max-w-3xl px-4">
            <h2
              className="font-bold text-3xl text-foreground leading-tight sm:text-5xl md:text-6xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Drowning in scattered tasks?
            </h2>
            <p
              className="mt-3 text-foreground/70 text-xl sm:text-3xl md:text-4xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              It doesn't have to be this chaotic.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile: 2-column grid, Tablet: 3-column grid */}
      <div className="relative z-10 mx-auto mt-12 grid max-w-lg grid-cols-2 gap-3 px-4 sm:max-w-2xl sm:grid-cols-3 md:hidden">
        {[
          {
            icon: "M12 4v16m8-8H4",
            label: "Capture",
            title: "Just drop it in",
            desc: "Onto your canvas",
          },
          {
            icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
            label: "Organize",
            title: "Your flow",
            desc: "Boards in boards",
          },
          {
            icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
            label: "Focus",
            title: "What matters",
            desc: "Filter the noise",
          },
          {
            icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
            label: "Connect",
            title: "Chat built-in",
            desc: "Discuss here",
          },
          {
            icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
            label: "Clarity",
            title: "Space to think",
            desc: "No more chaos",
          },
          {
            icon: "M13 10V3L4 14h7v7l9-11h-7z",
            label: "Speed",
            title: "Blazing fast",
            desc: "Offline-first",
          },
        ].map((card, i) => (
          <div
            className="relative rounded-2xl bg-linear-to-br from-background via-background to-muted p-4 shadow-[inset_0_1px_10px_rgba(255,255,255,0.08),inset_0_-1px_10px_rgba(0,0,0,0.3)]"
            key={card.label}
            style={{
              animation: `fadeIn 0.5s ease-out ${0.1 + i * 0.08}s both`,
            }}
          >
            <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-40" />
            <div className="relative">
              <div className="mb-2 flex items-center gap-2 sm:mb-3 sm:gap-3">
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 text-primary sm:h-5 sm:w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d={card.icon}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-mono text-[9px] text-primary/60 uppercase tracking-wider sm:text-[10px]">
                  {card.label}
                </span>
              </div>
              <h3
                className="font-semibold text-foreground text-sm sm:text-base"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {card.title}
              </h3>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {card.desc}
              </p>
            </div>
          </div>
        ))}
        {/* 7th card - Collaborate - centered */}
        <div
          className="col-span-2 mx-auto w-3/4 rounded-2xl bg-linear-to-br from-background via-background to-muted p-5 shadow-[inset_0_2px_12px_rgba(255,255,255,0.1),inset_0_-2px_12px_rgba(0,0,0,0.4)] sm:col-span-3 sm:w-1/2"
          style={{ animation: "fadeIn 0.5s ease-out 0.6s both" }}
        >
          <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-primary/8 via-transparent to-primary/15 opacity-50" />
          <div className="relative text-center">
            <div className="mb-2 flex items-center justify-center gap-2 sm:mb-3 sm:gap-3">
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-primary sm:h-6 sm:w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-mono text-primary/70 text-xs uppercase tracking-wider sm:text-sm">
                Collaborate
              </span>
            </div>
            <h3
              className="font-semibold text-base text-foreground sm:text-lg"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Move as one
            </h3>
            <p className="text-muted-foreground text-sm sm:text-base">
              Real-time cursors. Live edits.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile "The heart of / Work flows here" text - visible only on mobile */}
      <div
        className="relative z-10 mt-8 text-center md:hidden"
        style={{ animation: "fadeIn 0.8s ease-out 0.5s both" }}
      >
        <span className="font-mono text-[10px] text-primary/50 uppercase tracking-[0.2em] sm:text-xs sm:tracking-[0.3em]">
          The heart of
        </span>
        <h3
          className="mt-1 bg-linear-to-r from-primary/80 via-foreground to-primary/80 bg-clip-text font-semibold text-transparent text-xl tracking-tight sm:text-2xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Work flows here
        </h3>
      </div>

      {/* U-shaped cards (7 cards forming upward curve) - md and up */}
      <div className="relative z-10 mx-auto mt-8 hidden h-130 w-full origin-top px-8 md:mt-16 md:block md:scale-[0.7] lg:mt-24 lg:scale-100">
        {/* Card 1 */}
        <div
          className="absolute bottom-72 left-4 w-96 -rotate-6 transition-all hover:z-50 hover:rotate-0 hover:scale-105"
          style={{ animation: "fadeIn 0.6s ease-out 0.1s both" }}
        >
          <div className="relative rounded-3xl bg-linear-to-br from-background via-background to-muted p-8 shadow-[inset_0_2px_15px_rgba(255,255,255,0.1),inset_0_-2px_15px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
            <div className="relative">
              <div className="mb-5 flex items-center gap-4">
                <svg
                  aria-hidden="true"
                  className="h-7 w-7 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 4v16m8-8H4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-mono text-primary/70 text-sm uppercase tracking-wider">
                  Capture
                </span>
              </div>
              <h3
                className="mb-3 font-semibold text-2xl text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Just drop it in
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Tasks, ideas, files — throw everything onto your infinite
                canvas. No folders. No friction.
              </p>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-linear-to-br from-primary/15 via-transparent to-primary/10 opacity-40 blur-xl" />
        </div>

        {/* Card 2 */}
        <div
          className="absolute bottom-44 left-[16%] w-80 -rotate-4 transition-all hover:z-50 hover:rotate-0 hover:scale-105"
          style={{ animation: "fadeIn 0.6s ease-out 0.2s both" }}
        >
          <div className="relative rounded-3xl bg-linear-to-br from-background via-background to-muted p-7 shadow-[inset_0_2px_15px_rgba(255,255,255,0.1),inset_0_-2px_15px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-4">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-mono text-primary/70 text-sm uppercase tracking-wider">
                  Organize
                </span>
              </div>
              <h3
                className="mb-2 font-semibold text-foreground text-xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Your rules, your flow
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                Drag cards into columns. Build boards within boards. Lumen
                adapts to how you think.
              </p>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-linear-to-br from-primary/15 via-transparent to-primary/10 opacity-40 blur-xl" />
        </div>

        <div
          className="absolute bottom-60 left-1/2 -translate-x-1/2 text-center"
          style={{ animation: "fadeIn 0.8s ease-out 0.25s both" }}
        >
          <span className="font-mono text-primary/50 text-xs uppercase tracking-[0.3em]">
            The heart of
          </span>
          <h3
            className="mt-1 bg-linear-to-r from-primary/80 via-foreground to-primary/80 bg-clip-text font-semibold text-3xl text-transparent tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Work flows here
          </h3>
        </div>

        {/* Card 3 */}
        <div
          className="absolute bottom-8 left-[28%] w-72 -rotate-2 transition-all hover:z-50 hover:rotate-0 hover:scale-105"
          style={{ animation: "fadeIn 0.6s ease-out 0.3s both" }}
        >
          <div className="relative rounded-3xl bg-linear-to-br from-background via-background to-muted p-6 shadow-[inset_0_2px_15px_rgba(255,255,255,0.1),inset_0_-2px_15px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-mono text-primary/70 text-sm uppercase tracking-wider">
                  Focus
                </span>
              </div>
              <h3
                className="mb-2 font-semibold text-foreground text-lg"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                See what matters
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                Filter noise. Zoom into what counts.
              </p>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-linear-to-br from-primary/15 via-transparent to-primary/10 opacity-40 blur-xl" />
        </div>

        {/* Card 4 */}
        <div
          className="absolute bottom-0 left-1/2 w-96 -translate-x-1/2 rotate-0 transition-all hover:z-50 hover:scale-105"
          style={{ animation: "fadeIn 0.6s ease-out 0.4s both" }}
        >
          <div className="relative rounded-3xl bg-linear-to-br from-background via-background to-muted p-8 shadow-[inset_0_2px_15px_rgba(255,255,255,0.12),inset_0_-2px_15px_rgba(0,0,0,0.5),0_12px_40px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-primary/8 via-transparent to-primary/15 opacity-60" />
            <div className="relative">
              <div className="mb-5 flex items-center gap-4">
                <svg
                  aria-hidden="true"
                  className="h-7 w-7 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-mono text-primary/80 text-sm uppercase tracking-wider">
                  Collaborate
                </span>
              </div>
              <h3
                className="mb-3 font-semibold text-2xl text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Move as one
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Real-time cursors. Live edits. Watch ideas come alive together.
              </p>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-linear-to-br from-primary/20 via-transparent to-primary/15 opacity-50 blur-2xl" />
        </div>

        {/* Card 5 */}
        <div
          className="absolute right-[28%] bottom-8 w-72 rotate-2 transition-all hover:z-50 hover:rotate-0 hover:scale-105"
          style={{ animation: "fadeIn 0.6s ease-out 0.5s both" }}
        >
          <div className="relative rounded-3xl bg-linear-to-br from-background via-background to-muted p-6 shadow-[inset_0_2px_15px_rgba(255,255,255,0.1),inset_0_-2px_15px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-mono text-primary/70 text-sm uppercase tracking-wider">
                  Connect
                </span>
              </div>
              <h3
                className="mb-2 font-semibold text-foreground text-lg"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Chat built-in
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                Discuss right where the work happens.
              </p>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-linear-to-br from-primary/15 via-transparent to-primary/10 opacity-40 blur-xl" />
        </div>

        {/* Card 6 */}
        <div
          className="absolute right-[14%] bottom-48 w-80 rotate-4 transition-all hover:z-50 hover:rotate-0 hover:scale-105"
          style={{ animation: "fadeIn 0.6s ease-out 0.6s both" }}
        >
          <div className="relative rounded-3xl bg-linear-to-br from-background via-background to-muted p-7 shadow-[inset_0_2px_15px_rgba(255,255,255,0.1),inset_0_-2px_15px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-4">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-mono text-primary/70 text-sm uppercase tracking-wider">
                  Clarity
                </span>
              </div>
              <h3
                className="mb-2 font-semibold text-foreground text-xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Space to think
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                No more chaos. Just you and the clarity to move forward.
              </p>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-linear-to-br from-primary/15 via-transparent to-primary/10 opacity-40 blur-xl" />
        </div>

        {/* Card 7 */}
        <div
          className="absolute right-4 bottom-72 w-96 rotate-6 transition-all hover:z-50 hover:rotate-0 hover:scale-105"
          style={{ animation: "fadeIn 0.6s ease-out 0.7s both" }}
        >
          <div className="relative rounded-3xl bg-linear-to-br from-background via-background to-muted p-8 shadow-[inset_0_2px_15px_rgba(255,255,255,0.1),inset_0_-2px_15px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
            <div className="relative">
              <div className="mb-5 flex items-center gap-4">
                <svg
                  aria-hidden="true"
                  className="h-7 w-7 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-mono text-primary/70 text-sm uppercase tracking-wider">
                  Speed
                </span>
              </div>
              <h3
                className="mb-3 font-semibold text-2xl text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Blazing fast
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Offline-first. Instant sync. Always ready when you are.
              </p>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-linear-to-br from-primary/15 via-transparent to-primary/10 opacity-40 blur-xl" />
        </div>
      </div>

      <style>{`
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes float {
        from { transform: translateY(0px); }
        to { transform: translateY(-3px); }
      }
      @keyframes cursorMove {
        0%, 100% { transform: translate(0, 0); }
        25% { transform: translate(4px, -2px); }
        50% { transform: translate(6px, 2px); }
        75% { transform: translate(2px, 4px); }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes fadeInOut {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
      }
    `}</style>
    </div>
  );
};
