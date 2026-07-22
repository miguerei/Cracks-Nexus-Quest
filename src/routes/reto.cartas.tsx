import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Heart, Shield, ShieldOff, Sparkles, Layers } from "lucide-react";
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

export const Route = createFileRoute("/reto/cartas")({
  validateSearch: (s: Record<string, unknown>): { m?: string } => ({
    m: typeof s.m === "string" ? s.m : undefined,
  }),
  component: CardDuel,
});

const MAX_HP = 5;

function CardDuel() {
  const { m: missionId } = Route.useSearch();
  const content = useMemo(() => getMissionContent(missionId), [missionId]);
  // Música de combate: capa rítmica suave sobre el tema del mundo (music.ts).
  useEffect(() => {
    music.enterBattle("duelo", content.worldId);
    return () => music.stop(900);
  }, [content.worldId]);
  const QS = useMemo(() => content.questions.slice(0, 5), [content]);
  const finish = useFinishChallenge();
  const allowed = useChallengeGuard("/reto/cartas", missionId);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [playerHp, setPlayerHp] = useState(MAX_HP);
  const [rivalHp, setRivalHp] = useState(MAX_HP);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [rivalHit, setRivalHit] = useState(false);
  const [playerHit, setPlayerHit] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [mastered, setMastered] = useState<string[]>([]);
  const [weak, setWeak] = useState<string[]>([]);
  // Escenario 3D de fondo: carta correcta = hechizo al Duelista del Vacío;
  // carta errónea = pulso del Vacío. Solo presentación y sonido.
  const avatar = usePlayerStore((s) => s.avatar);
  const [stageEvent, setStageEvent] = useState<BattleEvent>({ kind: "idle", n: 0 });

  const q = QS[i];

  function play(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    const ok = idx === q.answer;
    if (ok) {
      setRivalHp((h) => Math.max(0, h - 2));
      setRivalHit(true);
      setCorrect((c) => c + 1);
      const ns = streak + 1;
      setStreak(ns);
      setBest((b) => Math.max(b, ns));
      setMastered((m) => [...m, q.concept]);
      setFeedback({ kind: "hit", text: hitFeedback(q.concept, "Escudo roto"), key: Date.now() });
      toast.success("¡Ataque certero! -2 al rival");
      setTimeout(() => setRivalHit(false), 400);
    } else {
      setPlayerHp((h) => Math.max(0, h - 1));
      setPlayerHit(true);
      setStreak(0);
      setWeak((w) => [...w, q.concept]);
      setFeedback({ kind: "miss", text: missFeedback(q.concept, "Ataque bloqueado"), key: Date.now() });
      setTimeout(() => setPlayerHit(false), 400);
    }
    // Evento del escenario 3D (solo presentación, la lógica no cambia):
    // rival sin vida → victoria; sin corazones → derrota; última carta →
    // según mayoría de aciertos; el resto → hechizo o pulso del Vacío.
    const rivalDown = ok && rivalHp - 2 <= 0;
    const playerDown = !ok && playerHp - 1 <= 0;
    const last = i + 1 >= QS.length;
    const finalCorrect = correct + (ok ? 1 : 0);
    const kind: BattleEvent["kind"] = rivalDown
      ? "victory"
      : playerDown
        ? "defeat"
        : last
          ? finalCorrect >= Math.ceil(QS.length / 2)
            ? "victory"
            : "defeat"
          : ok
            ? "cast"
            : "miss";
    setStageEvent((e) => ({ kind, n: e.n + 1 }));
    sfx.battle(kind);
    setTimeout(next, 950);
  }

  function next() {
    const rivalDown = rivalHp - 2 <= 0;
    const playerDown = playerHp - 1 <= 0;
    const last = i + 1 >= QS.length;
    if (last || rivalDown || playerDown) {
      finish({
        game: content.title ?? "Duelo de Cartas",
        correct,
        total: QS.length,
        bestStreak: best,
        difficulty: 1.3,
        mastered,
        weak,
        missionId: missionId ?? "m3",
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
        emoji="🃏"
        tagline={getWorldById(content.worldId)?.name ?? "Bosque de la Duda"}
        title={content.title ?? "Duelo de Cartas"}
        howTo="Elige la carta-respuesta correcta para atacar al Duelista del Vacío."
        win="Vacía la vida del rival antes de que él acabe con la tuya."
        stake="Cada fallo te resta un corazón. Sin vida, pierdes el duelo."
        concept={content.concept}
        actionLabel="¡A duelo!"
        onStart={() => setStarted(true)}
      />
    );
  }

  const shieldBroken = rivalHp < MAX_HP;

  return (
    <div className="relative min-h-screen">
      <ChallengeFeedback feedback={feedback} />
      <StarField density={70} />
      {/* Fondo 3D del duelo de cartas: el Duelista del Vacío entre ruinas */}
      <BattleStageBackdrop variant="rival" classId={avatar.classId} heroColor={avatar.color} event={stageEvent} />
      <MusicToggle className="fixed bottom-4 right-16 z-40 grid h-10 w-10 place-items-center rounded-full border border-border bg-card/70 text-sm backdrop-blur transition hover:border-primary/60" />
      <SfxToggle />
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-card/60 px-3 py-1.5 backdrop-blur">
            <Swords className="h-5 w-5 text-secondary" />
            <span className="font-display text-sm font-bold">Duelo de Cartas</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm font-bold backdrop-blur">
            <Layers className="h-4 w-4 text-secondary" /> {i + 1}/{QS.length}
          </span>
        </div>

        {/* Rival */}
        <motion.div className="mb-3" animate={rivalHit ? { x: [0, -8, 8, -4, 0] } : {}}>
          <GameFrame glow="violet" className="p-4">
            <div className="flex items-center gap-3">
              <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-void glow-violet">
                {shieldBroken ? <ShieldOff className="h-6 w-6 text-secondary-foreground" /> : <Shield className="h-6 w-6 text-secondary-foreground" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">Duelista del Vacío</p>
                <HpBar hp={rivalHp} max={MAX_HP} tone="void" />
              </div>
            </div>
          </GameFrame>
        </motion.div>

        {/* Player */}
        <motion.div className="mb-4" animate={playerHit ? { x: [0, -8, 8, -4, 0] } : {}}>
          <GameFrame glow="primary" className="p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-nexus glow-primary">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">Tú</p>
                <HpBar hp={playerHp} max={MAX_HP} tone="primary" />
              </div>
            </div>
          </GameFrame>
        </motion.div>

        {/* Question + cards */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-4 w-4 text-secondary" /> Elige tu carta-respuesta
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
                  whileHover={{ scale: picked === null ? 1.05 : 1, y: picked === null ? -6 : 0 }}
                  onClick={() => play(idx)}
                  disabled={picked !== null}
                  className={cn(
                    "relative flex h-36 flex-col items-center justify-between overflow-hidden rounded-2xl border-2 p-4 text-center text-sm font-semibold backdrop-blur-sm transition bevel-highlight",
                    !show && "border-secondary/50 bg-card/70 hover:border-secondary hover:glow-violet",
                    show && isAns && "border-energy bg-energy/20 text-energy glow-energy",
                    show && chosen && !isAns && "border-destructive bg-destructive/20",
                    show && !isAns && !chosen && "border-border bg-card/40 opacity-60",
                  )}
                >
                  {/* Card top ribbon (rareza sutil) */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-1 frame-metal opacity-80"
                  />
                  <span
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-xl",
                      show && isAns ? "bg-energy/20" : "bg-secondary/15",
                    )}
                  >
                    <Sparkles className={cn("h-5 w-5", show && isAns ? "text-energy" : "text-secondary")} />
                  </span>
                  <span className="leading-snug">{opt}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Carta {idx + 1}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HpBar({ hp, max, tone }: { hp: number; max: number; tone: "primary" | "void" }) {
  return (
    <div className="mt-1">
      <div className="h-2.5 overflow-hidden rounded-full bg-muted/70 ring-1 ring-inset ring-border">
        <motion.div className={tone === "void" ? "h-full bg-gradient-void" : "h-full bg-gradient-nexus"} animate={{ width: `${(hp / max) * 100}%` }} />
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Heart className="h-3 w-3 text-destructive" /> {hp}/{max}
      </div>
    </div>
  );
}
