import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Zap, Puzzle, Crown, Swords, Layers, Lock, ArrowLeft, Gamepad2, MoveUp, Menu, Sparkles, X, Map as MapIcon, Trophy, User } from "lucide-react";
import { StatusBadge } from "@/components/game/StatusBadge";
import { StarField } from "@/components/game/StarField";
import { GameFrame } from "@/components/game/GameFrame";
import { GameButton } from "@/components/game/GameButton";
import { CrystalIcon } from "@/components/game/CrystalIcon";
import { GameHud } from "@/components/hud/GameHud";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { PlayableWorldScreen } from "@/components/game/explorer/PlayableWorldScreen";
import { DialogueSequence, type DialogueLine } from "@/components/game/dialogue";
import { TouchJoystick } from "@/components/game/explorer/TouchJoystick";
import {
  getMissionsWithStatus,
  getWorldById,
  getWorldProgress,
  type Mission,
  type MissionWithStatus,
} from "@/services/gameService";
import { ARTBOOK } from "@/lib/artbook";
import { usePlayerStore } from "@/store/usePlayerStore";
import { getWorldLayout } from "./worldConfig";
import type { Scene3DNode, World3DControls } from "./World3DScene";
import type { DialogueChoiceOption } from "@/components/game/dialogue/types";

// La escena 3D se carga solo en el navegador (three/rapier no corren en SSR).
const World3DScene = lazy(() => import("./World3DScene"));

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

const KIND_HINT: Record<Mission["kind"], string> = {
  duelo: "Duelo veloz: responde rápido para romper el escudo del Vacío.",
  puzzle: "Puzzle de cristales: conecta cada concepto con su definición sin fallar.",
  cartas: "Duelo de cartas: juega la carta correcta en el momento justo.",
  arena: "Se acerca una oleada: resiste y encadena aciertos.",
  boss: "¡El jefe acecha! Reúne todo lo aprendido para disiparlo.",
};

// Nodo interno: datos de render (Scene3DNode) + acción/diálogo (solo DOM).
type FullNode = Scene3DNode & {
  dialogue?: DialogueLine[];
  choices?: DialogueChoiceOption[];
  onInteract?: () => void;
  actionLabel?: string;
};

type ActiveDialogue = { lines: DialogueLine[]; choices?: DialogueChoiceOption[]; onComplete?: () => void };

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

function novaFor(node: FullNode | null, missions: MissionWithStatus[], worldName: string): { message: string; mood: "happy" | "hint" | "celebrate" } {
  if (node?.type === "mission") {
    const m = missions.find((mm) => mm.id === node.id);
    if (m) {
      if (m.status === "locked") return { message: `«${m.title}» sigue sellado por el Vacío. Supera la misión anterior.`, mood: "hint" };
      if (m.status === "completed") return { message: `Ya dominaste «${m.title}». ¿Repetimos para mejorar tu récord?`, mood: "happy" };
      return { message: `${KIND_HINT[m.kind]} Concepto clave: ${m.concept}.`, mood: "hint" };
    }
  }
  if (node?.type === "rival") return { message: "Tu rival está a pocos puntos. ¡Supera otra misión y adelántalo!", mood: "hint" };
  if (node?.type === "blocked") return { message: "Ese sendero sigue sellado por el Vacío. Completa las misiones para disiparlo.", mood: "hint" };
  if (node?.type === "portal") return { message: "Este portal te devuelve al mapa del Nexus. ¿Exploramos otro rincón?", mood: "happy" };
  if (node?.type === "npc") return { message: "¡Camina con WASD o el joystick! Acércate a un cristal y pulsa acción.", mood: "happy" };
  const done = missions.filter((m) => m.status === "completed").length;
  if (done >= missions.length) return { message: `¡Has restaurado el Núcleo del Saber de ${worldName}!`, mood: "celebrate" };
  if (done === 0) return { message: "Muévete hasta el primer cristal y entra en la misión para abrir el sendero.", mood: "happy" };
  return { message: "¡Buen avance! Completa el reto disponible para desbloquear el siguiente.", mood: "happy" };
}

// Error boundary: si WebGL falla, degradamos a la escena 2D original.
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * three.js no entiende colores CSS modernos (oklch del design system).
 * Convertimos a hex vía canvas 2D; si no se puede (SSR), azul del Explorador.
 */
function cssColorToHex(color: string | undefined): string {
  if (!color) return "#60a5fa";
  if (color.startsWith("#")) return color;
  if (typeof document === "undefined") return "#60a5fa";
  try {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const ctx = cv.getContext("2d");
    if (!ctx) return "#60a5fa";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return "#60a5fa";
  }
}

