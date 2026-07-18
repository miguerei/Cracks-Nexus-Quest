// Fase 4 — Configuración de la capa de juego 3D en tercera persona.
//
// Define la paleta 3D por mundo (colores literales para materiales de three,
// derivados del Art Bible) y el layout físico del terreno: dónde aparece el
// héroe, dónde se colocan los cristales de misión y los nodos decorativos.
//
// Es puramente presentacional: NO toca gating ni recompensas. La lógica de
// progresión sigue viviendo en el service layer + guard + finish.

/** Coordenada en el plano del terreno (x, z). y=0 es el suelo. */
export type Spot = [number, number];

// ---------------------------------------------------------------------------
// Fase 7 — Tier de calidad (contrato opcional con render/quality.ts). Si el
// módulo existe, escala las densidades de masas de los entornos; si no, todo
// va a "alta". import.meta.glob resuelve en build: fichero ausente → {}.
// ---------------------------------------------------------------------------
export type QualityTier = "alta" | "media" | "baja";

const QUALITY_MODULES = import.meta.glob("./render/quality.ts", { eager: true }) as Record<
  string,
  { getQualityTier?: () => QualityTier } | undefined
>;

export function getQualityTierSafe(): QualityTier {
  const mod = QUALITY_MODULES["./render/quality.ts"];
  if (mod?.getQualityTier) {
    try {
      return mod.getQualityTier();
    } catch {
      return "alta";
    }
  }
  return "alta";
}

/** Escala de densidad de masas según el tier (alta ×1, media ×0.6, baja ×0.35). */
export function densityScale(): number {
  const tier = getQualityTierSafe();
  return tier === "alta" ? 1 : tier === "media" ? 0.6 : 0.35;
}

/** count escalado por el tier de calidad (mínimo 1). */
export function scaleCount(count: number): number {
  return Math.max(1, Math.round(count * densityScale()));
}

export type World3DTheme = {
  /** Color base del suelo. */
  ground: string;
  /** Color de la rejilla/borde luminoso del suelo. */
  grid: string;
  /** Color de acento (energía del conocimiento del mundo). */
  accent: string;
  /** Color de la niebla/atmósfera. */
  fog: string;
  /** Tinte de la luz ambiental. */
  ambient: string;
};

// Paletas por mundo, inspiradas en la energía de cada Núcleo del Saber.
// El Bosque (Fase 4-B) usa una paleta de "fantasía luminosa": tarde dorada
// filtrándose entre copas verdes, en vez del verde-noche original.
export const WORLD_THEMES: Record<string, World3DTheme> = {
  bosque: { ground: "#2b5237", grid: "#3f8a5c", accent: "#3ee08f", fog: "#93b998", ambient: "#cfe6c4" },
  algoritmos: { ground: "#0f1a2e", grid: "#2f5f9e", accent: "#38bdf8", fog: "#080f1f", ambient: "#8ecbff" },
  cronicas: { ground: "#241a10", grid: "#8a6a2f", accent: "#f5c542", fog: "#140d07", ambient: "#f0d089" },
  laboratorio: { ground: "#1b1230", grid: "#6a3fae", accent: "#a855f7", fog: "#0e0a1c", ambient: "#c79bf5" },
  lenguas: { ground: "#0f2427", grid: "#2f8a80", accent: "#2dd4bf", fog: "#08161a", ambient: "#8ee6da" },
  observatorio: { ground: "#141633", grid: "#4a4fae", accent: "#818cf8", fog: "#0a0b1c", ambient: "#aeb4ff" },
  "fortaleza-vacio": { ground: "#241016", grid: "#8a2f45", accent: "#f43f5e", fog: "#160709", ambient: "#f593a5" },
};

export const DEFAULT_THEME: World3DTheme = WORLD_THEMES.bosque;

export function getWorld3DTheme(worldId: string): World3DTheme {
  return WORLD_THEMES[worldId] ?? DEFAULT_THEME;
}

