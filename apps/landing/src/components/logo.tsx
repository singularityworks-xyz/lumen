import { useLogoAnimation } from "../animations/logo-animation";

type LogoProps = {
  onClick?: () => void;
};

export function Logo({ onClick }: LogoProps) {
  const { displayText, showCursor, triggerHoverAnimation, handleMouseLeave } =
    useLogoAnimation();

  return (
    <button
      className="flex cursor-pointer items-center gap-1 border-none bg-transparent"
      onClick={onClick}
      onMouseEnter={triggerHoverAnimation}
      onMouseLeave={handleMouseLeave}
      type="button"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-sm shadow-lg">
        {/** biome-ignore lint/performance/noImgElement: it's a vite app */}
        <img
          alt="Lumen Logo"
          className="h-6 w-6 pb-1"
          height={24}
          src="/lumen_white.svg"
          width={24}
        />
      </div>
      <span className="relative font-mono text-sm text-white uppercase tracking-widest">
        <span className="invisible">Lumen_</span>
        <span className="absolute top-0 left-0 flex items-baseline">
          {displayText}
          <span
            className={`ml-px inline-block h-0.5 w-2 bg-white transition-opacity duration-100 ${
              showCursor ? "opacity-100" : "opacity-0"
            }`}
            style={{ marginBottom: "0.1em" }}
          />
        </span>
      </span>
    </button>
  );
}
