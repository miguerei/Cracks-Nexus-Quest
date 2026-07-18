import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Puzzle, Flame, XCircle, Link2 } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameFrame } from "@/components/game/GameFrame";
import { CrystalIcon } from "@/components/game/CrystalIcon";
import { getMissionContent, getWorldById } from "@/services/gameService";
import { useFinishChallenge } from "@/lib/useFinishChallenge";
import { useChallengeGuard } from "@/lib/useChallengeGuard";
import { ChallengeLocked } from "@/components/game/ChallengeLocked";
import { ChallengeIntro } from "@/components/game/ChallengeIntro";
import { ChallengeFeedback, type FeedbackState } from "@/components/game/ChallengeFeedback";
import { hitFeedback, missFeedback } from "@/lib/challengeFeedback";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/reto/puzzle")({
  validateSearch: (s: Record<string, unknown>): { m?: string } => ({
    m: typeof s.m === "string" ? s.m : undefined,
  }),
  component: CrystalPuzzle,
});

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function CrystalPuzzle() {
  const { m: missionId } = Route.useSearch();
  const content = useMemo(() => getMissionContent(missionId), [missionId]);
  const PUZZLE_PAIRS = content.pairs;
  const finish = useFinishChallenge();
  const allowed = useChallengeGuard("/reto/puzzle", missionId);
  const defs = useMemo(() => shuffle(PUZZLE_PAIRS), [PUZZLE_PAIRS]);
  const [started, setStarted] = useState(false);
  const [selTerm, setSelTerm] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [errors, setErrors] = useState(0);
  const [wrongPair, setWrongPair] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const total = PUZZLE_PAIRS.length;

  function tryMatch(defId: string) {
    if (!selTerm) return;
    const term = PUZZLE_PAIRS.find((p) => p.id === selTerm)?.term;
    if (selTerm === defId) {
      const nm = [...matched, defId];
      const newStreak = streak + 1;
      const newBest = Math.max(bestStreak, newStreak);
      setMatched(nm);
      setStreak(newStreak);
      setBestStreak(newBest);
      setSelTerm(null);
      setFeedback({ kind: "hit", text: hitFeedback(term, "Cristal restaurado"), key: Date.now() });
      toast.success(newStreak >= 2 ? `¡Racha x${newStreak}!` : "¡Cristal alineado!");
      if (nm.length === total) {
        setTimeout(
          () =>
            finish({
              game: content.title ?? "Puzzle de Cristales",
              correct: total,
              total,
              bestStreak: newBest,
              difficulty: 1.1,
              mastered: PUZZLE_PAIRS.map((p) => p.term),
              missionId: missionId ?? "m2",
            }),
          700,
        );
      }
    } else {
      setErrors((e) => e + 1);
      setStreak(0);
      setWrongPair(defId);
      setSelTerm(null);
      setFeedback({ kind: "miss", text: missFeedback(term, "Cristal inestable"), key: Date.now() });
      setTimeout(() => setWrongPair(null), 500);
    }
  }

  if (!allowed) return <ChallengeLocked />;

  if (!started) {
    return (
      <ChallengeIntro
        emoji="💎"
        tagline={getWorldById(content.worldId)?.name ?? "Bosque de la Duda"}
        title={content.title ?? "Puzzle de Cristales"}
        howTo="Toca un concepto y luego el cristal con su definición correcta."
        win="Alinea todos los cristales sin fallar y sube tu racha."
        stake="Cada error rompe la racha y suma un fallo."
        concept={content.concept}
        actionLabel="¡A emparejar!"
        onStart={() => setStarted(true)}
      />
    );
  }

  return (
    <div className="relative min-h-screen">
      <ChallengeFeedback feedback={feedback} />
      <StarField density={70} />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-2 flex items-center gap-2">
          <CrystalIcon kind="crystal" size="sm" />
          <span className="font-display font-bold">Puzzle de Cristales</span>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Restaura el Núcleo del Bosque uniendo cada concepto con su cristal de conocimiento.
        </p>

        {/* Stats HUD */}
        <div className="mb-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
          <span className="inline-flex items-center justify-center gap-1 rounded-full border border-primary/30 bg-card/60 px-2 py-1.5">
            <Link2 className="h-3.5 w-3.5 text-primary" /> {matched.length}/{total}
          </span>
          <span className="inline-flex items-center justify-center gap-1 rounded-full border border-gold/30 bg-card/60 px-2 py-1.5 text-gold">
            <Flame className="h-3.5 w-3.5" /> Racha {streak}{bestStreak > 0 && ` · ${bestStreak}`}
          </span>
          <span className="inline-flex items-center justify-center gap-1 rounded-full border border-destructive/30 bg-card/60 px-2 py-1.5 text-destructive">
            <XCircle className="h-3.5 w-3.5" /> {errors}
          </span>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Terms */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conceptos</p>
            {PUZZLE_PAIRS.map((p) => {
              const done = matched.includes(p.id);
              const sel = selTerm === p.id;
              return (
                <button
                  key={p.id}
                  disabled={done}
                  onClick={() => setSelTerm(p.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left font-semibold transition bevel-highlight",
                    done && "border-energy bg-energy/20 text-energy glow-energy",
                    !done && sel && "border-primary bg-primary/15 text-primary glow-primary",
                    !done && !sel && "border-border bg-card/60 hover:border-primary/60",
                  )}
                >
                  <CrystalIcon kind={done ? "xp" : "crystal"} size="sm" glow={done || sel} />
                  {p.term}
                </button>
              );
            })}
          </div>

          {/* Definitions */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cristales de definición</p>
            {defs.map((p) => {
              const done = matched.includes(p.id);
              const wrong = wrongPair === p.id;
              return (
                <motion.button
                  key={p.id}
                  disabled={done}
                  animate={wrong ? { x: [0, -8, 8, -6, 6, 0] } : {}}
                  onClick={() => tryMatch(p.id)}
                  className={cn(
                    "relative w-full overflow-hidden rounded-2xl border-2 p-4 text-left text-sm transition bevel-highlight",
                    done && "border-energy bg-energy/20 text-energy glow-energy",
                    wrong && "border-secondary bg-fog-void text-foreground",
                    !done && !wrong && "border-border bg-card/60 hover:border-primary/60",
                  )}
                >
                  {p.definition}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