// ---- Layout físico del terreno (por mundo) ----

/** Altura de reposo del centro del héroe (cápsula) sobre el suelo. */
export const REST_Y = 1.05;

/** Radio de interacción con un nodo (en unidades del mundo). */
export const INTERACT_REACH = 2.8;

export type WorldLayout = {
  /** Medio ancho del terreno jugable (el suelo va de -half a +half). */
  groundHalf: number;
  /** Punto de aparición del héroe (x, z). */
  spawn: Spot;
  /** Posiciones de los 5 cristales de misión (todos los mundos tienen 5). */
  missionSpots: Spot[];
  /** Posiciones de los nodos decorativos del mundo. */
  decorSpots: { npc: Spot; rival: Spot; portal: Spot; blocked: Spot };
  /** Obstáculos visibles con colisión (rocas / cristales) para dar relieve. */
  obstacles: { pos: Spot; size: [number, number, number] }[];
  /**
   * Barreras invisibles (solo colisión). El Bosque las usa para que el río
   * solo pueda cruzarse por el puente: level design, no decoración.
   */
  barriers: { pos: Spot; half: [number, number, number] }[];
};

/** Layout original de Fase 4 (mundos que aún no tienen art pass propio). */
const CLASSIC_LAYOUT: WorldLayout = {
  groundHalf: 18,
  spawn: [0, 13],
  missionSpots: [
    [-9, 7],
    [-3, 0],
    [5, 5],
    [10, -3],
    [0, -11],
  ],
  decorSpots: {
    npc: [-7, 11],
    rival: [9, 11],
    portal: [13.5, 13.5],
    blocked: [-12, -6],
  },
  obstacles: [
    { pos: [-1, 8], size: [1.6, 2.2, 1.6] },
    { pos: [7, 1], size: [1.4, 1.8, 1.4] },
    { pos: [-6, -3], size: [1.8, 2.6, 1.8] },
    { pos: [3, -7], size: [1.4, 2, 1.4] },
  ],
  barriers: [],
};

// ---- Bosque del Descubrimiento (Fase 4-B, art pass AAA) ----
//
// El nivel es una RUTA, no un plano: entrada (sur) → sendero → cristal 1 →
// puente sobre el río → ruinas (cristal 2) → raíces (cristal 3) → claro del
// bosque (NPC y rival) → cristal 4 → portal → altar del Vacío (jefe, norte).
// El río corta el mapa de oeste a este y SOLO se cruza por el puente
// (barreras invisibles en ambas orillas salvo en el vano del puente).

/** Línea central del río del Bosque (z constante) y su semiancho. */
export const BOSQUE_RIVER = { z: 5.8, half: 1.6 } as const;
/** Vano del puente: rango de x SIN barrera sobre el río. */
export const BOSQUE_BRIDGE = { x: -4, halfW: 1.9, halfL: 2.6 } as const;

