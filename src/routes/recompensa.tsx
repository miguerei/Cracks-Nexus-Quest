import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Trophy,
  Home,
  Sparkles,
  Compass,
  Target,
  Flame,
  Zap,
  ArrowUp,
  BrainCircuit,
} from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { SystemScreen } from "@/components/game/SystemScreen";
import { GameButton } from "@/components/game/GameButton";
import { GameFrame } from "@/components/game/GameFrame";
import { RewardCard } from "@/components/game/RewardCard";
import { getCurrentWorldId } from "@/services/gameService";
import { usePlayerStore, usePlayerHydrated } from "@/store/usePlayerStore";

export const Route = createFileRoute("/recompensa")({
  component: Reward,
});

/** Count-up number for that satisfying "points ticking up" feel. */
function useCountUp(target: number, duration = 1000, delay = 0) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    let start: number | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    timer = setTimeout(() => {
      raf.current = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration, delay]);
  return value;
}

function Reward() {
  const hydrated = usePlayerHydrated();
  const lastReward = usePlayerStore((s) => s.lastReward);

  // Wait for persisted state before deciding anything, so a reload doesn't
  // flash an empty state before the last reward rehydrates from localStorage.
  if (!hydrated) {
    return (
      <SystemScreen
        spin
        tone="primary"
        title="Nova está abriendo el cofre…"
        message="Recuperando tu última recompensa. Un instante."
      />
    );
  }

  // No valid reward to show (direct link, shared URL, or fresh player).
  if (!lastReward) return <NoReward />;

  return <RewardView key={lastReward.id} />;
}

