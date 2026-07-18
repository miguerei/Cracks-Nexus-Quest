// Fase 5 — Módulo de entornos por mundo.
//
// Lo consume World3DScene para montar el entorno visual y el rig paramétrico
// de luces/niebla/cámara de cada mundo. Los siete biomas siguen la gramática
// del Bosque (Art Bible §8): entrada clara → ruta legible → cruce temático →
// hitos → claro social → portal → altar del jefe. Cada mundo tiene su
// componente de entorno (montado DENTRO de <Physics>) y su ambience diseñada.

import type { ComponentType } from "react";

import AlgoritmosEnvironment, { ALGORITMOS_SUN } from "./AlgoritmosEnvironment";
import BosqueEnvironment from "./BosqueEnvironment";
import CronicasEnvironment, { CRONICAS_SUN } from "./CronicasEnvironment";
import FortalezaEnvironment, { FORTALEZA_SUN } from "./FortalezaEnvironment";
import LaboratorioEnvironment, { LABORATORIO_SUN } from "./LaboratorioEnvironment";
import LenguasEnvironment, { LENGUAS_SUN } from "./LenguasEnvironment";
import ObservatorioEnvironment, { OBSERVATORIO_SUN } from "./ObservatorioEnvironment";
import { getWorld3DTheme } from "./worldConfig";

/** Parámetros de atmósfera e iluminación de un mundo (rig único de la escena). */
export type WorldAmbience = {
  fogColor: string;
  fogNear: number;
  fogFar: number;
  sunColor: string;
  sunIntensity: number;
  /** Dirección del sol (se normaliza en la escena). */
  sunDir: [number, number, number];
  ambientColor: string;
  ambientIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fillColor: string;
  fillIntensity: number;
  /** Límite de la cámara en Z (null = sin clamp). */
  clampCameraZ: number | null;
};

const ENVIRONMENTS: Record<string, ComponentType> = {
  bosque: BosqueEnvironment,
  algoritmos: AlgoritmosEnvironment,
  cronicas: CronicasEnvironment,
  laboratorio: LaboratorioEnvironment,
  lenguas: LenguasEnvironment,
  observatorio: ObservatorioEnvironment,
  "fortaleza-vacio": FortalezaEnvironment,
};

/** Entorno visual del mundo (montado dentro de <Physics>), o null si usa el terreno clásico. */
export function getWorldEnvironment(worldId: string): ComponentType | null {
  return ENVIRONMENTS[worldId] ?? null;
}

