import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { AvatarDisc } from "@/components/game/AvatarDisc";
import { GameButton } from "@/components/game/GameButton";
import { DialogueSequence, OverworldPrompt, type DialogueLine } from "@/components/game/dialogue";
import type { MissionWithStatus } from "@/services/gameService";

import { WorldScene } from "./WorldScene";
import { MissionCrystal } from "./MissionCrystal";
import { NPCNode } from "./NPCNode";
import { RivalNode } from "./RivalNode";
import { PortalNode } from "./PortalNode";
import { BlockedPathNode } from "./BlockedPathNode";
import { InteractionPrompt } from "./InteractionPrompt";
import { TouchJoystick } from "./TouchJoystick";
import { MiniMap } from "./MiniMap";
import { NovaCompanion } from "./NovaCompanion";
import { usePlayerController } from "./usePlayerController";
import { DEFAULT_REACH, WORLD_SCALE, type ExplorerNode, type ExplorerPoint } from "./types";

export type { ExplorerPoint } from "./types";
export type { ExplorerNode } from "./types";

type ActiveDialogue = {
  lines: DialogueLine[];
  choices?: ExplorerNode["choices"];
  onComplete?: () => void;
};

/**
 * WorldExplorer — orquestador de la capa de exploración 2D reutilizable.
 *
 * Compone WorldScene + PlayerController + nodos interactuables. Recibe las
 * misiones (con su estado real de gating) y su layout, y opcionalmente nodos
 * decorativos (NPCs, rivales, portales, senderos sellados) para dar vida al
 * mundo sin tocar la lógica de progresión.
 *
 * Fase 2-D — Suma sensación de RPG clásico: companion Nova que sigue al héroe,
 * indicador "!" cuando hay algo cerca y caja de diálogo inferior que se
 * reproduce antes de activar un reto. Sigue siendo presentacional: el gating
 * real y las recompensas viven en el service layer + guard + finish.
 */
