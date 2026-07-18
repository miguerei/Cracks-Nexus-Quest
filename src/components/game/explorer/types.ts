// Fase 2-C — Modelo de datos del sistema de exploración 2D reutilizable.
//
// La capa de exploración es presentacional: NO aplica recompensas ni muta el
// progreso. El gating real vive en el service layer + guard. Aquí solo movemos
// el héroe, detectamos proximidad y disparamos acciones (navegar, avisar…).

import type { Mission } from "@/services/gameService";
import type { DialogueLine, DialogueChoiceOption } from "@/components/game/dialogue/types";

export type ExplorerPoint = { x: number; y: number };

/** Estado visual de un nodo (independiente de la lógica de gating real). */
export type ExplorerNodeStatus = "available" | "locked" | "completed";

/** Tipos de interactuable que puede haber en una escena de mundo. */
export type ExplorerNodeType =
  | "mission" // cristal de misión / jefe
  | "npc" // aliado que da una pista
  | "rival" // rival del ranking
  | "portal" // salida a otra pantalla
  | "blocked"; // sendero sellado por el Vacío

/** Un punto interactuable colocado en el mapa del mundo (coordenadas en %). */
export interface ExplorerNode {
  id: string;
  type: ExplorerNodeType;
  /** Posición en porcentaje del área (0-100). */
  pos: ExplorerPoint;
  /** Estado visual; por defecto "available". */
  status?: ExplorerNodeStatus;
  /** Rótulo corto bajo el nodo. */
  label: string;
  /** Título mostrado en el prompt de interacción. */
  title?: string;
  /** Subtítulo del prompt. */
  sublabel?: string;
  /** Emoji del NPC / icono narrativo. */
  emoji?: string;
  /** Tipo de misión (solo para nodos de misión) para elegir el icono. */
  kind?: Mission["kind"];
  /** Radio de interacción en px (por defecto 72). */
  reach?: number;
  /** Acción al pulsar "Entrar" cerca del nodo. */
  onInteract?: () => void;
  /** Texto del botón de acción cuando este nodo está activo. */
  actionLabel?: string;
  /**
   * Diálogo tipo RPG que se muestra al interactuar (caja inferior). Si existe,
   * la secuencia se reproduce antes de ejecutar `onInteract` (que pasa a ser el
   * "onComplete" de la conversación).
   */
  dialogue?: DialogueLine[];
  /** Elecciones mostradas al final del diálogo (en vez de `onInteract`). */
  choices?: DialogueChoiceOption[];
}

/** Límites de movimiento del héroe dentro del área (en %). */
export interface ExplorerBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const DEFAULT_BOUNDS: ExplorerBounds = { minX: 4, maxX: 96, minY: 6, maxY: 95 };
export const DEFAULT_REACH = 72;

/**
 * Escala del plano del mundo respecto al viewport visible. Un valor > 1 hace
 * que el mundo sea más grande que la ventana, de modo que la cámara siga al
 * héroe y el escenario se desplace mientras camina (sensación de RPG top-down).
 */
export const WORLD_SCALE = 1.9;
