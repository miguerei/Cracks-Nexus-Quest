// battle3d/stageConfig.ts — composición del encuadre de combate.
//
// FASE 11 — composición "apuntando al gigante" (fotograma GAMEPLAY 9.5s):
// cámara BAJA detrás del grupo, héroe DE ESPALDAS en primer término inferior
// (silueta grande y nítida) y el enemigo ENORME centrado arriba-fondo. La
// escala se cuenta con la diagonal héroe(bajo-cerca) → coloso(alto-lejos).
// Todas las posiciones del decorado, la cámara y los puntos de origen/impacto
// de los hechizos viven aquí para que escena, arena y VFX compartan una sola
// verdad.

import type { StageVariant } from "./types";

export type Vec3 = [number, number, number];

/** Altura de la cadera del modelo de héroe en espacio LOCAL (pre-escala). */
export const HERO_HIP_Y = 0.86;

export type StageCfg = {
  /** Color de fondo/niebla de la escena (noche del Vacío: azul profundo). */
  bg: string;
  /** Posición base de la cámara (BAJA, detrás del héroe). */
  cam: Vec3;
  /** Punto al que mira la cámara (alto: hacia el gigante). */
  look: Vec3;
  /** Posición del héroe en el suelo (x, 0, z) — primer término inferior. */
  hero: Vec3;
  /** Escala del héroe en primer término (más grande = más cerca). */
  heroScale: number;
  /** Posición del enemigo en el suelo. */
  enemyPos: Vec3;
  /** Escala del enemigo (la lámina lo quiere ENORME en el boss). */
  enemyScale: number;
  /** Punto de impacto de los hechizos: el NÚCLEO del enemigo (mundo). */
  core: Vec3;
  /** Origen del proyectil: mano dominante del héroe (mundo, aprox.). */
  hand: Vec3;
  /** Color del contraluz (rim) que recorta la silueta del enemigo. */
  rim: string;
  /** Nº de motas de Vacío suspendidas por todo el encuadre. */
  motes: number;
};

/** Mano dominante del héroe: offset local escalado desde su posición. */
function mano(hero: Vec3, escala: number): Vec3 {
  return [hero[0] + 0.9 * escala, 1.7 * escala, hero[2] + 0.35 * escala];
}

export const STAGE_CFG: Record<StageVariant, StageCfg> = {
  // Duelo: rival humanoide (silueta oscura, acentos rosa) sobre plataforma.
  rival: {
    bg: "#0c1126",
    cam: [-1.35, 1.9, 8.9],
    look: [0.4, 2.6, -8],
    hero: [-2.3, 0, 2.6],
    heroScale: 1.12,
    enemyPos: [0.6, 0, -7],
    enemyScale: 1.18,
    core: [0.6, 2.25, -6.3],
    hand: mano([-2.3, 0, 2.6], 1.12),
    rim: "#f472b6",
    motes: 130,
  },
  // Jefe: Coloso del Vacío (§6) ENORME; el plano canon del fotograma.
  boss: {
    bg: "#0c1128",
    cam: [-1.6, 1.65, 9.6],
    look: [0.35, 4.5, -9],
    hero: [-1.7, 0, 3.1],
    heroScale: 1.25,
    enemyPos: [0.4, 0, -9.5],
    enemyScale: 1.45,
    core: [0.4, 5.4, -7.9],
    hand: mano([-1.7, 0, 3.1], 1.25),
    rim: "#a855f7",
    motes: 220,
  },
  // Puzzle: Guardián Rúnico — monolito sellado, tono sereno, contraluz cian.
  runas: {
    bg: "#0c1326",
    cam: [-1.35, 1.9, 8.9],
    look: [0.4, 2.7, -8],
    hero: [-2.3, 0, 2.6],
    heroScale: 1.12,
    enemyPos: [0.6, 0, -7.2],
    enemyScale: 1.3,
    core: [0.6, 2.55, -6.55],
    hand: mano([-2.3, 0, 2.6], 1.12),
    rim: "#7dd3fc",
    motes: 130,
  },
  // Arena: horda de Sombras del Vacío (principal al frente, dos al fondo).
  horda: {
    bg: "#0d1128",
    cam: [-1.35, 1.85, 8.9],
    look: [0.4, 2.5, -8],
    hero: [-2.3, 0, 2.6],
    heroScale: 1.12,
    enemyPos: [0.5, 0, -7.4],
    enemyScale: 1.3,
    core: [0.5, 2, -6.75],
    hand: mano([-2.3, 0, 2.6], 1.12),
    rim: "#a855f7",
    motes: 150,
  },
};
