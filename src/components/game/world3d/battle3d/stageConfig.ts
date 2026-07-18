// battle3d/stageConfig.ts — composición del encuadre de combate.
//
// El plano canon (vídeo intro): héroe DE ESPALDAS en primer término
// inferior-izquierda, enemigo al fondo centro entre ruinas. Todas las
// posiciones del decorado, la cámara y los puntos de origen/impacto de los
// hechizos viven aquí para que escena, arena y VFX compartan una sola verdad.

import type { StageVariant } from "./types";

export type Vec3 = [number, number, number];

/** Posición del héroe en el suelo (x, 0, z). */
// Más separado de la cámara y a la esquina: presencia sin tapar la escena.
export const HERO_POS: Vec3 = [-2.7, 0, 2.4];
/** Escala del héroe en primer término. */
export const HERO_SCALE = 1;
/** El origen de HeroModel está en la cadera; los pies quedan a -0.86. */
export const HERO_HIP_Y = 0.86 * HERO_SCALE;

export type StageCfg = {
  /** Color de fondo/niebla de la escena. */
  bg: string;
  /** Posición base de la cámara. */
  cam: Vec3;
  /** Punto al que mira la cámara. */
  look: Vec3;
  /** Posición del enemigo en el suelo. */
  enemyPos: Vec3;
  /** Punto de impacto de los hechizos: el NÚCLEO del enemigo (mundo). */
  core: Vec3;
  /** Origen del proyectil: mano dominante del héroe (mundo, aprox.). */
  hand: Vec3;
  /** Color del contraluz (rim) que recorta la silueta del enemigo. */
  rim: string;
};

export const STAGE_CFG: Record<StageVariant, StageCfg> = {
  // Duelo: rival humanoide (silueta oscura, acentos rosa) sobre plataforma.
  rival: {
    bg: "#0d1226",
    cam: [-1.15, 2.7, 8.4],
    look: [0.3, 2.05, -8],
    enemyPos: [0.6, 0, -7],
    core: [0.6, 1.9, -6.4],
    hand: [-1.85, 1.72, 3.5],
    rim: "#f472b6",
  },
  // Jefe: Coloso del Vacío (§6), núcleo violeta pulsante en el pecho.
  boss: {
    bg: "#140b22",
    cam: [-1.15, 2.95, 8.6],
    look: [0.3, 3.15, -9],
    enemyPos: [0.5, 0, -9],
    core: [0.5, 3.75, -7.9],
    hand: [-1.85, 1.72, 3.5],
    rim: "#a855f7",
  },
  // Puzzle: Guardián Rúnico — monolito sellado, tono sereno, contraluz cian.
  runas: {
    bg: "#0e1424",
    cam: [-1.15, 2.7, 8.4],
    look: [0.3, 2.1, -8],
    enemyPos: [0.6, 0, -7],
    core: [0.6, 1.95, -6.6],
    hand: [-1.85, 1.72, 3.5],
    rim: "#7dd3fc",
  },
  // Arena: horda de Sombras del Vacío (principal al frente, dos al fondo).
  horda: {
    bg: "#100d22",
    cam: [-1.15, 2.7, 8.4],
    look: [0.3, 2, -8],
    enemyPos: [0.5, 0, -7.5],
    core: [0.5, 1.85, -6.95],
    hand: [-1.85, 1.72, 3.5],
    rim: "#a855f7",
  },
};
