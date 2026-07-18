import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sigma, Flame, Footprints, Flag } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameFrame } from "@/components/game/GameFrame";
import { getAlgoritmosEquations } from "@/services/gameService";
import { useFinishChallenge } from "@/lib/useFinishChallenge";
import { useChallengeGuard } from "@/lib/useChallengeGuard";
import { ChallengeLocked } from "@/components/game/ChallengeLocked";
import { ChallengeIntro } from "@/components/game/ChallengeIntro";
import { ChallengeFeedback, type FeedbackState } from "@/components/game/ChallengeFeedback";
import { hitFeedback, missFeedback } from "@/lib/challengeFeedback";
import { cn } from "@/lib/utils";

const EQUATIONS = getAlgoritmosEquations();

export const Route = createFileRoute("/reto/puentes")({
  validateSearch: (s: Record<string, unknown>): { m?: string } => ({
    m: typeof s.m === "string" ? s.m : undefined,
  }),
  component: EquationBridges,
});

function EquationBridges() {
  const { m: missionId } = Route.useSearch();
  const finish = useFinishChallenge();
  const allowed = useChallengeGuard("/reto/puentes", missionId);
  const eqs = useMemo(() => EQUATIONS, []);
  const total = eqs.length;

  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [segments, setSegments] = useState(0); // bridge segments placed
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const eq = eqs[i];

  function answer(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    const ok = idx === eq.answer;
    if (ok) {
      const ns = streak + 1;
      setStreak(ns);
      setBest((b) => Math.max(b, ns));
      setCorrect((c) => c + 1);
      setSegments((s) => s + 1);
      setFeedback({ kind: "hit", text: hitFeedback("Ecuaciones", "Puente tendido"), key: Date.now() });
    } else {
      setStreak(0);
      setFeedback({ kind: "miss", text: missFeedback("Ecuaciones", "El puente se tambalea"), key: Date.now() });
    }
    setTimeout(next, 950);
  }

  function next() {
    if (i + 1 >= total) {
      finish({
        game: "Puentes de Ecuaciones",
        correct,
        total,
        bestStreak: best,
        difficulty: 1.2,
        mastered: ["Ecuaciones y despejes"],
        missionId: missionId ?? "a1",
      });
      return;
    }
    setI((n) => n + 1);
    setPicked(null);
    setFeedback(null);
  }

  if (!allowed) return <ChallengeLocked />;

  if (!started) {
    return (
      <ChallengeIntro
        emoji="🌉"
        tagline="Ciudad de los Algoritmos"
        title="Puentes de Ecuaciones"
        howTo="Despeja la incógnita de cada ecuación y elige la solución correcta para tender el puente."
        win="Resuelve todas las ecuaciones y cruza el abismo lógico sin caer."
        stake="Cada fallo hace tambalear el puente y rompe tu racha."
        concept="Ecuaciones y despejes"
        actionLabel="¡A construir!"
        onStart={() => setStarted(true)}
      />
    );
  }

  const progress = (segments / total) * 100;

  return (
    <div className="relative min-h-screen">
      <ChallengeFeedback feedback={feedback} />
      <StarField density={70} />
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
        {/* HUD */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/60 px-3 py-1.5 backdrop-blur">
            <Sigma className="h-5 w-5 text-primary" />
            <span className="font-display text-sm font-bold">Puentes de Ecuaciones</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-card/60 px-3 py-1.5 text-sm font-bold text-gold backdrop-blur">
            <Flame className="h-4 w-4" /> x{streak}
          </span>
        </div>

        {/* Bridge track */}
        <GameFrame glow="energy" className="mb-6 p-4">
          <p className="mb-2 text-center text-xs uppercase tracking-widest text-muted-foreground">
            Puente {Math.min(i + 1, total)} de {total}
          </p>
          <div className="relative h-4 overflow-hidden rounded-full bg-muted/70 ring-1 ring-inset ring-border">
            <motion.div className="h-full rounded-full bg-gradient-energy glow-energy" animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 120 }} />
          </div>
          <div className="relative mt-1 h-6">
            <motion.span className="absolute -top-1 text-energy" animate={{ left: `calc(${progress}% - 12px)` }} transition={{ type: "spring", stiffness: 120 }}>
              <Footprints className="h-5 w-5" />
            </motion.span>
            <Flag className="absolute right-0 top-0 h-5 w-5 text-gold" />
          </div>
        </GameFrame>

        {/* Equation */}
        <div className="flex flex-1 flex-col justify-center">
          <p className="mb-2 text-center text-xs uppercase tracking-widest text-muted-foreground">Despeja la incógnita</p>
          <AnimatePresence mode="wait">
            <motion.h2 key={eq.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mb-8 text-center font-display text-4xl font-black tracking-wide">
              {eq.equation}
            </motion.h2>
          </AnimatePresence>

          <div className="grid gap-3 sm:grid-cols-3">
            {eq.options.map((opt, idx) => {
              const isAns = idx === eq.answer;
              const chosen = picked === idx;
              const show = picked !== null;
              return (
                <motion.button
                  key={idx}
                  whileHover={{ scale: picked === null ? 1.04 : 1 }}
                  onClick={() => answer(idx)}
                  disabled={picked !== null}
                  className={cn(
                    "flex min-h-16 items-center justify-center rounded-2xl border-2 p-4 text-center text-lg font-bold tabular-nums transition bevel-highlight",
                    !show && "border-primary/40 bg-card/60 hover:border-primary hover:glow-primary",
                    show && isAns && "border-energy bg-energy/20 text-energy glow-energy",
                    show && chosen && !isAns && "border-destructive bg-destructive/20",
                    show && !isAns && !chosen && "border-border bg-card/40 opacity-60",
                  )}
                >
                  {opt}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
