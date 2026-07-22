import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Flame, Timer, Rocket, Flag } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameFrame } from "@/components/game/GameFrame";
import { getMissionContent, getWorldById, getWorldOfMission } from "@/services/gameService";
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

export const Route = createFileRoute("/reto/duelo")({
  validateSearch: (s: Record<string, unknown>): { m?: string } => ({
    m: typeof s.m === "string" ? s.m : undefined,
  }),
  component: PortalRace,
});

const TIME = 10;

function PortalRace() {
  const { m: missionId } = Route.useSearch();
  const content = useMemo(() => getMissionContent(missionId), [missionId]);
  // Música de combate: capa rítmica suave sobre el tema del mundo (music.ts).
  useEffect(() => {
    music.enterBattle("duelo", content.worldId);
    return () => music.stop(900);
  }, [content.worldId]);
  const QS = useMemo(() => content.questions.slice(0, 5), [content]);
  const finish = useFinishChallenge();
  const allowed = useChallengeGuard("/reto/duelo", missionId);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState(TIME);
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [mastered, setMastered] = useState<string[]>([]);
  const [weak, setWeak] = useState<string[]>([]);
  // Escenario 3D de fondo: responder bien = hechizo, fallar = pulso del Vacío.
  const avatar = usePlayerStore((s) => s.avatar);
  const [stageEvent, setStageEvent] = useState<BattleEvent>({ kind: "idle", n: 0 });

  const q = QS[i];

  useEffect(() => {
    if (!started) return;
    if (picked !== null) return;
    if (time <= 0) { answer(-1); return; }
    const t = setTimeout(() => setTime((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [time, picked, started]);

  function answer(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    const ok = idx === q.answer;
    if (ok) {
      const ns = streak + 1;
      setStreak(ns);
      setBest((b) => Math.max(b, ns));
      setCorrect((c) => c + 1);
      setProgress((p) => Math.min(100, p + 100 / QS.length));
      setMastered((m) => [...m, q.concept]);
      setFeedback({ kind: "hit", text: hitFeedback(q.concept, "Portal cruzado"), key: Date.now() });
    } else {
      setStreak(0);
      setProgress((p) => Math.max(0, p - 6));
      setWeak((w) => [...w, q.concept]);
      setFeedback({ kind: "miss", text: missFeedback(q.concept, "El Vacío se fortalece"), key: Date.now() });
    }
    // Evento del escenario 3D (solo presentación, la lógica no cambia):
    // última pregunta → victoria/derrota; el resto → hechizo o pulso del Vacío.
    const last = i + 1 >= QS.length;
    const finalCorrect = correct + (ok ? 1 : 0);
    const kind: BattleEvent["kind"] = last
      ? finalCorrect >= Math.ceil(QS.length / 2)
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
    if (i + 1 >= QS.length) {
      finish({ game: content.title ?? "Carrera de Portales", correct, total: QS.length, bestStreak: best, mastered, weak, missionId: missionId ?? "m1" });
      return;
    }
    setI((n) => n + 1);
    setPicked(null);
    setFeedback(null);
    setTime(TIME);
  }

  if (!allowed) return <ChallengeLocked />;

  if (!started) {
    return (
      <ChallengeIntro
        emoji="🚀"
        tagline={getWorldById(content.worldId)?.name ?? "Bosque de la Duda"}
        title={content.title ?? "Carrera de Portales"}
        howTo="Cruza cada portal tocando la respuesta correcta antes de que se acabe el tiempo."
        win="Encadena aciertos rápidos y llega el primero a la meta."
        stake="Cada fallo frena tu nave. El reloj no perdona."
        concept={content.concept}
        actionLabel="¡A correr!"
        onStart={() => setStarted(true)}
      />
    );
  }


  return (
    <div className="relative min-h-screen">
      <ChallengeFeedback feedback={feedback} />
      <StarField density={70} />
      {/* Fondo 3D del duelo: héroe de espaldas frente al rival entre ruinas */}
      <BattleStageBackdrop variant="rival" classId={avatar.classId} heroColor={avatar.color} event={stageEvent} />
      <MusicToggle className="fixed bottom-4 right-16 z-40 grid h-10 w-10 place-items-center rounded-full border border-border bg-card/70 text-sm backdrop-blur transition hover:border-primary/60" />
      <SfxToggle />
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
        {/* HUD */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/60 px-3 py-1.5 backdrop-blur">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-display text-sm font-bold">Carrera de Portales</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-card/60 px-3 py-1.5 text-sm font-bold text-gold backdrop-blur">
              <Flame className="h-4 w-4" /> x{streak}
            </span>
            <span
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold tabular-nums backdrop-blur",
                time <= 3 ? "bg-destructive text-destructive-foreground" : "border border-primary/30 bg-card/60 text-primary",
              )}
            >
              <Timer className="h-4 w-4" /> {time}
            </span>
          </div>
        </div>

        {/* Race track */}
        <GameFrame glow="energy" className="mb-6 p-4">
          <p className="mb-2 text-center text-xs uppercase tracking-widest text-muted-foreground">Pregunta {i + 1} de {QS.length}</p>
          <div className="relative h-4 overflow-hidden rounded-full bg-muted/70 ring-1 ring-inset ring-border">
            <motion.div className="h-full rounded-full bg-gradient-energy glow-energy" animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 120 }} />
          </div>
          <div className="relative mt-1 h-6">
            <motion.span className="absolute -top-1 text-energy" animate={{ left: `calc(${progress}% - 12px)` }} transition={{ type: "spring", stiffness: 120 }}>
              <Rocket className="h-5 w-5 -rotate-45" />
            </motion.span>
            <Flag className="absolute right-0 top-0 h-5 w-5 text-gold" />
          </div>
        </GameFrame>

        {/* Question */}
        <div className="flex flex-1 flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.h2 key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mb-8 text-center text-2xl font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
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
                  onClick={() => answer(idx)}
                  disabled={picked !== null}
                  className={cn(
                    "group relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 p-5 text-center font-semibold backdrop-blur-sm transition",
                    !show && "border-primary/40 bg-card/60 hover:border-primary hover:glow-primary",
                    show && isAns && "border-energy bg-energy/20 text-energy glow-energy",
                    show && chosen && !isAns && "border-destructive bg-destructive/20",
                    show && !isAns && !chosen && "border-border bg-card/40 opacity-60",
                  )}
                >
                  {/* Portal ring */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "relative grid h-12 w-12 place-items-center rounded-full",
                      show && isAns ? "bg-energy/20" : "bg-primary/15",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute inset-0 rounded-full border-2 transition",
                        show && isAns ? "border-energy" : "border-primary/60 group-hover:border-primary",
                      )}
                    />
                    <span
                      className={cn(
                        "absolute inset-1.5 rounded-full border transition",
                        show && isAns ? "border-energy/60" : "border-primary/30",
                      )}
                    />
                    <Zap className={cn("h-5 w-5", show && isAns ? "text-energy" : "text-primary")} />
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