const BOSQUE_LAYOUT: WorldLayout = {
  groundHalf: 26,
  spawn: [0, 22],
  missionSpots: [
    [-11, 12], // 1 · junto al sendero, antes del río
    [8, -1], //   2 · centro de las ruinas
    [-6, -6], //  3 · entre las raíces gigantes
    [12, -12], // 4 · borde este del claro
    [0, -21], //  5 · altar del Vacío (jefe)
  ],
  decorSpots: {
    npc: [-4, -12], //   guía, en el claro
    rival: [4, -14], //  rival, en el claro
    portal: [-13, -17],
    blocked: [17, -18], // sendero sellado por la Bruma (esquina NE)
  },
  obstacles: [
    // Rocas musgosas que estrechan el paso (nunca sobre el sendero).
    { pos: [4, 16], size: [2.2, 1.6, 1.8] },
    { pos: [-16, 8.5], size: [2.4, 2, 2] },
    { pos: [14, 2.5], size: [1.8, 1.4, 1.6] },
    { pos: [-12, -10], size: [2, 1.8, 1.8] },
    { pos: [8, -18], size: [2.2, 1.5, 2] },
  ],
  barriers: [
    // Orillas del río: bloquean el agua salvo el vano del puente.
    { pos: [(-26 + (BOSQUE_BRIDGE.x - BOSQUE_BRIDGE.halfW)) / 2, BOSQUE_RIVER.z], half: [(BOSQUE_BRIDGE.x - BOSQUE_BRIDGE.halfW + 26) / 2, 1.4, BOSQUE_RIVER.half + 0.4] },
    { pos: [(BOSQUE_BRIDGE.x + BOSQUE_BRIDGE.halfW + 26) / 2, BOSQUE_RIVER.z], half: [(26 - (BOSQUE_BRIDGE.x + BOSQUE_BRIDGE.halfW)) / 2, 1.4, BOSQUE_RIVER.half + 0.4] },
    // Barandillas del puente (no caerse al agua desde el vano). Su fondo (z)
    // NO debe superar el de las barreras de orilla o crean muros invisibles
    // en tierra firme junto a la boca del puente.
    { pos: [BOSQUE_BRIDGE.x - BOSQUE_BRIDGE.halfW, BOSQUE_RIVER.z], half: [0.18, 1.2, BOSQUE_RIVER.half - 0.2] },
    { pos: [BOSQUE_BRIDGE.x + BOSQUE_BRIDGE.halfW, BOSQUE_RIVER.z], half: [0.18, 1.2, BOSQUE_RIVER.half - 0.2] },
  ],
};

// ---- Fase 5 — Gramática de cruce para el resto de mundos ----
//
// Cada mundo repite la lección del Bosque: una barrera física corta el mapa
// de oeste a este y SOLO se cruza por un vano temático (puente de luz, garganta
// de arena, pasarela…). Las barreras se generan con la misma geometría en
// todos: dos tramos principales + dos barandillas del paso.

/** Especificación del cruce: barrera principal + vano + paso elevado. */
export type CrossingSpec = {
  /** Línea central de la barrera (z constante). */
  z: number;
  /** Semiancho de la barrera en z (el "agua"/hueco visible). */
  half: number;
  /** Centro del vano (x sin barrera). */
  gapX: number;
  /** Semiancho del vano. */
  gapHalfW: number;
  /** Semilargo del paso elevado (en z). */
  walkHalfL: number;
};

/**
 * Barreras invisibles del cruce. LECCIÓN del Bosque: el fondo (z) de las
 * barandillas del paso NUNCA supera el de la barrera principal — las esquinas
 * salientes atascan al jugador junto a la boca del puente.
 */
function buildCrossingBarriers(groundHalf: number, c: CrossingSpec): WorldLayout["barriers"] {
  const west = c.gapX - c.gapHalfW; // borde oeste del vano
  const east = c.gapX + c.gapHalfW; // borde este del vano
  const mainHalfZ = c.half + 0.4;
  const railHalfZ = Math.min(mainHalfZ, Math.max(0.4, c.half - 0.2));
  return [
    // Tramos principales (dejan libre el vano).
    { pos: [(-groundHalf + west) / 2, c.z], half: [(west + groundHalf) / 2, 1.4, mainHalfZ] },
    { pos: [(east + groundHalf) / 2, c.z], half: [(groundHalf - east) / 2, 1.4, mainHalfZ] },
    // Barandillas del paso (no caerse al hueco desde el vano).
    { pos: [west, c.z], half: [0.18, 1.2, railHalfZ] },
    { pos: [east, c.z], half: [0.18, 1.2, railHalfZ] },
  ];
}

