import { useCallback, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Zap, Puzzle, Crown, Swords, Layers, Lock, ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/game/StatusBadge";
import { StarField } from "@/components/game/StarField";
import { GameFrame } from "@/components/game/GameFrame";
import { GameButton } from "@/components/game/GameButton";
import { CrystalIcon } from "@/components/game/CrystalIcon";
import { GameHud } from "@/components/hud/GameHud";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { WorldExplorer, type ExplorerPoint, type ExplorerNode } from "@/components/game/WorldExplorer";
import type { DialogueLine } from "@/components/game/dialogue";
import {
  getMissionsWithStatus,
  getWorldById,
  getWorldProgress,
  type Mission,
  type MissionWithStatus,
} from "@/services/gameService";
import { ARTBOOK, heroPortrait } from "@/lib/artbook";
import { usePlayerStore } from "@/store/usePlayerStore";

const ICONS: Record<Mission["kind"], typeof Zap> = {
  duelo: Zap,
  puzzle: Puzzle,
  cartas: Layers,
  arena: Swords,
  boss: Crown,
};

const GRADS: Record<Mission["kind"], string> = {
  duelo: "bg-gradient-nexus",
  puzzle: "bg-gradient-energy",
  cartas: "bg-gradient-nexus",
  arena: "bg-gradient-gold",
  boss: "bg-gradient-void",
};

// Pista de Nova según el tipo de reto que tienes al lado (antes de entrar).
const KIND_HINT: Record<Mission["kind"], string> = {
  duelo: "Duelo veloz: responde rápido para romper el escudo del Vacío.",
  puzzle: "Puzzle de cristales: conecta cada concepto con su definición sin fallar.",
  cartas: "Duelo de cartas: juega la carta correcta en el momento justo.",
  arena: "Se acerca una oleada: resiste y encadena aciertos.",
  boss: "¡El jefe acecha! Reúne todo lo aprendido para disiparlo.",
};

// Layout de los 5 cristales de misión por mundo (coordenadas en % del área).
const WORLD_LAYOUT: Record<string, ExplorerPoint[]> = {
  bosque: [
    { x: 18, y: 80 },
    { x: 40, y: 56 },
    { x: 63, y: 74 },
    { x: 82, y: 44 },
    { x: 52, y: 22 },
  ],
  algoritmos: [
    { x: 20, y: 78 },
    { x: 44, y: 60 },
    { x: 70, y: 72 },
    { x: 82, y: 40 },
    { x: 50, y: 20 },
  ],
  cronicas: [
    { x: 16, y: 74 },
    { x: 38, y: 52 },
    { x: 62, y: 70 },
    { x: 84, y: 48 },
    { x: 54, y: 24 },
  ],
  laboratorio: [
    { x: 20, y: 76 },
    { x: 46, y: 58 },
    { x: 68, y: 76 },
    { x: 80, y: 42 },
    { x: 48, y: 22 },
  ],
  lenguas: [
    { x: 18, y: 78 },
    { x: 42, y: 54 },
    { x: 66, y: 72 },
    { x: 82, y: 46 },
    { x: 52, y: 22 },
  ],
  observatorio: [
    { x: 22, y: 74 },
    { x: 44, y: 56 },
    { x: 68, y: 74 },
    { x: 84, y: 44 },
    { x: 50, y: 22 },
  ],
  "fortaleza-vacio": [
    { x: 20, y: 80 },
    { x: 44, y: 58 },
    { x: 66, y: 76 },
    { x: 82, y: 46 },
    { x: 52, y: 20 },
  ],
};

const DEFAULT_LAYOUT: ExplorerPoint[] = WORLD_LAYOUT.bosque;

type NovaState = { message: string; mood: "happy" | "hint" | "celebrate" };

function novaMessage(missions: MissionWithStatus[], worldName: string): string {
  const total = missions.length;
  const done = missions.filter((m) => m.status === "completed").length;
  if (done >= total) return `¡Has restaurado el Núcleo del Saber de ${worldName}!`;
  const boss = missions.find((m) => m.kind === "boss");
  if (boss && boss.status === "available") return "Solo queda el jefe. ¡Rompe la niebla del Vacío!";
  if (done === 0) return "Empieza por aquí: supera la primera misión para abrir el sendero.";
  return "¡Buen avance! Completa el reto disponible para desbloquear el siguiente.";
}

function novaContext(node: ExplorerNode | null, missions: MissionWithStatus[], worldName: string): NovaState {
  if (node?.type === "mission") {
    const m = missions.find((mm) => mm.id === node.id);
    if (m) {
      if (m.status === "locked") {
        return { message: `«${m.title}» sigue sellado por el Vacío. Supera la misión anterior para abrir el sendero.`, mood: "hint" };
      }
      if (m.status === "completed") {
        return { message: `Ya dominaste «${m.title}». ¿Repetimos para mejorar tu récord?`, mood: "happy" };
      }
      return { message: `${KIND_HINT[m.kind]} Concepto clave: ${m.concept}.`, mood: "hint" };
    }
  }
  if (node?.type === "rival") {
    return { message: "Tu rival está a pocos puntos. ¡Supera otra misión y adelántalo en el ranking!", mood: "hint" };
  }
  if (node?.type === "blocked") {
    return { message: "Ese sendero sigue sellado por el Vacío. Completa las misiones para disiparlo.", mood: "hint" };
  }
  if (node?.type === "portal") {
    return { message: "Este portal te devuelve al mapa del Nexus. ¿Exploramos otro rincón?", mood: "happy" };
  }
  if (node?.type === "npc") {
    return { message: "¡Aquí estoy! Sigue el sendero luminoso y te guiaré misión a misión.", mood: "happy" };
  }
  const done = missions.filter((m) => m.status === "completed").length;
  return { message: novaMessage(missions, worldName), mood: done >= missions.length ? "celebrate" : "happy" };
}

function buildMissionDialogue(m: MissionWithStatus): DialogueLine[] {
  if (m.kind === "boss") {
    return [
      { speaker: "Nova", kind: "nova", text: `Ahí está… ${m.npc}, una forma del Vacío. Absorbe todo lo que has descubierto.` },
      { speaker: m.npc, kind: "void", emoji: m.npcEmoji, text: "¿Otro Aspirante? Tu saber se apagará como el de los demás." },
      { speaker: "Nova", kind: "nova", text: `¡No le escuches! Reúne todo lo aprendido y disípalo. Concepto clave: ${m.concept}.` },
    ];
  }
  if (m.status === "completed") {
    return [{ speaker: "Nova", kind: "nova", text: `Ya dominaste «${m.title}». ¿Repetimos para superar tu récord?` }];
  }
  return [
    { speaker: m.npc, kind: "ally", emoji: m.npcEmoji, text: m.objective },
    { speaker: "Nova", kind: "nova", text: `${KIND_HINT[m.kind]} Concepto clave: ${m.concept}. ¡Cuando quieras, entramos!` },
  ];
}

/**
 * PlayableWorldScreen — pantalla jugable reutilizable para cualquier mundo del
 * Nexus. Compone cabecera + exploración 2D (WorldExplorer con Nova companion) +
 * sendero de misiones, todo derivado del estado real de gating del jugador.
 * Presentacional: recompensas y gating viven en el service layer + guard.
 */
export function PlayableWorldScreen({ worldId }: { worldId: string }) {
  const navigate = useNavigate();
  const missionsCleared = usePlayerStore((s) => s.missionsCleared);
  const worldsCleared = usePlayerStore((s) => s.worldsCleared);
  const avatar = usePlayerStore((s) => s.avatar);

  const world = getWorldById(worldId);
  const progress = getWorldProgress(worldId, { worldsCleared, missionsCleared });
  const missions = getMissionsWithStatus(worldId, missionsCleared);
  const done = missions.filter((m) => m.status === "completed").length;
  const total = missions.length;

  const [activeNode, setActiveNode] = useState<ExplorerNode | null>(null);
  const handleActiveNode = useCallback((n: ExplorerNode | null) => setActiveNode(n), []);

  // Mundo inexistente.
  if (!world) {
    return (
      <div className="relative min-h-screen">
        <StarField density={70} />
        <GameHud />
        <main className="mx-auto grid max-w-2xl place-items-center px-4 py-24 text-center">
          <GameFrame glow="violet" className="w-full">
            <p className="text-4xl">🌫️</p>
            <h1 className="mt-3 text-2xl font-black">Este mundo no existe</h1>
            <p className="mt-2 text-muted-foreground">La niebla del Vacío ha borrado esta ruta del mapa.</p>
            <Link to="/mapa" className="mt-6 inline-block">
              <GameButton variant="primary">Volver al mapa</GameButton>
            </Link>
          </GameFrame>
        </main>
      </div>
    );
  }

  const unlocked = progress?.progressStatus !== "locked";
  const nova = novaContext(activeNode, missions, world.name);
  const layout = WORLD_LAYOUT[worldId] ?? DEFAULT_LAYOUT;

  // Mundo bloqueado: aún no accesible en la cadena secuencial.
  if (!unlocked) {
    return (
      <div className="relative min-h-screen">
        <StarField density={80} />
        <div className="pointer-events-none fixed inset-0 -z-10">
          <img src={ARTBOOK.keyArt} alt="" aria-hidden="true" loading="lazy" className="h-full w-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-gradient-hero opacity-80" />
          <div className="absolute inset-0 bg-fog-void opacity-40" />
        </div>
        <GameHud />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <Link to="/mapa" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver al mapa
          </Link>
          <GameFrame glow="violet" className="text-center">
            <p className="text-4xl">{world.emoji}</p>
            <h1 className="mt-3 text-2xl font-black">{world.name}</h1>
            <p className="mt-2 text-muted-foreground">
              Este mundo sigue sellado por la niebla del Vacío. {progress?.unlockHint ?? world.requirement}.
            </p>
            <div className="mt-5">
              <NovaBubble mood="hint" message={`${progress?.unlockHint ?? world.requirement} para iluminar ${world.name}.`} />
            </div>
            <Link to="/mapa" className="mt-6 inline-block">
              <GameButton variant="primary" size="lg">Ir al mapa del Nexus</GameButton>
            </Link>
          </GameFrame>
        </main>
      </div>
    );
  }

  // Nodos decorativos: dan vida al mundo sin afectar al gating real.
  const guide = missions[0];
  const decor: ExplorerNode[] = [
    {
      id: "rival",
      type: "rival",
      pos: { x: 30, y: 32 },
      label: "Rival",
      title: "Rival del Nexus",
      sublabel: "Está a pocos puntos de ti. ¡Adelántalo en el ranking!",
      emoji: "🤺",
      actionLabel: "Ranking",
      dialogue: [
        { speaker: "Rival", kind: "rival", emoji: "🤺", text: "Vas justo por detrás de mí en el ranking. ¿Crees que puedes adelantarme?" },
        { speaker: "Nova", kind: "nova", text: "Está a pocos puntos. Una misión más y podrías superarle." },
      ],
      choices: [
        { label: "Ver el ranking", tone: "gold", onSelect: () => navigate({ to: "/ranking" }) },
        { label: "Seguir explorando", tone: "void" },
      ],
    },
    {
      id: "guardian",
      type: "blocked",
      pos: { x: 72, y: 28 },
      label: "Bruma",
      title: "Sombra de bruma",
      sublabel: "Una criatura del Vacío bloquea el sendero.",
      emoji: "🌫️",
      dialogue: [
        { speaker: "???", kind: "void", emoji: "🌫️", text: "Grrr… nadie cruza hasta que el Núcleo caiga en el olvido." },
        { speaker: "Nova", kind: "nova", text: "Es una sombra del Vacío. Completa las misiones y se disipará sola. ¡No te rindas!" },
      ],
    },
    {
      id: "portal-mapa",
      type: "portal",
      pos: { x: 90, y: 88 },
      label: "Salir",
      title: "Portal al Mapa",
      sublabel: "Vuelve al mapa de mundos del Nexus.",
      emoji: "🌀",
      actionLabel: "Viajar",
      dialogue: [{ speaker: "Nova", kind: "nova", text: "Este portal te devuelve al mapa del Nexus. ¿Viajamos?" }],
      choices: [
        { label: "Volver al mapa", tone: "primary", onSelect: () => navigate({ to: "/mapa" }) },
        { label: "Seguir explorando", tone: "void" },
      ],
    },
  ];

  return (
    <div className="relative min-h-screen">
      <StarField density={80} />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img src={ARTBOOK.keyArt} alt="" aria-hidden="true" loading="lazy" className="h-full w-full object-cover opacity-15" />
        <div className="absolute inset-0 bg-gradient-hero opacity-80" />
      </div>
      <GameHud />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/mapa" className="hover:text-foreground">Mapa</Link>
          <span>/</span>
          <span className="text-foreground">{world.name}</span>
        </div>

        {/* World header framed like a HUD panel. */}
        <GameFrame glow="primary" className="mb-6">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-accent">
              Mundo {world.order} · {world.subject}
            </span>
            <StatusBadge status={done >= total ? "completed" : "current"} className="px-2 py-1" />
          </div>
          <h1 className="mb-1 flex items-center gap-2 text-3xl font-black">
            {world.emoji} {world.name}
          </h1>
          <p className="mb-4 text-muted-foreground">Tema: {world.theme}. Completa las misiones en orden y vence al jefe.</p>

          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Restauración del Núcleo</span>
              <span>{done}/{total}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <motion.div className="h-full rounded-full bg-gradient-energy glow-energy" animate={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </div>
          </div>

          <NovaBubble message={nova.message} mood={nova.mood} />
        </GameFrame>

        {/* Explorable scene: move your hero and enter the crystals. */}
        <div className="mb-6">
          <WorldExplorer
            missions={missions}
            layout={layout}
            decor={decor}
            playerImage={heroPortrait(avatar.classId)}
            playerColor={avatar.color}
            onActiveNodeChange={handleActiveNode}
            buildMissionDialogue={buildMissionDialogue}
          />
        </div>

        <h2 className="mb-3 text-lg font-black">Sendero de misiones</h2>
        <div className="relative space-y-4">
          {missions.map((m, idx) => {
            const Icon = ICONS[m.kind];
            const cleared = m.status === "completed";
            const locked = m.status === "locked";
            const isBoss = m.kind === "boss";
            const glow = locked ? "none" : isBoss ? "violet" : cleared ? "energy" : "primary";
            return (
              <motion.div key={m.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}>
                <GameFrame
                  glow={glow}
                  className={`group flex flex-col gap-3 sm:flex-row sm:items-center ${locked ? "opacity-70" : "transition hover:border-primary/60"}`}
                >
                  <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-primary-foreground bevel-highlight ${locked ? "bg-fog-void grayscale" : GRADS[m.kind]}`}>
                    {locked ? <Lock className="h-6 w-6 text-muted-foreground" /> : <Icon className="h-7 w-7" />}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {isBoss ? "Jefe final" : `Misión ${m.n}`}
                      </p>
                      {cleared && <StatusBadge status="completed" label="Completada" />}
                      {locked && <StatusBadge status="locked" label="Bloqueada" />}
                    </div>
                    <p className="text-lg font-bold">{m.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {locked
                        ? isBoss
                          ? "El jefe sigue protegido por la niebla del Vacío. Completa las 4 misiones anteriores."
                          : "Completa la misión anterior para abrir este sendero."
                        : m.objective}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-background/60 px-2 py-1">{m.npcEmoji} {m.npc}</span>
                      <span className="rounded-full bg-background/60 px-2 py-1 text-accent">🧠 {m.concept}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 px-2 py-1 font-bold text-gold">
                        <CrystalIcon kind={isBoss ? "key" : "crystal"} size="sm" glow={false} className="h-5 w-5 rounded-lg" />
                        {m.reward}
                      </span>
                    </div>
                  </div>
                  {locked ? (
                    <span className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-border bg-background/40 px-5 py-3 font-bold text-muted-foreground">
                      <Lock className="h-4 w-4" /> Bloqueado
                    </span>
                  ) : (
                    <GameButton asChild variant={isBoss ? "void" : "primary"}>
                      <Link to={m.route} search={{ m: m.id }}>{cleared ? "Repetir" : "Jugar"}</Link>
                    </GameButton>
                  )}
                </GameFrame>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
