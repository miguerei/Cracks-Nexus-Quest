import { motion } from "framer-motion";
import { Target, Trophy, ShieldAlert, BrainCircuit, Play } from "lucide-react";
import { StarField } from "@/components/game/StarField";

export type ChallengeIntroProps = {
  /** Decorative emoji for the challenge (not critical info). */
  emoji: string;
  /** Short game name, e.g. "Carrera de Portales". */
  title: string;
  /** Optional one-line hook shown above the title. */
  tagline?: string;
  /** What the player has to do — one short sentence. */
  howTo: string;
  /** How the player wins — one short sentence. */
  win: string;
  /** What is at stake — one short sentence. */
  stake: string;
  /** The concept the player will master. */
  concept: string;
  /** Label for the primary action button. */
  actionLabel: string;
  /** Fired when the player taps the primary action. */
  onStart: () => void;
};

/**
 * A fast, visual pre-game briefing so ESO students understand any minigame in
 * under 5 seconds: what to do, how to win, what's at stake, which concept they
 * will master, and the single main action. Game feel, not exam.
 */
export function ChallengeIntro({
  emoji,
  title,
  tagline,
  howTo,
  win,
  stake,
  concept,
  actionLabel,
  onStart,
}: ChallengeIntroProps) {
  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-8">
      <StarField density={70} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        {/* Decorative avatar */}
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-primary/40"
            initial={{ scale: 0.7, opacity: 0.6 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
          <div
            aria-hidden="true"
            className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-nexus text-4xl glow-primary"
          >
            {emoji}
          </div>
        </div>

        {tagline && (
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.3em] text-accent">{tagline}</p>
        )}
        <h1 className="mt-1 font-display text-3xl font-black">{title}</h1>

        {/* Briefing rows */}
        <div className="mt-6 space-y-2.5 text-left">
          <IntroRow icon={<Target className="h-5 w-5 text-primary" />} label="Tu misión" value={howTo} />
          <IntroRow icon={<Trophy className="h-5 w-5 text-gold" />} label="Cómo ganas" value={win} />
          <IntroRow icon={<ShieldAlert className="h-5 w-5 text-orange-400" />} label="En juego" value={stake} />
          <IntroRow
            icon={<BrainCircuit className="h-5 w-5 text-accent" />}
            label="Concepto"
            value={concept}
          />
        </div>

        <button
          onClick={onStart}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-nexus px-6 py-4 text-lg font-black text-primary-foreground glow-primary transition hover:scale-[1.02] active:scale-[0.99]"
        >
          <Play className="h-5 w-5" aria-hidden="true" /> {actionLabel}
        </button>
      </motion.div>
    </div>
  );
}

function IntroRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3 backdrop-blur">
      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background/60">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-bold leading-snug text-foreground">{value}</p>
      </div>
    </div>
  );
}
