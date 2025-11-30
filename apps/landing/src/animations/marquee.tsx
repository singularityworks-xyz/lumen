import {
  Database,
  Infinity as InfinityIcon,
  Server,
  Shield,
  SquarePlus,
} from "lucide-react";

export const Marquee = () => {
  const items = [
    { text: "CRDT Based Sync", icon: <Database /> },
    { text: "Local-First Architecture", icon: <Server /> },
    { text: "Arbitrary Objects", icon: <SquarePlus /> },
    { text: "End-to-End Encrypted", icon: <Shield /> },
    { text: "Infinite Canvas", icon: <InfinityIcon /> },
  ];

  const marqueeItems = [...items, ...items, ...items, ...items];

  return (
    <div className="group relative flex w-full overflow-x-hidden">
      <div
        className="flex animate-marquee items-center gap-8 whitespace-nowrap font-mono text-xs text-zinc-500 uppercase tracking-widest opacity-60 transition-opacity duration-500 group-hover:opacity-80 md:gap-16 md:text-sm"
        style={{ animationDuration: "60s" }}
      >
        {marqueeItems.map((item, index) => (
          <span
            className="flex items-center gap-2 font-sans md:gap-4"
            key={`${item.text}-${index}`}
          >
            <span className="text-sm md:text-base">{item.icon}</span>
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
};
