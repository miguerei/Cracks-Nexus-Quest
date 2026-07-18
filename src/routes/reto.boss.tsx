import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Heart, Shield, Swords, Sparkles, Skull } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameFrame } from "@/components/game/GameFrame";
import { getMissionContent, getWorldById, getWorldOfMission } from "@/services/gameService";
import { useFinishChallenge } from "@/lib/useFinishChallenge";
import { useChallengeGuard } from "@/lib/useChallengeGuard";
import { ChallengeLocked } from "@/components/game/ChallengeLocked";
import { ChallengeIntro } from "@/components/game/ChallengeIntro";
import { ChallengeFeedback, type FeedbackState } from "@/components/game/ChallengeFeedback";
import { hitFeedback, missFeedback } from "@/lib/challengeFeedback";
import { BattleStageBackdrop, type BattleEvent } from "@/components/game/world3d/battle3d";
import { usePlayerStore } from "@/store/usePlayerStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/reto/boss")({
  validateSearch: (s: Record<string, unknown>): { m?: string } => ({
    m: typeof s.m === "string" ? s.m : undefined,
  }),
  component: BossBattle,
});

const PHASES = ["Ataque", "Defensa", "Furia final"] as const;
const PHASE_META = [
  { icon: Swords, glow: "glow-primary", ring: "border-primary/50", chip: "bg-primary/15 text-primary", tint: "text-primary" },
  { icon: Shield, glow: "glow-energy", ring: "border-energy/50", chip: "bg-energy/15 text-energy", tint: "text-energy" },
  { icon: Skull, glow: "glow-violet", ring: "border-secondary/50", chip: "bg-secondary/15 text-secondary", tint: "text-secondary" },
] as const;

