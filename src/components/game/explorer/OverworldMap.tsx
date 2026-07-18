import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Lock, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarDisc } from "@/components/game/AvatarDisc";
import { GameButton } from "@/components/game/GameButton";
import { OverworldPrompt } from "@/components/game/dialogue";
import { ARTBOOK, heroPortrait } from "@/lib/artbook";
import { usePlayerStore } from "@/store/usePlayerStore";
import type { WorldWithProgress } from "@/services/gameService";

import { WorldScene } from "./WorldScene";
import { NovaCompanion } from "./NovaCompanion";
import { TouchJoystick } from "./TouchJoystick";
import { MiniMap } from "./MiniMap";
import { usePlayerController } from "./usePlayerController";
import { DEFAULT_REACH, type ExplorerNode, type ExplorerPoint } from "./types";

// Senderos luminosos entre mundos (mismo grafo que la vista de constelación).
const CONNECTIONS: [string, string][] = [
  ["bosque", "algoritmos"],
  ["algoritmos", "cronicas"],
  ["algoritmos", "laboratorio"],
  ["cronicas", "lenguas"],
  ["laboratorio", "observatorio"],
  ["lenguas", "observatorio"],
  ["observatorio", "fortaleza-vacio"],
];

/** ¿Se puede entrar físicamente a este mundo desde el mapa? */
function isEnterable(w: WorldWithProgress): boolean {
  return w.progressStatus === "current" || w.progressStatus === "completed";
}

/**
 * WorldMapNode — cristal/portal de un mundo sobre el overworld. Muestra
 * bloqueado (niebla del Vacío), disponible o restaurado. Presentacional.
 */