export function WorldExplorer({
  missions,
  layout,
  playerImage,
  playerColor,
  background,
  decor = [],
  onActiveChange,
  onActiveNodeChange,
  buildMissionDialogue,
  novaCompanion = true,
}: {
  missions: MissionWithStatus[];
  layout: ExplorerPoint[];
  playerImage: string;
  playerColor: string;
  background?: string;
  /** Nodos extra (NPC, rival, portal, sendero sellado) para enriquecer la escena. */
  decor?: ExplorerNode[];
  onActiveChange?: (m: MissionWithStatus | null) => void;
  /** Nodo interactuable activo (cualquier tipo), para pistas contextuales de Nova. */
  onActiveNodeChange?: (node: ExplorerNode | null) => void;
  /** Diálogo previo al reto para un cristal de misión (Nova explica qué hacer). */
  buildMissionDialogue?: (m: MissionWithStatus) => DialogueLine[] | undefined;
  /** Muestra a Nova como companion seguidor del héroe. Por defecto true. */
  novaCompanion?: boolean;
}) {
  const navigate = useNavigate();
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });

  // Misiones → nodos de cristal, con su acción de navegación y diálogo previo.
  const missionNodes = useMemo<ExplorerNode[]>(
    () =>
      missions.map((m, i) => {
        const dialogue = m.status === "locked" ? undefined : buildMissionDialogue?.(m);
        // Elección simple estándar al final del diálogo de un cristal jugable:
        // entrar/repetir el reto o dejarlo para más tarde. Solo se ofrece si hay
        // diálogo (las elecciones se muestran al terminar la secuencia); los
        // cristales bloqueados no ofrecen elección.
        const choices: ExplorerNode["choices"] =
          dialogue && dialogue.length
            ? [
                {
                  label:
                    m.kind === "boss"
                      ? "¡Enfrentarlo!"
                      : m.status === "completed"
                        ? "Repetir reto"
                        : "Entrar al reto",
                  tone: m.kind === "boss" ? "gold" : "primary",
                  onSelect: () => navigate({ to: m.route, search: { m: m.id } }),
                },
                { label: "Más tarde", tone: "void" },
              ]
            : undefined;
        return {
          id: m.id,
          type: "mission",
          pos: layout[i] ?? { x: 50, y: 50 },
          status: m.status,
          label: m.kind === "boss" ? "Jefe" : `Misión ${m.n}`,
          title: m.title,
          sublabel: m.objective,
          emoji: m.npcEmoji,
          kind: m.kind,
          reach: DEFAULT_REACH,
          actionLabel: m.status === "locked" ? "Bloqueado" : m.status === "completed" ? "Repetir" : "Entrar",
          dialogue,
          choices,
          onInteract: () => {
            if (m.status === "locked") {
              toast.error("Sendero bloqueado. Supera la misión anterior para abrirlo.");
              return;
            }
            navigate({ to: m.route, search: { m: m.id } });
          },
        };
      }),
    [missions, layout, navigate, buildMissionDialogue],

  );

  const nodes = useMemo(() => [...missionNodes, ...decor], [missionNodes, decor]);
  const pathPoints = useMemo(() => missionNodes.map((n) => n.pos), [missionNodes]);

  // Medimos el tamaño en px para que la proximidad se sienta igual en móvil y escritorio.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // Diálogo activo (caja inferior estilo RPG). Mientras hay uno, se pausa el
  // movimiento del héroe y la tecla de acción del controlador.
  const [dialogue, setDialogue] = useState<ActiveDialogue | null>(null);
  const dialogueRef = useRef<ActiveDialogue | null>(null);
  dialogueRef.current = dialogue;

  // Al interactuar: si el nodo tiene diálogo/elecciones, se reproduce la
  // secuencia; si no, ejecuta directamente su acción.
  const activeRef = useRef<ExplorerNode | null>(null);
  const enter = useCallback((node: ExplorerNode | null) => {
    if (!node || dialogueRef.current) return;
    const lines = node.dialogue;
    const choices = node.choices;
    if ((lines && lines.length) || (choices && choices.length)) {
      setDialogue({
        lines: lines ?? [],
        choices,
        onComplete: choices?.length ? undefined : node.onInteract,
      });
      return;
    }
    node.onInteract?.();
  }, []);

  const { pos, moving, facing, setAnalog } = usePlayerController({
    // El mundo es ~1.9× el viewport, así que reducimos el paso para conservar
    // una velocidad de caminata natural mientras la cámara sigue al héroe.
    speed: 0.45,
    onInteract: () => enter(activeRef.current),
    paused: !!dialogue,
  });

  // Nodo interactuable más cercano dentro de su radio de alcance.
  const active = useMemo(() => {
    let best: { node: ExplorerNode; d: number } | null = null;
    for (const node of nodes) {
      const dx = ((node.pos.x - pos.x) / 100) * size.w;
      const dy = ((node.pos.y - pos.y) / 100) * size.h;
      const d = Math.hypot(dx, dy);
      // El plano es WORLD_SCALE× el viewport, así que escalamos el alcance para
      // conservar la misma sensación de proximidad que en el panel original.
      const reach = (node.reach ?? DEFAULT_REACH) * WORLD_SCALE;
      if (d < reach && (!best || d < best.d)) best = { node, d };
    }
    return best?.node ?? null;
  }, [nodes, pos, size]);
  activeRef.current = active;

  // Avisar a la ruta de la misión activa (compat con la API previa) y del nodo
  // activo genérico (para las pistas contextuales de Nova).
  useEffect(() => {
    const m = active?.type === "mission" ? missions.find((mm) => mm.id === active.id) ?? null : null;
    onActiveChange?.(m);
    onActiveNodeChange?.(active);
  }, [active, missions, onActiveChange, onActiveNodeChange]);

  // Cámara: mantiene al héroe centrado y desplaza el plano del mundo mientras
  // camina. `size` mide el plano completo en px (WORLD_SCALE · viewport), así
  // que el viewport visible es `size / WORLD_SCALE`. La cámara se limita para no
  // mostrar vacío fuera del mundo.
  const camera = useMemo<ExplorerPoint>(() => {
    const viewW = size.w / WORLD_SCALE;
    const viewH = size.h / WORLD_SCALE;
    const px = (pos.x / 100) * size.w;
    const py = (pos.y / 100) * size.h;
    const cx = Math.min(0, Math.max(viewW - size.w, viewW / 2 - px));
    const cy = Math.min(0, Math.max(viewH - size.h, viewH / 2 - py));
    return { x: cx, y: cy };
  }, [pos, size]);

  function renderNode(node: ExplorerNode) {
    const isActive = active?.id === node.id;
    switch (node.type) {
      case "npc":
        return <NPCNode key={node.id} node={node} active={isActive} />;
      case "rival":
        return <RivalNode key={node.id} node={node} active={isActive} />;
      case "portal":
        return <PortalNode key={node.id} node={node} active={isActive} />;
      case "blocked":
        return <BlockedPathNode key={node.id} node={node} active={isActive} />;
      default:
        return <MissionCrystal key={node.id} node={node} active={isActive} />;
    }
  }

  const actionLabel = !active
    ? "Acércate"
    : active.actionLabel ?? (active.status === "locked" ? "Bloqueado" : "Entrar");

  // Indicador tipo RPG sobre Nova: "!" si hay algo jugable cerca, "..." si es
  // un nodo bloqueado o meramente narrativo.
  const novaIndicator: "alert" | "hint" | null = dialogue
    ? null
    : active
      ? active.status === "locked" || active.type === "blocked"
        ? "hint"
        : "alert"
      : null;

  return (
    <WorldScene
      ref={areaRef}
      background={background}
      pathPoints={pathPoints}
      camera={camera}
      hint="Camina con WASD / flechas o el joystick"
      overlay={
        <>
          {/* Minimapa (fijo al viewport) */}
          <div className="absolute right-3 top-3 z-30">
            <MiniMap nodes={nodes} player={pos} />
          </div>

          {/* Prompt de interacción (banner superior con título del nodo) */}
          {!dialogue && <InteractionPrompt node={active} />}

          {/* Controles: se ocultan mientras hay un diálogo abierto */}
          {!dialogue && (
            <>
              <div className="absolute bottom-3 left-3 z-30">
                <TouchJoystick onChange={setAnalog} />
              </div>
              <div className="absolute bottom-3 right-3 z-30">
                <GameButton
                  variant={active?.status === "locked" ? "void" : "primary"}
                  size="md"
                  disabled={!active}
                  onClick={() => enter(active)}
                >
                  {actionLabel}
                </GameButton>
              </div>
            </>
          )}

          {/* Caja de diálogo inferior estilo RPG clásico */}
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
        </>
      }
    >
      {/* Nodos interactuables (viven dentro del mundo, se desplazan con la cámara) */}
      {nodes.map(renderNode)}

      {/* Nova companion siguiendo al héroe */}
      {novaCompanion && <NovaCompanion target={pos} indicator={novaIndicator} />}

      {/* Héroe del jugador (centrado por la cámara) */}
      <motion.div
        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        animate={{ y: moving ? [0, -3, 0] : [0, -4, 0] }}
        transition={{ duration: moving ? 0.4 : 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div style={{ transform: `scaleX(${facing})` }}>
          <AvatarDisc base="" image={playerImage} color={playerColor} size={56} className="glow-primary" />
        </div>
        <div className="mx-auto mt-0.5 h-1.5 w-8 rounded-full bg-black/40 blur-[2px]" />
        {/* Aviso "Pulsa Enter" sobre el héroe cuando hay algo cerca */}
        <AnimatePresence>
          {active && !dialogue && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2">
              <OverworldPrompt label={actionLabel} />
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </WorldScene>
  );
}
