import { Check, Database, Globe, Users } from "lucide-react";

const PricingCard = ({
  title,
  price,
  description,
  features,
  recommended = false,
  buttonText = "Get Started",
}: {
  title: string;
  price: string;
  description: string;
  features: string[];
  recommended?: boolean;
  buttonText?: string;
}) => (
  <div
    className={`relative flex flex-col rounded-xl border p-6 transition-all duration-300 ${
      recommended
        ? "border-emerald-500/50 bg-zinc-900/50 shadow-[0_0_30px_rgba(16,185,129,0.1)]"
        : "border-zinc-800 bg-neutral-900 hover:border-zinc-700"
    }`}
  >
    {recommended && (
      <div className="-top-3 -translate-x-1/2 absolute left-1/2 rounded-full bg-emerald-500 px-3 py-0.5 font-bold font-mono text-[10px] text-neutral-900 uppercase tracking-wider">
        Recommended
      </div>
    )}
    <div className="mb-2 font-mono text-sm text-zinc-500 uppercase tracking-widest">
      {title}
    </div>
    <div className="mb-4 flex items-baseline gap-1">
      <span className="font-medium font-sans text-4xl text-white">{price}</span>
      {price !== "Free" && (
        <span className="font-sans text-sm text-zinc-500">/month</span>
      )}
    </div>
    <p className="mb-6 font-sans text-sm text-zinc-400 leading-relaxed">
      {description}
    </p>
    <div className="mb-8 flex-1 space-y-3">
      {features.map((feature) => (
        <div className="flex items-start gap-3" key={feature}>
          <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800">
            <Check className="h-2.5 w-2.5 text-emerald-500" />
          </div>
          <span className="font-sans text-sm text-zinc-300">{feature}</span>
        </div>
      ))}
    </div>
    <button
      className={`w-full rounded px-4 py-2.5 font-mono text-xs transition-all duration-200 ${
        recommended
          ? "bg-emerald-500 text-neutral-900 hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          : "border border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700"
      }`}
      type="button"
    >
      {buttonText}
    </button>
  </div>
);

export const Pricing = () => (
  <div className="mx-auto w-full max-w-7xl px-6 py-24 md:px-10 md:py-32">
    <div className="mb-16 text-center md:mb-24">
      <h2 className="mb-6 font-medium font-sans text-3xl text-white sm:text-4xl md:text-5xl">
        Simple, transparent pricing.
      </h2>
      <p className="mx-auto max-w-2xl font-light font-sans text-lg text-zinc-400">
        Start for free on your local machine. Upgrade when you need to sync
        across devices or collaborate with your team.
      </p>
    </div>

    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <PricingCard
        buttonText="Download Now"
        description="Forever free for offline use. Perfect for personal task management and note-taking."
        features={[
          "Unlimited local boards",
          "Offline-first architecture",
          "Markdown support",
          "Local file attachments",
          "No account required",
        ]}
        price="Free"
        title="Local"
      />
      <PricingCard
        description="Seamlessly sync your workspace across all your devices with end-to-end encryption."
        features={[
          "Everything in Local",
          "Sync across 5 devices",
          "End-to-end encryption",
          "10GB Cloud storage",
          "Version history (30 days)",
        ]}
        price="$12"
        recommended
        title="Sync"
      />
      <PricingCard
        buttonText="Contact Sales"
        description="Collaborate with your team in real-time with granular permissions and admin controls."
        features={[
          "Everything in Sync",
          "Unlimited team members",
          "Real-time multiplayer",
          "Shared workspaces",
          "Admin console & roles",
          "Priority support",
        ]}
        price="$49"
        title="Team"
      />
    </div>

    <div className="mt-20 border-zinc-800 border-t pt-12">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
            <Database className="h-5 w-5 text-zinc-400" />
          </div>
          <h3 className="mb-2 font-medium font-sans text-lg text-white">
            Local-First
          </h3>
          <p className="font-sans text-sm text-zinc-500">
            Your data lives on your device. We just help you move it around.
          </p>
        </div>
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
            <Globe className="h-5 w-5 text-zinc-400" />
          </div>
          <h3 className="mb-2 font-medium font-sans text-lg text-white">
            Global Edge
          </h3>
          <p className="font-sans text-sm text-zinc-500">
            Sync servers distributed worldwide for low-latency updates.
          </p>
        </div>
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
            <Users className="h-5 w-5 text-zinc-400" />
          </div>
          <h3 className="mb-2 font-medium font-sans text-lg text-white">
            Community
          </h3>
          <p className="font-sans text-sm text-zinc-500">
            Join our Discord to shape the future of the protocol.
          </p>
        </div>
      </div>
    </div>
  </div>
);
