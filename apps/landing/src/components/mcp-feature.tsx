import { MCPAnimation } from "../animations/mcp-animation";

export const MCPFeature = () => {
  return (
    <div className="relative h-[400px] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 sm:h-[500px] md:h-[600px]">
      <MCPAnimation />

      {/* Overlay Gradient for better integration with dark theme */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-50" />
    </div>
  );
};
