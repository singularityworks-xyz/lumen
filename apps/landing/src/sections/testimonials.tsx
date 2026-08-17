"use client";

import { ArrowUpRight } from "lucide-react";

interface Testimonial {
  company: string;
  id: string;
  logo?: string;
  logoAlt?: string;
  quote: string;
  url: string;
  urlLabel: string;
}

const testimonials: Testimonial[] = [
  {
    id: "singularity-works",
    quote:
      "We use Lumen for our internal project management to handle ideas and progress across multiple teams.",
    company: "Singularity Works",
    url: "https://itssingularity.com",
    urlLabel: "itssingularity.com",
    logo: "https://img.przknv.cc/t/singularity-icon.png",
    logoAlt: "Singularity Works icon",
  },
  {
    id: "asocialmedia",
    quote:
      "We use Lumen as our primary issue and feature tracker, used by the awesome contributors contributing on asocialmedia.",
    company: "asocialmedia",
    url: "https://asocialmedia.cc",
    urlLabel: "asocialmedia.cc",
    logo: "https://img.przknv.cc/t/zephyr.png",
    logoAlt: "asocialmedia icon",
  },
  {
    id: "parazeeknova",
    quote:
      "I use Lumen every single day. My boards now have their own boards, which is honestly the healthiest relationship I have.",
    company: "parazeeknova",
    url: "https://przknv.cc",
    urlLabel: "przknv.cc",
  },
];

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="pointer-events-auto relative w-full animate-[fadeIn_0.5s_ease-out]">
      <div className="relative h-full rounded-3xl bg-linear-to-br from-background via-background to-muted p-8 shadow-[inset_0_3px_20px_rgba(255,255,255,0.12),inset_0_-3px_20px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />

        <div className="relative flex flex-col items-start">
          <div className="mb-5 flex items-center gap-3">
            {testimonial.logo ? (
              // biome-ignore lint/performance/noImgElement: remote logo, vite app
              <img
                alt={testimonial.logoAlt}
                className="h-7 w-7 shrink-0 object-contain"
                height={28}
                src={testimonial.logo}
                width={28}
              />
            ) : null}
            <h3
              className="bg-linear-to-b from-foreground/90 to-foreground/60 bg-clip-text font-bold text-2xl text-transparent"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {testimonial.company}
            </h3>
          </div>

          <blockquote>
            <p className="text-muted-foreground text-sm italic leading-relaxed">
              {testimonial.quote}
            </p>
          </blockquote>

          <a
            className="mt-6 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            href={testimonial.url}
            rel="noreferrer"
            target="_blank"
          >
            {testimonial.urlLabel}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-linear-to-br from-primary/20 via-transparent to-primary/10 opacity-30 blur-2xl" />
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section
      className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      id="testimonials"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2
          className="font-bold text-3xl text-foreground sm:text-5xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Used by the teams shipping with it
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground text-sm leading-relaxed sm:text-base">
          Lumen is the system Singularity Works and asocialmedia run their own
          planning, issues, and features on. Even its creator swears by it.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {testimonials.map((testimonial) => (
          <TestimonialCard key={testimonial.id} testimonial={testimonial} />
        ))}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