/** Cruce temático por mundo (el del Bosque replica sus constantes canónicas). */
export const WORLD_CROSSINGS: Record<string, CrossingSpec> = {
  bosque: { z: BOSQUE_RIVER.z, half: BOSQUE_RIVER.half, gapX: BOSQUE_BRIDGE.x, gapHalfW: BOSQUE_BRIDGE.halfW, walkHalfL: BOSQUE_BRIDGE.halfL },
  // Canal de datos cruzado por un puente de luz (espejo x del Bosque).
  algoritmos: { z: 5.5, half: 1.7, gapX: 4, gapHalfW: 1.9, walkHalfL: 2.6 },
  // Garganta de arena con puente de losas colgantes.
  cronicas: { z: 6.5, half: 1.9, gapX: -5, gapHalfW: 2, walkHalfL: 2.8 },
  // Grieta de cristal con puente de láminas de cuarzo.
  laboratorio: { z: 5, half: 1.5, gapX: 3, gapHalfW: 1.8, walkHalfL: 2.4 },
  // Estrecho de agua entre islotes con pasarela de madera.
  lenguas: { z: 6, half: 1.8, gapX: -3, gapHalfW: 1.9, walkHalfL: 2.7 },
  // Hueco al vacío estelar con puente de anillos.
  observatorio: { z: 5.5, half: 1.8, gapX: 0, gapHalfW: 2, walkHalfL: 2.7 },
  // Foso de niebla del Vacío con puente de obsidiana.
  "fortaleza-vacio": { z: 6, half: 1.9, gapX: 2, gapHalfW: 1.9, walkHalfL: 2.8 },
};

// Ruta común: entrada (sur) → sendero → cristal 1 → cruce → hito (cristal 2)
// → cristal 3 → claro social (NPC/rival, cristal 4) → portal → altar del jefe
// (cristal 5, norte). Los mundos comparten topología con espejos y escalas.

/** Ciudadela circuito: plazas de datos, torres, senda luminosa (espejo x). */
const ALGORITMOS_LAYOUT: WorldLayout = {
  groundHalf: 24,
  spawn: [0, 20],
  missionSpots: [
    [10, 11], //   1 · plaza de datos, antes del canal
    [-8, -1], //   2 · foro de las torres de datos
    [6, -6], //    3 · entre pilones holográficos
    [-11, -11], // 4 · borde oeste del claro
    [0, -19], //   5 · altar del Vacío (jefe)
  ],
  decorSpots: {
    npc: [3, -11],
    rival: [-4, -13],
    portal: [12, -16],
    blocked: [-16, -16], // nodo corrupto sellado por la Bruma (esquina SO)
  },
  obstacles: [
    // Bloques de servidor caídos (nunca sobre la senda).
    { pos: [-5, 15], size: [2.2, 1.8, 1.8] },
    { pos: [15, 8], size: [2, 2.2, 2] },
    { pos: [-13, 2], size: [1.8, 1.5, 1.6] },
    { pos: [12, -9], size: [2, 1.8, 1.8] },
    { pos: [-8, -17], size: [2.2, 1.5, 2] },
  ],
  barriers: buildCrossingBarriers(24, WORLD_CROSSINGS.algoritmos),
};

/** Desierto dorado: obeliscos, coloso, garganta de arena (mapa grande). */
const CRONICAS_LAYOUT: WorldLayout = {
  groundHalf: 28,
  spawn: [0, 24],
  missionSpots: [
    [-12, 13], //  1 · junto a los estandartes, antes de la garganta
    [9, -1], //    2 · círculo de obeliscos
    [-7, -7], //   3 · a los pies del coloso
    [13, -13], //  4 · borde este del oasis
    [0, -23], //   5 · altar del Vacío (jefe)
  ],
  decorSpots: {
    npc: [-4, -14],
    rival: [5, -15],
    portal: [-15, -19],
    blocked: [18, -20], // duna sellada por la Bruma (esquina NE)
  },
  obstacles: [
    // Bloques de ruina hundidos en la arena.
    { pos: [5, 17], size: [2.4, 1.6, 2] },
    { pos: [-17, 9], size: [2.2, 2, 2] },
    { pos: [15, 3], size: [1.8, 1.4, 1.8] },
    { pos: [-13, -11], size: [2, 1.8, 1.8] },
    { pos: [9, -19], size: [2.2, 1.5, 2] },
  ],
  barriers: buildCrossingBarriers(28, WORLD_CROSSINGS.cronicas),
};

