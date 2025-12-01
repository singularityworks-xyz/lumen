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

  const marqueeContent = (
    <div className="flex shrink-0 items-center gap-8 whitespace-nowrap font-mono text-text-primary text-xs uppercase tracking-widest md:gap-16 md:text-sm">
      {items.map((item, index) => (
        <span
          className="flex items-center gap-2 font-sans md:gap-4"
          key={`${item.text}-${index}`}
        >
          <span className="text-sm md:text-base">{item.icon}</span>
          {item.text}
        </span>
      ))}
    </div>
  );

  return (
    <div className="group relative flex w-full overflow-x-hidden">
      <div
        className="flex animate-marquee gap-8 opacity-60 transition-opacity duration-500 group-hover:opacity-80 md:gap-16"
        style={{ animationDuration: "20s" }}
      >
        {marqueeContent}
        {marqueeContent}
      </div>
    </div>
  );
};