function RewardView() {
  const lastReward = usePlayerStore((s) => s.lastReward)!;
  const missionsCleared = usePlayerStore((s) => s.missionsCleared);
  const worldsCleared = usePlayerStore((s) => s.worldsCleared);
  const mundoActual = getCurrentWorldId({ worldsCleared, missionsCleared });
  const {
    xp,
    crystals,
    coins,
    points,
    nexos,
    correct,
    total,
    game,
    perfect,
    accuracy,
    bestStreak,
    streakBonus,
    missionTitle,
    concept,
    prevLevel,
    newLevel,
  } = lastReward;

  const leveledUp = typeof newLevel === "number" && typeof prevLevel === "number" && newLevel > prevLevel;
  const xpCount = useCountUp(xp, 1100, 250);
  const streak = bestStreak ?? 0;

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <StarField density={100} />
      <div className="w-full max-w-md text-center">
        {/* Mission complete banner */}
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-bold uppercase tracking-[0.3em] text-energy"
        >
          {perfect ? "★ Misión perfecta ★" : "Misión completada"}
        </motion.p>

        {/* Chest / trophy with radiating glow */}
        <div className="relative mx-auto mt-4 grid h-32 w-32 place-items-center">
          {[0, 1, 2].map((r) => (
            <motion.span
              key={r}
              className="absolute inset-0 rounded-full border-2 border-gold/40"
              initial={{ scale: 0.6, opacity: 0.7 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, delay: r * 0.5, ease: "easeOut" }}
            />
          ))}
          <motion.div
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 11 }}
            className="relative grid h-28 w-28 place-items-center rounded-full bg-gradient-gold text-6xl glow-gold bevel-highlight"
          >
            <motion.span
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              {perfect ? "🎁" : "🏆"}
            </motion.span>
          </motion.div>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-3xl font-black"
        >
          {perfect ? "¡Reto Perfecto!" : "¡Reto Superado!"}
        </motion.h1>
        <p className="mt-1 text-lg font-bold text-gradient-nexus">{missionTitle ?? game}</p>

        {/* Level up banner */}
        {leveledUp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9, type: "spring", stiffness: 220, damping: 12 }}
            className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-secondary/50 bg-secondary/15 px-4 py-2 text-sm font-black text-secondary glow-violet"
          >
            <ArrowUp className="h-4 w-4" /> ¡Subiste al nivel {newLevel}!
          </motion.div>
        )}

        {/* XP bar with count-up */}
        <div className="mx-auto mt-6 max-w-xs">
          <div className="mb-1 flex justify-between text-xs uppercase tracking-wide text-muted-foreground">
            <span>Experiencia ganada</span>
            <span className="font-black tabular-nums text-energy">+{xpCount} XP</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted bevel-highlight">
            <motion.div
              className="h-full rounded-full bg-gradient-energy"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.1, delay: 0.25, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Reward cards con rareza del Art Bible (count-up preservado) */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <CountedRewardCard rarity="blue" resource="crystal" title="Cristales" amount={crystals} index={0} delay={350} />
          <CountedRewardCard rarity="gold" resource="coin" title="Monedas" amount={coins} index={1} delay={450} />
          <CountedRewardCard rarity="violet" resource="points" title="Puntos" amount={points} index={2} delay={550} />
        </div>

        {/* Mission summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mt-4"
        >
          <GameFrame className="space-y-2 p-4 text-left text-sm">
            {concept && (
              <SummaryRow icon={<BrainCircuit className="h-4 w-4 text-accent" />} label="Concepto dominado" value={concept} />
            )}
            <SummaryRow icon={<Target className="h-4 w-4 text-energy" />} label="Precisión" value={`${accuracy}% · ${correct}/${total}`} />
            <SummaryRow icon={<Flame className="h-4 w-4 text-orange-400" />} label="Racha máxima" value={`x${streak}`} />
            {typeof streakBonus === "number" && streakBonus > 0 && (
              <SummaryRow icon={<Zap className="h-4 w-4 text-gold" />} label="Bonus de racha" value={`+${streakBonus}`} />
            )}
          </GameFrame>
        </motion.div>

        {nexos > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-secondary/50 bg-secondary/10 px-4 py-2 text-sm font-black text-secondary glow-violet"
          >
            <Sparkles className="h-4 w-4" /> +{nexos} Nexo obtenido
          </motion.div>
        )}

        {perfect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-4 rounded-2xl border border-gold/50 bg-gold/10 p-3 text-sm font-semibold text-gold"
          >
            🎁 ¡Cofre bonus desbloqueado por precisión perfecta!
          </motion.div>
        )}

        <div className="mt-6">
          <NovaBubble
            mood="celebrate"
            message={perfect ? "¡Increíble! Has roto la niebla de la confusión." : "¡Bien hecho! Sigue así y subirás en el ranking."}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <GameButton asChild variant="primary" size="lg" className="flex-1">
            <Link to="/mundo/$worldId" params={{ worldId: mundoActual }}>Siguiente reto</Link>
          </GameButton>
          <GameButton asChild variant="ghost" size="lg" className="flex-1">
            <Link to="/ranking">
              <Trophy className="h-4 w-4" /> Ranking
            </Link>
          </GameButton>
        </div>
        <Link
          to="/hub"
          className="mt-3 inline-flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Home className="h-4 w-4" /> Volver al Hub
        </Link>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  );
}

function NoReward() {
  return (
    <SystemScreen
      icon="🎁"
      title="Aún no hay cofre que abrir"
      message="Supera un reto del Bosque para ganar XP, cristales y monedas. Tu próximo cofre aparecerá aquí."
      novaMessage="¡Elige una misión y demuestra lo que sabes para llenar tu cofre!"
    >
      <GameButton asChild variant="primary" size="lg" className="flex-1">
        <Link to="/mapa">
          <Compass className="h-4 w-4" /> Ir al mapa de mundos
        </Link>
      </GameButton>
      <GameButton asChild variant="ghost" size="lg" className="flex-1">
        <Link to="/hub">
          <Home className="h-4 w-4" /> Volver al Hub
        </Link>
      </GameButton>
    </SystemScreen>
  );
}

/**
 * RewardCard del Art Bible con el count-up "ticking up" preservado: sólo
 * muestra los valores ya presentes en lastReward, nunca los aplica al store.
 */
function CountedRewardCard({
  rarity,
  resource,
  title,
  amount,
  index,
  delay,
}: {
  rarity: React.ComponentProps<typeof RewardCard>["rarity"];
  resource: React.ComponentProps<typeof RewardCard>["resource"];
  title: string;
  amount: number;
  index: number;
  delay: number;
}) {
  const count = useCountUp(amount, 900, delay);
  return <RewardCard rarity={rarity} resource={resource} title={title} amount={count} index={index} />;
}