function WorldMapNode({ world, active }: { world: WorldWithProgress; active: boolean }) {
  const locked = world.progressStatus === "locked";
  const completed = world.progressStatus === "completed";
  const ring = locked
    ? "border-secondary/40 bg-fog-void text-muted-foreground grayscale ring-destructive/40"
    : completed
      ? "border-energy bg-card text-energy glow-energy ring-primary/50"
      : "border-primary bg-card text-primary glow-primary ring-primary/50";

  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${world.x}%`, top: `${world.y}%` }}
    >
      {/* Niebla del Vacío sobre los mundos sellados */}
      {locked && (
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -z-10 h-16 w-16 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full blur-lg"
          style={{ background: "radial-gradient(circle, oklch(0.55 0.2 330 / 0.6), transparent 70%)" }}
        />
      )}
      <motion.div
        className={cn(
          "relative grid h-16 w-16 place-items-center rounded-2xl border-2 text-2xl bevel-highlight transition",
          ring,
          active && "scale-110 ring-4",
        )}
        animate={locked ? undefined : { y: [0, -4, 0] }}
        transition={locked ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {locked ? <Lock className="h-6 w-6" /> : <span className="leading-none">{world.emoji}</span>}
        {completed && (
          <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-energy text-background">
            <Check className="h-3 w-3" />
          </span>
        )}
      </motion.div>
      <p className="mt-1 w-28 -translate-x-1/2 text-center text-[10px] font-bold leading-tight" style={{ marginLeft: 32 }}>
        {world.name}
      </p>
    </div>
  );
}

/**
 * OverworldMap — mapa jugable del Nexus (Fase 3.1).
 *
 * El jugador mueve físicamente a su Aspirante sobre el mapa, recorre los
 * senderos luminosos y entra a cada mundo al acercarse. Nova le acompaña y los
 * mundos bloqueados quedan cubiertos por la niebla del Vacío. Es la capa de
 * exploración del overworld: el gating real vive en el service layer; aquí solo
 * detectamos proximidad y navegamos al mundo elegido.
 */
export function OverworldMap({ worlds }: { worlds: WorldWithProgress[] }) {
  const navigate = useNavigate();
  const avatar = usePlayerStore((s) => s.avatar);
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });

  const worldById = useCallback((id: string) => worlds.find((w) => w.id === id), [worlds]);

  // Cada mundo se convierte en un nodo interactuable del overworld.
  const nodes = useMemo<ExplorerNode[]>(
    () =>
      worlds.map((w) => ({
        id: w.id,
        type: "mission",
        pos: { x: w.x, y: w.y },
        status:
          w.progressStatus === "completed" ? "completed" : w.progressStatus === "locked" ? "locked" : "available",
        label: w.name,
      })),
    [worlds],
  );

  // Punto de partida: junto al primer mundo (Bosque), abajo a la izquierda.
  const start = useMemo<ExplorerPoint>(() => {
    const first = worldById("bosque") ?? worlds[0];
    return first ? { x: first.x, y: Math.min(90, first.y + 12) } : { x: 22, y: 82 };
  }, [worldById, worlds]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const enter = useCallback(
    (node: ExplorerNode | null) => {
      if (!node) return;
      const w = worldById(node.id);
      if (!w) return;
      if (!isEnterable(w)) {
        toast.error(`${w.name} sigue sellado por la niebla del Vacío. ${w.unlockHint}.`);
        return;
      }
      navigate({ to: "/mundo/$worldId", params: { worldId: w.id } });
    },
    [navigate, worldById],
  );

  const activeRef = useRef<ExplorerNode | null>(null);
  const { pos, moving, facing, setAnalog } = usePlayerController({
    start,
    onInteract: () => enter(activeRef.current),
  });

  // Mundo más cercano dentro de su radio de alcance.
  const active = useMemo(() => {
    let best: { node: ExplorerNode; d: number } | null = null;
    for (const node of nodes) {
      const dx = ((node.pos.x - pos.x) / 100) * size.w;
      const dy = ((node.pos.y - pos.y) / 100) * size.h;
      const d = Math.hypot(dx, dy);
      if (d < DEFAULT_REACH && (!best || d < best.d)) best = { node, d };
    }
    return best?.node ?? null;
  }, [nodes, pos, size]);
  activeRef.current = active;

  const activeWorld = active ? worldById(active.id) ?? null : null;
  const enterable = activeWorld ? isEnterable(activeWorld) : false;
  const actionLabel = !activeWorld ? "Explora" : enterable ? "Entrar" : "Sellado";
  const novaIndicator: "alert" | "hint" | null = activeWorld ? (enterable ? "alert" : "hint") : null;

  return (
    <WorldScene
      ref={areaRef}
      background={ARTBOOK.worldsMap}
      hint="Muévete por el Nexus y entra a un mundo"
    >
      {/* Senderos luminosos entre mundos */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="overworldPath" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.62 0.2 190)" />
            <stop offset="100%" stopColor="oklch(0.78 0.19 150)" />
          </linearGradient>
        </defs>
        {CONNECTIONS.map(([a, b], i) => {
          const wa = worldById(a);
          const wb = worldById(b);
          if (!wa || !wb) return null;
          const open = wa.progressStatus !== "locked" && wb.progressStatus !== "locked";
          return (
            <line
              key={i}
              x1={`${wa.x}%`}
              y1={`${wa.y}%`}
              x2={`${wb.x}%`}
              y2={`${wb.y}%`}
              stroke={open ? "url(#overworldPath)" : "oklch(0.5 0.2 330 / 45%)"}
              strokeWidth={open ? 3 : 2}
              strokeDasharray={open ? undefined : "6 6"}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Minimapa */}
      <div className="absolute right-3 top-3 z-30">
        <MiniMap nodes={nodes} player={pos} />
      </div>

      {/* Nodos de mundo */}
      {worlds.map((w) => (
        <WorldMapNode key={w.id} world={w} active={active?.id === w.id} />
      ))}

      {/* Nova companion siguiendo al héroe */}
      <NovaCompanion target={pos} indicator={novaIndicator} />

      {/* Héroe del jugador */}
      <motion.div
        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        animate={{ y: moving ? [0, -3, 0] : [0, -4, 0] }}
        transition={{ duration: moving ? 0.4 : 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div style={{ transform: `scaleX(${facing})` }}>
          <AvatarDisc base="" image={heroPortrait(avatar.classId)} color={avatar.color} size={56} className="glow-primary" />
        </div>
        <div className="mx-auto mt-0.5 h-1.5 w-8 rounded-full bg-black/40 blur-[2px]" />
        <AnimatePresence>
          {activeWorld && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2">
              <OverworldPrompt label={actionLabel} />
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Banner contextual del mundo cercano */}
      {activeWorld && (
        <motion.div
          key={activeWorld.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-x-3 top-12 z-30 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-primary/40 bg-background/85 p-3 backdrop-blur"
        >
          <span className="text-lg">{activeWorld.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{activeWorld.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {enterable
                ? activeWorld.progressStatus === "completed"
                  ? "Núcleo restaurado · vuelve a explorarlo"
                  : `${activeWorld.subject} · pulsa Entrar`
                : `Sellado por el Vacío · ${activeWorld.unlockHint}`}
            </p>
          </div>
          {activeWorld.progressStatus === "completed" && <Sparkles className="h-4 w-4 shrink-0 text-energy" />}
        </motion.div>
      )}

      {/* Controles */}
      <div className="absolute bottom-3 left-3 z-30">
        <TouchJoystick onChange={setAnalog} />
      </div>
      <div className="absolute bottom-3 right-3 z-30">
        <GameButton
          variant={activeWorld && !enterable ? "void" : "primary"}
          size="md"
          disabled={!activeWorld}
          onClick={() => enter(active)}
        >
          {actionLabel}
        </GameButton>
      </div>
    </WorldScene>
  );
}