function BossBattle() {
  const { m: missionId } = Route.useSearch();
  const content = useMemo(() => getMissionContent(missionId), [missionId]);
  const QS = useMemo(() => content.questions, [content]);
  const BOSS_MAX = QS.length;
  const finish = useFinishChallenge();
  const allowed = useChallengeGuard("/reto/boss", missionId);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [bossHp, setBossHp] = useState(QS.length);
  const [playerHp, setPlayerHp] = useState(3);
  const [correct, setCorrect] = useState(0);
  const [best, setBest] = useState(0);
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [mastered, setMastered] = useState<string[]>([]);
  const [weak, setWeak] = useState<string[]>([]);
  // Escenario 3D de fondo: el Coloso del Vacío; acierto = hechizo al núcleo.
  const avatar = usePlayerStore((s) => s.avatar);
  const [stageEvent, setStageEvent] = useState<BattleEvent>({ kind: "idle", n: 0 });

  const q = QS[i];
  const phase = Math.min(PHASES.length - 1, Math.floor((i / QS.length) * PHASES.length));
  const meta = PHASE_META[phase];
  const PhaseIcon = meta.icon;

  function answer(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    const ok = idx === q.answer;
    if (ok) {
      setBossHp((h) => h - 1);
      setCorrect((c) => c + 1);
      const ns = streak + 1;
      setStreak(ns);
      setBest((b) => Math.max(b, ns));
      setMastered((m) => [...m, q.concept]);
      setFeedback({ kind: "hit", text: hitFeedback(q.concept, "Golpe crítico"), key: Date.now() });
      toast.success("¡Golpe crítico! Zumbra se debilita");
    } else {
      setPlayerHp((h) => h - 1);
      setStreak(0);
      setShake(true);
      setWeak((w) => [...w, q.concept]);
      setFeedback({ kind: "miss", text: missFeedback(q.concept, "Zumbra contraataca"), key: Date.now() });
      setTimeout(() => setShake(false), 500);
    }
    // Evento del escenario 3D (solo presentación, la lógica no cambia):
    // núcleo destruido → victoria; sin corazones o preguntas agotadas → derrota.
    const last = i + 1 >= QS.length;
    const bossDown = ok && bossHp - 1 <= 0;
    const playerDown = !ok && playerHp - 1 <= 0;
    const kind: BattleEvent["kind"] = bossDown
      ? "victory"
      : playerDown || (last && !ok)
        ? "defeat"
        : ok
          ? "cast"
          : "miss";
    setStageEvent((e) => ({ kind, n: e.n + 1 }));
    setTimeout(next, 950);
  }

  function next() {
    const last = i + 1 >= QS.length;
    if (last || bossHp - 1 <= 0 || playerHp <= 0) {
      finish({
        game: content.title ?? "Boss Zumbra",
        correct: bossHp - 1 <= 0 ? QS.length : correct,
        total: QS.length,
        bestStreak: best,
        difficulty: 1.5,
        mastered,
        weak,
        worldId: getWorldOfMission(missionId ?? "m5"),
        missionId: missionId ?? "m5",
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
        emoji="👹"
        tagline={`Jefe final · ${getWorldById(content.worldId)?.name ?? "Bosque"}`}
        title={content.title ?? "Zumbra, el Vacío"}
        howTo="Acierta las cartas-respuesta para golpear al boss fase tras fase."
        win="Agota la vida del boss y libera el Núcleo del mundo."
        stake="Sus ataques te restan corazones. Si caes, el mundo sigue atrapado."
        concept={content.concept}
        actionLabel="¡A por el boss!"
        onStart={() => setStarted(true)}
      />
    );
  }


  return (
    <div className="relative min-h-screen">
      <ChallengeFeedback feedback={feedback} />
      <StarField density={90} />
      {/* Fondo 3D del jefe: el Coloso del Vacío entre ruinas, retícula al núcleo */}
      <BattleStageBackdrop variant="boss" classId={avatar.classId} heroColor={avatar.color} event={stageEvent} />
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-5">
        {/* Boss epic header */}
        <GameFrame glow={phase === 2 ? "violet" : phase === 1 ? "energy" : "primary"} className="mb-4 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-fog-void opacity-50" aria-hidden="true" />
          <div className="relative text-center">
            <div className="mb-3 flex items-center justify-center gap-2">
              <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold", meta.chip)}>
                <Crown className="h-3.5 w-3.5" /> Fase: {PHASES[phase]}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-background/50 px-2.5 py-1 text-xs font-bold text-muted-foreground">
                <PhaseIcon className={cn("h-3.5 w-3.5", meta.tint)} />
              </span>
            </div>

            <motion.div
              animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : { y: [0, -8, 0] }}
              transition={shake ? { duration: 0.4 } : { duration: 3, repeat: Infinity }}
              className={cn("mx-auto grid h-24 w-24 place-items-center rounded-full border-2 bg-gradient-void", meta.glow, meta.ring)}
            >
              <span className="text-5xl">{content.mission?.npcEmoji ?? "👹"}</span>
            </motion.div>
            <p className="mt-3 font-display text-lg font-bold">{content.mission?.npc ?? "Zumbra, Reina de las Interrupciones"}</p>


            {/* Boss HP */}
            <div className="mx-auto mt-3 max-w-sm">
              <div className="h-3.5 overflow-hidden rounded-full bg-muted/70 ring-1 ring-inset ring-border">
                <motion.div className="h-full bg-gradient-void glow-violet" animate={{ width: `${(bossHp / BOSS_MAX) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Vida del boss: {Math.max(0, bossHp)}/{BOSS_MAX}</p>
            </div>

            {/* Player HP */}
            <div className="mt-3 flex items-center justify-center gap-1">
              {Array.from({ length: 3 }).map((_, h) => (
                <Heart key={h} className={cn("h-5 w-5", h < playerHp ? "fill-destructive text-destructive" : "text-muted-foreground/40")} />
              ))}
            </div>
          </div>
        </GameFrame>

        {/* Question as combat actions */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Sparkles className={cn("h-4 w-4", meta.tint)} /> Elige tu acción de combate
          </div>
          <AnimatePresence mode="wait">
            <motion.h2 key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-5 text-center text-xl font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
              {q.prompt}
            </motion.h2>
          </AnimatePresence>

          <div className="grid gap-3 sm:grid-cols-3">
            {q.options.map((opt, idx) => {
              const isAns = idx === q.answer;
              const chosen = picked === idx;
              const show = picked !== null;
              return (
                <motion.button
                  key={idx}
                  whileHover={{ scale: picked === null ? 1.05 : 1, y: picked === null ? -6 : 0 }}
                  onClick={() => answer(idx)}
                  disabled={picked !== null}
                  className={cn(
                    "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center text-sm font-semibold backdrop-blur-sm transition bevel-highlight sm:min-h-28",
                    !show && "border-secondary/50 bg-card/70 hover:border-secondary hover:glow-violet",
                    show && isAns && "border-energy bg-energy/20 text-energy glow-energy",
                    show && chosen && !isAns && "border-destructive bg-destructive/20",
                    show && !isAns && !chosen && "border-border bg-card/40 opacity-60",
                  )}
                >
                  <span className={cn("grid h-8 w-8 place-items-center rounded-lg", show && isAns ? "bg-energy/20" : "bg-secondary/15")}>
                    <Swords className={cn("h-4 w-4", show && isAns ? "text-energy" : "text-secondary")} />
                  </span>
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