// Ambiences diseñadas por mundo. clampCameraZ = groundHalf del layout + 7.
const AMBIENCES: Record<string, WorldAmbience> = {
  // Tarde dorada del Bosque del Descubrimiento (valores canon Fase 4-B).
  bosque: {
    fogColor: "#93b998",
    fogNear: 34,
    fogFar: 190,
    sunColor: "#ffdead",
    sunIntensity: 1.55,
    sunDir: [-0.5, 0.72, -0.42],
    ambientColor: "#d8ecd0",
    ambientIntensity: 0.62,
    hemiSky: "#cfe8d4",
    hemiGround: "#33523a",
    hemiIntensity: 0.68,
    fillColor: "#8fc3e8",
    fillIntensity: 0.35,
    clampCameraZ: 33,
  },
  // Mediodía frío de la Ciudadela circuito: azul acero con relleno cian.
  algoritmos: {
    fogColor: "#8fb0d4",
    fogNear: 30,
    fogFar: 170,
    sunColor: "#dceaff",
    sunIntensity: 1.35,
    sunDir: ALGORITMOS_SUN,
    ambientColor: "#cfe0f5",
    ambientIntensity: 0.55,
    hemiSky: "#bcd7f2",
    hemiGround: "#20304a",
    hemiIntensity: 0.6,
    fillColor: "#38bdf8",
    fillIntensity: 0.28,
    clampCameraZ: 31,
  },
  // Atardecer eterno del Desierto: oro cálido y bruma de arena.
  cronicas: {
    fogColor: "#e3bd85",
    fogNear: 32,
    fogFar: 190,
    sunColor: "#ffce7a",
    sunIntensity: 1.6,
    sunDir: CRONICAS_SUN,
    ambientColor: "#f5deb0",
    ambientIntensity: 0.55,
    hemiSky: "#ffe2ae",
    hemiGround: "#7a5a33",
    hemiIntensity: 0.6,
    fillColor: "#f4c542",
    fillIntensity: 0.3,
    clampCameraZ: 35,
  },
  // Gruta de cristal: sin sol duro, resplandor difuso violeta con rebote rosa.
  laboratorio: {
    fogColor: "#8f77b5",
    fogNear: 24,
    fogFar: 120,
    sunColor: "#d9c8f5",
    sunIntensity: 0.8,
    sunDir: LABORATORIO_SUN,
    ambientColor: "#d8c6f2",
    ambientIntensity: 0.78,
    hemiSky: "#c9b4ec",
    hemiGround: "#2a1e42",
    hemiIntensity: 0.8,
    fillColor: "#f0a8d8",
    fillIntensity: 0.35,
    clampCameraZ: 29,
  },
  // Mañana marina del Archipiélago: luz alta y bruma clara sobre el agua.
  lenguas: {
    fogColor: "#a4d2d6",
    fogNear: 32,
    fogFar: 175,
    sunColor: "#fff4d6",
    sunIntensity: 1.5,
    sunDir: LENGUAS_SUN,
    ambientColor: "#d6f0ee",
    ambientIntensity: 0.6,
    hemiSky: "#c8ecec",
    hemiGround: "#1a4a44",
    hemiIntensity: 0.65,
    fillColor: "#2dd4bf",
    fillIntensity: 0.3,
    clampCameraZ: 32,
  },
  // Noche astral del Observatorio: luna plateada, sombras índigo legibles.
  observatorio: {
    fogColor: "#232848",
    fogNear: 30,
    fogFar: 160,
    sunColor: "#cdd6ff",
    sunIntensity: 0.9,
    sunDir: OBSERVATORIO_SUN,
    ambientColor: "#9aa4d8",
    ambientIntensity: 0.55,
    hemiSky: "#3a4478",
    hemiGround: "#12142a",
    hemiIntensity: 0.62,
    fillColor: "#818cf8",
    fillIntensity: 0.3,
    clampCameraZ: 31,
  },
  // Fortaleza del Vacío: el único mundo oscuro — pero el héroe siempre se ve
  // (ambiente violeta desaturado alto, luna fría, relleno violeta).
  "fortaleza-vacio": {
    fogColor: "#2a1b33",
    fogNear: 26,
    fogFar: 130,
    sunColor: "#b9a8d8",
    sunIntensity: 0.75,
    sunDir: FORTALEZA_SUN,
    ambientColor: "#9182b4",
    ambientIntensity: 0.62,
    hemiSky: "#4a3a66",
    hemiGround: "#171021",
    hemiIntensity: 0.66,
    fillColor: "#a855f7",
    fillIntensity: 0.26,
    clampCameraZ: 33,
  },
};

/** Ambience del mundo (fallback: presentación clásica derivada del tema). */
export function getWorldAmbience(worldId: string): WorldAmbience {
  const designed = AMBIENCES[worldId];
  if (designed) return designed;
  const theme = getWorld3DTheme(worldId);
  return {
    fogColor: theme.fog,
    fogNear: 22,
    fogFar: 46,
    sunColor: "#ffffff",
    sunIntensity: 1.1,
    sunDir: [12, 20, 8],
    ambientColor: theme.ambient,
    ambientIntensity: 0.7,
    hemiSky: theme.ambient,
    hemiGround: theme.ground,
    hemiIntensity: 0.5,
    fillColor: "#8fc3e8",
    fillIntensity: 0,
    clampCameraZ: null,
  };
}
