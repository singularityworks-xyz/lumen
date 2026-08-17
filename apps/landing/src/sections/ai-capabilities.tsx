"use client";

import {
  ArrowRight,
  Brain,
  Database,
  LayoutGrid,
  Mic,
  Search,
  Volume2,
} from "lucide-react";

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-border/30 bg-linear-to-br from-background via-background to-muted p-6 shadow-[0_0_24px_rgba(255,255,255,0.05),inset_0_2px_10px_rgba(255,255,255,0.08),inset_0_-2px_10px_rgba(0,0,0,0.35)] ${className ?? ""}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-30" />
      <div className="relative">{children}</div>
    </div>
  );
}

function IconTile({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
      {icon}
    </div>
  );
}

const remembered = [
  "Sprint 24",
  "Board 3",
  "WebGL viewport",
  "thread 14",
  "decision: yjs",
  "Larity draft",
];

export function AiCapabilitiesSection() {
  return (
    <section
      className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      id="ai"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2
          className="font-bold text-3xl text-foreground sm:text-5xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Larity remembers. It retrieves. It talks back.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground text-sm leading-relaxed sm:text-base">
          Memory, retrieval, and real context. Larity answers from your
          workspace, grounded in your actual boards, docs, and threads. And if
          typing is too slow, just talk.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Featured: long-term memory */}
        <Card className="md:col-span-2">
          <div className="flex items-start gap-3">
            <IconTile icon={<Brain className="h-4 w-4 text-foreground" />} />
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                Long-term memory
              </h3>
              <p className="mt-1 max-w-md text-[12px] text-foreground/70 leading-relaxed">
                Larity keeps context across sessions: every board you open,
                every decision you make, every thread you leave. Nothing resets
                when you close the tab.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {remembered.map((item, index) => (
              <span
                className="rounded-md border border-border/30 bg-muted/30 px-2 py-1 font-mono text-[9px] text-muted-foreground"
                key={item}
                style={{ opacity: 1 - index * 0.12 }}
              >
                {item}
              </span>
            ))}
          </div>
        </Card>

        {/* RAG */}
        <Card>
          <div className="flex items-start gap-3">
            <IconTile icon={<Database className="h-4 w-4 text-foreground" />} />
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                RAG over your workspace
              </h3>
              <p className="mt-1 text-[12px] text-foreground/70 leading-relaxed">
                Answers are grounded in retrieval over your actual boards and
                documents. No generic chatbot answers, no hallucinated facts.
              </p>
            </div>
          </div>
        </Card>

        {/* Semantic retrieval */}
        <Card>
          <div className="flex items-start gap-3">
            <IconTile icon={<Search className="h-4 w-4 text-foreground" />} />
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                Semantic retrieval
              </h3>
              <p className="mt-1 text-[12px] text-foreground/70 leading-relaxed">
                Describe what you half-remember and Larity finds the exact card,
                note, or connector. Fuzzy in, precise out.
              </p>
            </div>
          </div>
        </Card>

        {/* Canvas context */}
        <Card className="md:col-span-2">
          <div className="flex items-start gap-3">
            <IconTile
              icon={<LayoutGrid className="h-4 w-4 text-foreground" />}
            />
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                Canvas context
              </h3>
              <p className="mt-1 max-w-md text-[12px] text-foreground/70 leading-relaxed">
                Larity sees what's around you: the board you're on, the cards
                you're dragging, the people you're with. Questions land in the
                right place.
              </p>
            </div>
          </div>
          <p className="mt-4 font-mono text-[9px] text-muted-foreground">
            board: Phoenix board &middot; cards: 12 &middot; people: 3 &middot;
            selection: task 14
          </p>
        </Card>

        {/* Voice: STT + TTS */}
        <Card className="md:col-span-3">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <IconTile icon={<Mic className="h-4 w-4 text-foreground" />} />
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Speech to text
                </h3>
                <p className="mt-1 text-[12px] text-foreground/70 leading-relaxed">
                  Talk instead of type. Larity transcribes on the fly and turns
                  your voice into tasks.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 border-border/30 sm:border-l sm:pl-6">
              <IconTile
                icon={<Volume2 className="h-4 w-4 text-foreground" />}
              />
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Text to speech
                </h3>
                <p className="mt-1 text-[12px] text-foreground/70 leading-relaxed">
                  Larity talks back, so you can keep your eyes on the canvas.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-8 flex justify-center">
        <a
          className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-border/50 bg-card/50 px-4 font-medium text-sm shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.3)] backdrop-blur-sm transition-colors hover:bg-card/70"
          href="https://canvas.itssingularity.com"
        >
          Meet Larity
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