/** Cavernas de cristal: mapa recogido, grieta luminosa, cuevas rosa/azul. */
const LABORATORIO_LAYOUT: WorldLayout = {
  groundHalf: 22,
  spawn: [0, 18],
  missionSpots: [
    [9, 10], //    1 · jardín de setas, antes de la grieta
    [-7, -1], //   2 · sala de los cristales colosales
    [5, -5], //    3 · mesa de alambiques
    [-10, -10], // 4 · borde oeste del claro
    [0, -17], //   5 · altar del Vacío (jefe)
  ],
  decorSpots: {
    npc: [3, -10],
    rival: [-4, -11],
    portal: [10, -14],
    blocked: [-14, -14], // galería sellada por la Bruma (esquina SO)
  },
  obstacles: [
    // Rocas de cuarzo (nunca sobre la senda).
    { pos: [-5, 13], size: [2, 1.8, 1.8] },
    { pos: [13, 6], size: [1.8, 2, 1.8] },
    { pos: [-12, 3], size: [1.8, 1.5, 1.6] },
    { pos: [11, -9], size: [1.8, 1.6, 1.6] },
    { pos: [-7, -15], size: [2, 1.4, 1.8] },
  ],
  barriers: buildCrossingBarriers(22, WORLD_CROSSINGS.laboratorio),
};

/** Archipiélago de las Mareas: islote central, estrecho de agua, faros. */
const LENGUAS_LAYOUT: WorldLayout = {
  groundHalf: 25,
  spawn: [0, 21],
  missionSpots: [
    [-10, 12], //  1 · playa de la entrada, antes del estrecho
    [8, -1], //    2 · faro mayor
    [-6, -6], //   3 · jardín de corales
    [11, -12], //  4 · borde este del claro
    [0, -20], //   5 · altar del Vacío (jefe)
  ],
  decorSpots: {
    npc: [-3, -12],
    rival: [4, -13],
    portal: [-13, -16],
    blocked: [16, -17], // cala sellada por la Bruma (esquina NE)
  },
  obstacles: [
    // Rocas marinas pulidas por la marea.
    { pos: [5, 16], size: [2, 1.5, 1.8] },
    { pos: [-15, 8], size: [2.2, 1.8, 2] },
    { pos: [14, 3], size: [1.8, 1.4, 1.6] },
    { pos: [-12, -10], size: [1.8, 1.6, 1.8] },
    { pos: [8, -17], size: [2, 1.4, 1.8] },
  ],
  barriers: buildCrossingBarriers(25, WORLD_CROSSINGS.lenguas),
};

/** Plataformas astrales: hueco al vacío estelar, telescopio, anillos. */
const OBSERVATORIO_LAYOUT: WorldLayout = {
  groundHalf: 24,
  spawn: [0, 20],
  missionSpots: [
    [-10, 11], //  1 · mirador sur, antes del hueco estelar
    [8, -2], //    2 · gran telescopio
    [-6, -7], //   3 · suelo de constelaciones
    [11, -12], //  4 · borde este del claro
    [0, -19], //   5 · altar del Vacío (jefe)
  ],
  decorSpots: {
    npc: [-4, -12],
    rival: [4, -13],
    portal: [13, -15],
    blocked: [-15, -16], // plataforma sellada por la Bruma (esquina SO)
  },
  obstacles: [
    // Fragmentos de plataforma caídos.
    { pos: [6, 15], size: [2, 1.6, 1.8] },
    { pos: [-14, 8], size: [2.2, 1.8, 2] },
    { pos: [14, 2], size: [1.8, 1.4, 1.6] },
    { pos: [-11, -9], size: [1.8, 1.6, 1.8] },
    { pos: [8, -16], size: [2, 1.4, 1.8] },
  ],
  barriers: buildCrossingBarriers(24, WORLD_CROSSINGS.observatorio),
};

