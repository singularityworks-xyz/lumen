import { Icons } from "./icons";

export const Marquee = () => {
  const items = [
    { text: "CRDT Based Sync", icon: <Icons.Database /> },
    { text: "Local-First Architecture", icon: <Icons.Server /> },
    { text: "Arbitrary Objects", icon: <Icons.Widget /> },
    { text: "End-to-End Encrypted", icon: <Icons.Shield /> },
    { text: "Infinite Canvas", icon: <Icons.Infinity /> },
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
            <span className="text-base md:text-lg">{item.icon}</span>
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
};
