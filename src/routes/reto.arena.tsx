import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Heart, Skull, Flame, Shield, Waves } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameFrame } from "@/components/game/GameFrame";
import { getMissionContent, getWorldById } from "@/services/gameService";
import { useFinishChallenge } from "@/lib/useFinishChallenge";
import { useChallengeGuard } from "@/lib/useChallengeGuard";
import { ChallengeLocked } from "@/components/game/ChallengeLocked";
import { ChallengeIntro } from "@/components/game/ChallengeIntro";
import { ChallengeFeedback, type FeedbackState } from "@/components/game/ChallengeFeedback";
import { hitFeedback, missFeedback } from "@/lib/challengeFeedback";
import { BattleStageBackdrop, SfxToggle, type BattleEvent } from "@/components/game/world3d/battle3d";
import { usePlayerStore } from "@/store/usePlayerStore";
import { sfx } from "@/lib/sfx";
import { music } from "@/lib/music";
import { MusicToggle } from "@/components/game/world3d/MusicToggle";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/reto/arena")({
  validateSearch: (s: Record<string, unknown>): { m?: string } => ({
    m: typeof s.m === "string" ? s.m : undefined,
  }),
  component: WaveArena,
});

const MAX_HP = 3;

function WaveArena() {
  const { m: missionId } = Route.useSearch();
  const content = useMemo(() => getMissionContent(missionId), [missionId]);
  // Música de combate: capa rítmica suave sobre el tema del mundo (music.ts).
  useEffect(() => {
    music.enterBattle("duelo", content.worldId);
    return () => music.stop(900);
  }, [content.worldId]);
  // Each wave = one enemy carrying a concept-question.
  const WAVES = useMemo(() => content.questions.slice(0, 6), [content]);
  const finish = useFinishChallenge();
  const allowed = useChallengeGuard("/reto/arena", missionId);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [hp, setHp] = useState(MAX_HP);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [defeated, setDefeated] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [mastered, setMastered] = useState<string[]>([]);
  const [weak, setWeak] = useState<string[]>([]);
  // Escenario 3D de fondo: oleada superada = hechizo + retroceso de la horda;
  // fallo = pulso del Vacío. Solo presentación y sonido.
  const avatar = usePlayerStore((s) => s.avatar);
  const [stageEvent, setStageEvent] = useState<BattleEvent>({ kind: "idle", n: 0 });

  const q = WAVES[i];

  function attack(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    const ok = idx === q.answer;
    if (ok) {
      setDefeated(true);
      setCorrect((c) => c + 1);
      const ns = streak + 1;
      setStreak(ns);
      setBest((b) => Math.max(b, ns));
      setMastered((m) => [...m, q.concept]);
      setFeedback({ kind: "hit", text: hitFeedback(q.concept, "Enemigo derribado"), key: Date.now() });
      toast.success(`¡Oleada ${i + 1} superada!`);
    } else {
      setHp((h) => Math.max(0, h - 1));
      setStreak(0);
      setWeak((w) => [...w, q.concept]);
      setFeedback({ kind: "miss", text: missFeedback(q.concept, "El Vacío avanza"), key: Date.now() });
    }
    // Evento del escenario 3D (solo presentación, la lógica no cambia):
    // sin corazones → derrota; última oleada → según mayoría de aciertos;
    // el resto → hechizo (la horda retrocede) o pulso del Vacío.
    const dead = !ok && hp - 1 <= 0;
    const last = i + 1 >= WAVES.length;
    const finalCorrect = correct + (ok ? 1 : 0);
    const kind: BattleEvent["kind"] = dead
      ? "defeat"
      : last
        ? finalCorrect >= Math.ceil(WAVES.length / 2)
          ? "victory"
          : "defeat"
        : ok
          ? "cast"
          : "miss";
    setStageEvent((e) => ({ kind, n: e.n + 1 }));
    sfx.battle(kind);
    setTimeout(next, 900);
  }

  function next() {
    const dead = hp - 1 <= 0 && picked !== q.answer;
    const last = i + 1 >= WAVES.length;
    if (dead || last) {
      finish({
        game: content.title ?? "Arena de Oleadas",
        correct,
        total: WAVES.length,
        bestStreak: best,
        difficulty: 1.4,
        mastered,
        weak,
        missionId: missionId ?? "m4",
      });
      return;
    }
    setI((n) => n + 1);
    setPicked(null);
    setDefeated(false);
    setFeedback(null);
  }

  if (!allowed) return <ChallengeLocked />;

  if (!started) {
    return (
      <ChallengeIntro
        emoji="⚔️"
        tagline={getWorldById(content.worldId)?.name ?? "Bosque de la Duda"}
        title={content.title ?? "Arena de Oleadas"}
        howTo="Derrota a cada enemigo tocando la respuesta correcta."
        win="Supera todas las oleadas sin quedarte sin vida."
        stake="Cada fallo te quita un corazón. Con tres fallos, caes."
        concept={content.concept}
        actionLabel="¡A la arena!"
        onStart={() => setStarted(true)}
      />
    );
  }

  const voidAdvance = ((i + (defeated ? 1 : 0)) / WAVES.length) * 100;

  return (
    <div className="relative min-h-screen">
      <ChallengeFeedback feedback={feedback} />
      <StarField density={80} />
      {/* Fondo 3D de la arena: la horda de Sombras del Vacío entre ruinas */}
      <BattleStageBackdrop variant="horda" classId={avatar.classId} heroColor={avatar.color} event={stageEvent} />
      <MusicToggle className="fixed bottom-4 right-16 z-40 grid h-10 w-10 place-items-center rounded-full border border-border bg-card/70 text-sm backdrop-blur transition hover:border-primary/60" />
      <SfxToggle />
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-card/60 px-3 py-1.5 backdrop-blur">
            <Swords className="h-5 w-5 text-accent" />
            <span className="font-display text-sm font-bold">Arena de Oleadas</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-card/60 px-3 py-1.5 text-sm font-bold text-gold backdrop-blur">
              <Flame className="h-4 w-4" /> x{streak}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm font-bold backdrop-blur">
              <Waves className="h-4 w-4 text-accent" /> {i + 1}/{WAVES.length}
            </span>
          </div>
        </div>

        {/* Void advance bar */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Avance del Vacío</span>
            <span className="inline-flex items-center gap-1">
              {Array.from({ length: MAX_HP }).map((_, h) => (
                <Heart key={h} className={cn("h-4 w-4", h < hp ? "fill-destructive text-destructive" : "text-muted-foreground/40")} />
              ))}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted/70 ring-1 ring-inset ring-border">
            <motion.div className="h-full bg-gradient-void" animate={{ width: `${voidAdvance}%` }} transition={{ type: "spring", stiffness: 120 }} />
          </div>
        </div>

        {/* Combat arena */}
        <GameFrame glow="violet" className="mb-6 overflow-hidden text-center">
          <div className="pointer-events-none absolute inset-0 bg-fog-void opacity-60" aria-hidden="true" />
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={q.id}
                initial={{ y: -40, opacity: 0 }}
                animate={defeated ? { scale: 0, rotate: 180, opacity: 0 } : { y: [0, -8, 0], opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={defeated ? { type: "spring", stiffness: 140 } : { y: { duration: 2.4, repeat: Infinity }, opacity: { duration: 0.3 } }}
                className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-void glow-violet"
              >
                {defeated ? <Skull className="h-10 w-10 text-muted-foreground" /> : <Waves className="h-10 w-10 text-secondary-foreground" />}
              </motion.div>
            </AnimatePresence>
            <p className="mt-3 text-sm text-muted-foreground">Una sombra del Vacío te bloquea el paso</p>
          </div>
        </GameFrame>

        {/* Question + answers */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Shield className="h-4 w-4 text-accent" /> Elige tu golpe
          </div>
          <AnimatePresence mode="wait">
            <motion.h2 key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 text-center text-xl font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
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
                  whileHover={{ scale: picked === null ? 1.04 : 1 }}
                  onClick={() => attack(idx)}
                  disabled={picked !== null}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border-2 p-5 text-center font-semibold backdrop-blur-sm transition bevel-highlight",
                    !show && "border-accent/40 bg-card/60 hover:border-accent hover:glow-energy",
                    show && isAns && "border-energy bg-energy/20 text-energy glow-energy",
                    show && chosen && !isAns && "border-destructive bg-destructive/20",
                    show && !isAns && !chosen && "border-border bg-card/40 opacity-60",
                  )}
                >
                  <span className={cn("grid h-9 w-9 place-items-center rounded-xl", show && isAns ? "bg-energy/20" : "bg-accent/15")}>
                    <Swords className={cn("h-5 w-5", show && isAns ? "text-energy" : "text-accent")} />
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
