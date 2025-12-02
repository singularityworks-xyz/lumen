import { Check, Database, Globe, Users } from "lucide-react";
import { motion } from "motion/react";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 50,
      damping: 20,
    }
  },
};

const featureListVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const featureItemVariants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 },
};

const PricingCard = ({
  title,
  price,
  originalPrice,
  description,
  features,
  recommended = false,
  buttonText = "Get Started",
}: {
  title: string;
  price: string;
  originalPrice?: string;
  description: string;
  features: string[];
  recommended?: boolean;
  buttonText?: string;
}) => (
  <motion.div
    variants={itemVariants}
    className={`relative flex h-full flex-col rounded-xl border bg-neutral-900/80 px-6 py-6 md:px-7 md:py-7 transition-colors duration-300 ${
      recommended
        ? "border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.1)]"
        : "border-zinc-800/80 hover:border-zinc-700/80 hover:bg-neutral-900"
    }`}
  >
    {recommended && (
      <motion.div
        className="-top-3 -translate-x-1/2 absolute left-1/2 rounded-full border border-emerald-300/70 bg-emerald-500 px-3 py-0.5 font-bold font-mono text-[10px] text-neutral-900 uppercase tracking-[0.22em]"
        initial={{ opacity: 0, y: -10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.5, type: "spring", stiffness: 200 }}
      >
        Recommended
      </motion.div>
    )}
    <div className="mb-2 font-mono text-[11px] text-zinc-500 uppercase tracking-[0.28em]">
      {title}
    </div>
    <div className="mb-4 flex items-baseline gap-2">
      {originalPrice && (
        <span className="font-sans text-lg text-zinc-500 line-through decoration-zinc-500/50">
          {originalPrice}
        </span>
      )}
      <motion.span 
        className="font-medium font-sans text-3xl text-white sm:text-4xl"
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {price}
      </motion.span>
      {price !== "Free" && price !== "Contact Us" && (
        <span className="font-sans text-xs text-zinc-500 sm:text-sm">/month</span>
      )}
    </div>
    <p className="mb-6 font-sans text-sm text-zinc-400 leading-relaxed">
      {description}
    </p>
    <motion.div 
      className="mb-8 flex-1 space-y-3"
      variants={featureListVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
    >
      {features.map((feature) => (
        <motion.div 
          className="flex items-start gap-3" 
          key={feature}
          variants={featureItemVariants}
        >
          <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800">
            <Check className="h-2.5 w-2.5 text-emerald-500" />
          </div>
          <span className="font-sans text-sm text-zinc-300">{feature}</span>
        </motion.div>
      ))}
    </motion.div>
    <motion.button
      className={`w-full rounded-md px-4 py-2.5 font-mono text-[11px] tracking-[0.16em] transition-all duration-200 ${
        recommended
          ? "bg-emerald-500 text-neutral-900 shadow-[0_0_18px_rgba(16,185,129,0.35)] hover:bg-emerald-400"
          : "border border-zinc-700 bg-zinc-900 text-white hover:border-zinc-500 hover:bg-zinc-800"
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      type="button"
    >
      {buttonText}
    </motion.button>
  </motion.div>
);

export const Pricing = () => (
  <div className="mx-auto w-full max-w-7xl">
    <div className="mb-16 text-center md:mb-20">
      <motion.p 
        className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-neutral-900/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-400"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        Pricing • Alpha
      </motion.p>
      <motion.h2 
        className="mb-4 font-medium font-heading text-3xl text-text-primary sm:text-4xl md:text-5xl"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
      >
        Simple, transparent pricing.
      </motion.h2>
      <motion.p 
        className="mx-auto max-w-2xl font-light font-sans text-sm text-zinc-400 sm:text-base md:text-lg"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
      >
        Start for free on your local machine. Upgrade when you need to sync
        across devices or collaborate with your team.
      </motion.p>
    </div>

    <motion.div 
      className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-3"
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-100px" }}
    >
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
          "MCP Server support",
        ]}
        price="$14"
        originalPrice="$20"
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
        price="Contact Us"
        title="Enterprise"
      />
    </motion.div>

    <motion.div 
      className="mt-16 border-zinc-800 border-t pt-10 pb-12 md:mt-20 md:pt-12"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.4 }}
    >
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <motion.div 
          className="flex flex-col items-center text-center md:items-start md:text-left"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80">
            <Database className="h-5 w-5 text-zinc-400" />
          </div>
          <h3 className="mb-2 font-medium font-sans text-lg text-white">
            Local-first
          </h3>
          <p className="font-sans text-sm text-zinc-500">
            Your data lives on your device. We just help you move it around.
          </p>
        </motion.div>
        <motion.div 
          className="flex flex-col items-center text-center md:items-start md:text-left"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80">
            <Globe className="h-5 w-5 text-zinc-400" />
          </div>
          <h3 className="mb-2 font-medium font-sans text-lg text-white">
            Global edge
          </h3>
          <p className="font-sans text-sm text-zinc-500">
            Sync servers distributed worldwide for low-latency updates.
          </p>
        </motion.div>
        <motion.div 
          className="flex flex-col items-center text-center md:items-start md:text-left"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80">
            <Users className="h-5 w-5 text-zinc-400" />
          </div>
          <h3 className="mb-2 font-medium font-sans text-lg text-white">
            Community
          </h3>
          <p className="font-sans text-sm text-zinc-500">
            Join our community channels to shape the future of the protocol.
          </p>
        </motion.div>
      </div>
    </motion.div>
  </div>
);