function CanvasLoading() {
  return (
    <div className="grid h-full w-full place-items-center bg-background/60">
      <div className="flex flex-col items-center gap-3 text-center">
        <Gamepad2 className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-sm text-muted-foreground">Cargando el mundo 3D…</p>
      </div>
    </div>
  );
}

/**
 * World3DScreen — pantalla jugable en 3D (tercera persona) para cualquier mundo.
 * Reutiliza el estado real de gating (getMissionsWithStatus) y los diálogos RPG;
 * la escena 3D (client-only) mueve al héroe y avisa de la proximidad, mientras el
 * HUD (joystick, salto, acción, diálogo) vive en DOM. Presentacional: recompensas
 * y gating siguen en el service layer + guard.
 */
export function World3DScreen({ worldId }: { worldId: string }) {
  const navigate = useNavigate();
  const missionsCleared = usePlayerStore((s) => s.missionsCleared);
  const worldsCleared = usePlayerStore((s) => s.worldsCleared);
  const avatar = usePlayerStore((s) => s.avatar);

  const world = getWorldById(worldId);
  const progress = getWorldProgress(worldId, { worldsCleared, missionsCleared });
  const missions = getMissionsWithStatus(worldId, missionsCleared);
  const done = missions.filter((m) => m.status === "completed").length;
  const total = missions.length;
  const nextMissionId = useMemo(
    () => missions.find((m) => m.status !== "completed" && m.status !== "locked")?.id ?? null,
    [missions],
  );

  const controlsRef = useRef<World3DControls>({ move: { x: 0, y: 0 }, jump: false, cast: false });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialogue, setDialogue] = useState<ActiveDialogue | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const handleActive = useCallback((id: string | null) => setActiveId(id), []);

  // Tooltip de bienvenida (una vez por navegador).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!window.localStorage.getItem("nq-3d-tip-seen")) setShowTip(true);
    } catch {
      /* localStorage bloqueado: no mostramos tip */
    }
  }, []);
  const dismissTip = useCallback(() => {
    setShowTip(false);
    try {
      window.localStorage.setItem("nq-3d-tip-seen", "1");
    } catch {
      /* noop */
    }
  }, []);

  // Escape abre/cierra el menú de pausa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Nodos: cristales de misión + decorativos (rival, portal, sendero sellado, NPC).
  const nodes = useMemo<FullNode[]>(() => {
    if (!world) return [];
    const { missionSpots, decorSpots } = getWorldLayout(worldId);
    const missionNodes: FullNode[] = missions.map((m, i) => {
      const spot = missionSpots[i] ?? missionSpots[missionSpots.length - 1];
      const dialogue = m.status === "locked" ? undefined : buildMissionDialogue(m);
      const choices: DialogueChoiceOption[] | undefined =
        dialogue && dialogue.length
          ? [
              {
                label: m.kind === "boss" ? "¡Enfrentarlo!" : m.status === "completed" ? "Repetir reto" : "Entrar al reto",
                tone: m.kind === "boss" ? "gold" : "primary",
                onSelect: () => navigate({ to: m.route, search: { m: m.id } }),
              },
              { label: "Más tarde", tone: "void" },
            ]
          : undefined;
      return {
        id: m.id,
        type: "mission",
        kind: m.kind,
        status: m.status,
        position: spot,
        label: m.kind === "boss" ? "Jefe" : `Misión ${m.n}`,
        actionLabel: m.status === "locked" ? "Bloqueado" : m.status === "completed" ? "Repetir" : "Entrar",
        dialogue,
        choices,
        onInteract: () => navigate({ to: m.route, search: { m: m.id } }),
      };
    });

    const decor: FullNode[] = [
      {
        id: "npc",
        type: "npc",
        position: decorSpots.npc,
        label: "Nova",
        dialogue: [
          { speaker: "Nova", kind: "nova", text: "¡Bienvenido al mundo! Muévete con WASD, las flechas o el joystick. Salta con Espacio." },
          { speaker: "Nova", kind: "nova", text: "Acércate a un cristal de misión y pulsa acción (o la tecla E) para entrar." },
        ],
      },
      {
        id: "rival",
        type: "rival",
        position: decorSpots.rival,
        label: "Rival",
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
        position: decorSpots.blocked,
        label: "Bruma",
        dialogue: [
          { speaker: "???", kind: "void", emoji: "🌫️", text: "Grrr… nadie cruza hasta que el Núcleo caiga en el olvido." },
          { speaker: "Nova", kind: "nova", text: "Es una sombra del Vacío. Completa las misiones y se disipará sola." },
        ],
      },
      {
        id: "portal-mapa",
        type: "portal",
        position: decorSpots.portal,
        label: "Salir",
        actionLabel: "Viajar",
        dialogue: [{ speaker: "Nova", kind: "nova", text: "Este portal te devuelve al mapa del Nexus. ¿Viajamos?" }],
        choices: [
          { label: "Volver al mapa", tone: "primary", onSelect: () => navigate({ to: "/mapa" }) },
          { label: "Seguir explorando", tone: "void" },
        ],
      },
    ];
    return [...missionNodes, ...decor];
  }, [world, missions, navigate]);

  const sceneNodes = useMemo<Scene3DNode[]>(
    () => nodes.map(({ id, type, kind, status, position, label }) => ({ id, type, kind, status, position, label })),
    [nodes],
  );

  const activeNode = useMemo(() => nodes.find((n) => n.id === activeId) ?? null, [nodes, activeId]);

  const activate = useCallback(
    (node: FullNode | null) => {
      if (!node || dialogue) return;
      if ((node.dialogue && node.dialogue.length) || (node.choices && node.choices.length)) {
        setDialogue({
          lines: node.dialogue ?? [],
          choices: node.choices,
          onComplete: node.choices?.length ? undefined : node.onInteract,
        });
        return;
      }
      node.onInteract?.();
    },
    [dialogue],
  );

  const onInteractId = useCallback((id: string) => activate(nodes.find((n) => n.id === id) ?? null), [activate, nodes]);

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

  // Mundo bloqueado en la cadena secuencial.
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

  const nova = novaFor(activeNode, missions, world.name);
  const actionLabel = !activeNode ? "Acércate" : activeNode.actionLabel ?? (activeNode.status === "locked" ? "Bloqueado" : "Entrar");

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

        <GameFrame glow="primary" className="mb-6">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-accent">Mundo {world.order} · {world.subject}</span>
            <StatusBadge status={done >= total ? "completed" : "current"} className="px-2 py-1" />
          </div>
          <h1 className="mb-1 flex items-center gap-2 text-3xl font-black">{world.emoji} {world.name}</h1>
          <p className="mb-4 text-muted-foreground">Tema: {world.theme}. Explora en 3D, completa las misiones en orden y vence al jefe.</p>

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

        {/* Escena 3D jugable + HUD */}
        <div className="mb-6">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-2 border-primary/30 bg-background shadow-deep sm:aspect-video">
            <ClientOnly fallback={<CanvasLoading />}>
              <SceneBoundary fallback={<div className="absolute inset-0"><PlayableWorldScreen worldId={worldId} /></div>}>
                <Suspense fallback={<CanvasLoading />}>
                  <World3DScene
                    worldId={worldId}
                    classId={avatar.classId}
                    nodes={sceneNodes}
                    nextMissionId={nextMissionId}
                    heroColor={cssColorToHex(avatar.color)}
                    controlsRef={controlsRef}
                    paused={!!dialogue || menuOpen || showTip}
                    onActiveNodeChange={handleActive}
                    onInteract={onInteractId}
                  />
                </Suspense>
              </SceneBoundary>
            </ClientOnly>

            {/* Botón de menú (esquina superior derecha) */}
            {!dialogue && !menuOpen && !showTip && (
              <button
                type="button"
                aria-label="Abrir menú"
                onClick={() => setMenuOpen(true)}
                className="absolute right-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-full border-2 border-primary/50 bg-background/70 text-primary backdrop-blur transition hover:scale-105 active:scale-95"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}


            {/* Prompt de interacción (banner superior) */}
            {!dialogue && !menuOpen && activeNode && (
              <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-primary/40 bg-background/80 px-4 py-1.5 text-center text-xs font-bold backdrop-blur">
                {activeNode.label}
                <span className="ml-2 text-muted-foreground">· pulsa {actionLabel}</span>
              </div>
            )}

            {/* Controles (se ocultan mientras hay diálogo o menú) */}
            {!dialogue && !menuOpen && (
              <>
                <div className="absolute bottom-3 left-3 z-30">
                  <TouchJoystick onChange={(x, y) => (controlsRef.current.move = { x, y })} size={104} />
                </div>
                <div className="absolute bottom-3 right-3 z-30 flex items-end gap-2">
                  <button
                    type="button"
                    aria-label="Lanzar energía"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      controlsRef.current.cast = true;
                    }}
                    className="grid h-12 w-12 place-items-center rounded-full border-2 border-primary/60 bg-background/60 text-primary backdrop-blur transition active:scale-95"
                  >
                    <Sparkles className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Saltar"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      controlsRef.current.jump = true;
                    }}
                    className="grid h-12 w-12 place-items-center rounded-full border-2 border-accent/60 bg-background/60 text-accent backdrop-blur transition active:scale-95"
                  >
                    <MoveUp className="h-5 w-5" />
                  </button>
                  <GameButton
                    variant={activeNode?.status === "locked" ? "void" : "primary"}
                    size="md"
                    disabled={!activeNode}
                    onClick={() => activate(activeNode)}
                  >
                    {actionLabel}
                  </GameButton>
                </div>
              </>
            )}

            {/* Menú de pausa */}
            {menuOpen && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/85 backdrop-blur-sm">
                <div className="relative m-3 w-full max-w-md rounded-2xl border-2 border-primary/50 bg-card p-5 shadow-deep">
                  <button
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={() => setMenuOpen(false)}
                    className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-border bg-background/60 text-muted-foreground transition hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-accent">Menú del Aspirante</p>
                  <h3 className="mb-3 text-xl font-black">{world.name}</h3>
                  <div className="mb-4 space-y-1.5">
                    {missions.map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{m.kind === "boss" ? "Jefe" : `M${m.n}`}</span>
                          <span className="font-semibold">{m.title}</span>
                        </span>
                        {m.status === "completed" ? (
                          <StatusBadge status="completed" label="✓" />
                        ) : m.status === "locked" ? (
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Link to={m.route} search={{ m: m.id }} className="text-xs font-bold text-primary hover:underline">
                            Jugar →
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/mapa" })}
                      className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background/50 px-2 py-3 text-xs font-semibold transition hover:border-primary/60"
                    >
                      <MapIcon className="h-4 w-4 text-primary" /> Mapa
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/ranking" })}
                      className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background/50 px-2 py-3 text-xs font-semibold transition hover:border-primary/60"
                    >
                      <Trophy className="h-4 w-4 text-gold" /> Ranking
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/perfil" })}
                      className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background/50 px-2 py-3 text-xs font-semibold transition hover:border-primary/60"
                    >
                      <User className="h-4 w-4 text-accent" /> Perfil
                    </button>
                  </div>
                  <GameButton className="mt-4 w-full" variant="primary" onClick={() => setMenuOpen(false)}>
                    Seguir jugando
                  </GameButton>
                </div>
              </div>
            )}

            {/* Onboarding tip (primera vez) */}
            {showTip && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="m-3 w-full max-w-sm rounded-2xl border-2 border-primary/50 bg-card p-5 text-center shadow-deep">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-accent">Controles del Aspirante</p>
                  <h3 className="mt-1 text-lg font-black">Bienvenido al Bosque 3D</h3>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-border/60 bg-background/50 p-2"><b className="text-primary">WASD</b> / flechas <div className="text-muted-foreground">moverse</div></div>
                    <div className="rounded-xl border border-border/60 bg-background/50 p-2"><b className="text-accent">Espacio</b><div className="text-muted-foreground">saltar</div></div>
                    <div className="rounded-xl border border-border/60 bg-background/50 p-2"><b className="text-primary">F</b><div className="text-muted-foreground">lanzar energía</div></div>
                    <div className="rounded-xl border border-border/60 bg-background/50 p-2"><b className="text-gold">E</b><div className="text-muted-foreground">interactuar</div></div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Sigue la columna de luz para llegar a tu próxima misión.</p>
                  <GameButton className="mt-4 w-full" variant="primary" onClick={dismissTip}>¡Vamos!</GameButton>
                </div>
              </div>
            )}

            {/* Caja de diálogo inferior estilo RPG */}
            {dialogue && (
              <div className="absolute inset-x-3 bottom-3 z-40 mx-auto max-w-lg">
                <DialogueSequence
                  lines={dialogue.lines}
                  choices={dialogue.choices}
                  onComplete={dialogue.onComplete}
                  onClose={() => setDialogue(null)}
                />
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Muévete con WASD / flechas o el joystick · salta con Espacio · lanza con F · menú con Esc · acción con E
          </p>
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
                <GameFrame glow={glow} className={`group flex flex-col gap-3 sm:flex-row sm:items-center ${locked ? "opacity-70" : "transition hover:border-primary/60"}`}>
                  <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-primary-foreground bevel-highlight ${locked ? "bg-fog-void grayscale" : GRADS[m.kind]}`}>
                    {locked ? <Lock className="h-6 w-6 text-muted-foreground" /> : <Icon className="h-7 w-7" />}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isBoss ? "Jefe final" : `Misión ${m.n}`}</p>
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