/** Fortaleza del Vacío: el único mundo oscuro. Foso de niebla, obsidiana. */
const FORTALEZA_LAYOUT: WorldLayout = {
  groundHalf: 26,
  spawn: [0, 22],
  missionSpots: [
    [10, 12], //   1 · patio de púas, antes del foso
    [-8, -1], //   2 · fauces de obsidiana
    [6, -7], //    3 · campo de grietas frías
    [-12, -12], // 4 · borde oeste del refugio
    [0, -21], //   5 · trono del Vacío (jefe)
  ],
  decorSpots: {
    npc: [3, -12],
    rival: [-4, -14],
    portal: [14, -17],
    blocked: [-17, -18], // brecha sellada por la Bruma (esquina SO)
  },
  obstacles: [
    // Bloques de obsidiana derrumbados.
    { pos: [-5, 16], size: [2.2, 1.8, 1.8] },
    { pos: [16, 9], size: [2.2, 2, 2] },
    { pos: [-14, 2], size: [1.8, 1.6, 1.6] },
    { pos: [13, -10], size: [2, 1.8, 1.8] },
    { pos: [-8, -18], size: [2.2, 1.5, 2] },
  ],
  barriers: buildCrossingBarriers(26, WORLD_CROSSINGS["fortaleza-vacio"]),
};

const WORLD_LAYOUTS: Record<string, WorldLayout> = {
  bosque: BOSQUE_LAYOUT,
  algoritmos: ALGORITMOS_LAYOUT,
  cronicas: CRONICAS_LAYOUT,
  laboratorio: LABORATORIO_LAYOUT,
  lenguas: LENGUAS_LAYOUT,
  observatorio: OBSERVATORIO_LAYOUT,
  "fortaleza-vacio": FORTALEZA_LAYOUT,
};

export function getWorldLayout(worldId: string): WorldLayout {
  return WORLD_LAYOUTS[worldId] ?? CLASSIC_LAYOUT;
}

// ---- Siluetas de héroe por clase (Fase 4-B) ----
// Cada Aspirante conserva la forma humanoide base y se diferencia por color de
// acento, un detalle de silueta y su aura. Es 100% presentacional.
export type HeroLook = {
  /** Color de acento (piezas emisivas, aura, arma/orbe). */
  accent: string;
  /** Detalle distintivo. */
  detail: "capa" | "visor" | "banda" | "aura" | "capucha";
  /** Emoji del emblema flotante sobre el héroe (feedback rápido). */
  emblem: string;
  /** Nombre en clave (para lectura de código). */
  label: string;
};

export const HERO_LOOKS = {
  explorador: { accent: "#60a5fa", detail: "banda", emblem: "🧭", label: "Explorador" },
  estratega: { accent: "#c084fc", detail: "capa", emblem: "♟️", label: "Estratega" },
  sabio: { accent: "#facc15", detail: "capucha", emblem: "📚", label: "Sabio" },
  velocista: { accent: "#4ade80", detail: "aura", emblem: "⚡", label: "Velocista" },
  constructor: { accent: "#22d3ee", detail: "visor", emblem: "🛠️", label: "Constructor" },
} as const satisfies Record<string, HeroLook>;

export const DEFAULT_HERO_LOOK: HeroLook = HERO_LOOKS.explorador;

export function getHeroLook(classId: string | undefined): HeroLook {
  return (HERO_LOOKS as Record<string, HeroLook>)[classId ?? "explorador"] ?? DEFAULT_HERO_LOOK;
}
