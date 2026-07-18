// Central mock data layer for the Nexus Quest demo.
// Everything here is mock. When Supabase is connected these shapes map to
// tables: avatar_items, player_classes, worlds/unlocked_worlds,
// knowledge_concepts, questions, missions, leaderboard_entries, rewards,
// achievements. The services layer (src/services) reads from here today and
// will read from Supabase later without changing the UI.

export type LeagueId = "bronce" | "plata" | "oro" | "diamante" | "leyenda";

export const LEAGUES: Record<LeagueId, { name: string; color: string; min: number }> = {
  bronce: { name: "Bronce", color: "oklch(0.62 0.12 55)", min: 0 },
  plata: { name: "Plata", color: "oklch(0.78 0.02 250)", min: 800 },
  oro: { name: "Oro", color: "oklch(0.82 0.16 85)", min: 2000 },
  diamante: { name: "Diamante", color: "oklch(0.72 0.16 200)", min: 4000 },
  leyenda: { name: "Leyenda", color: "oklch(0.65 0.24 300)", min: 8000 },
};

export function leagueForPoints(points: number): LeagueId {
  const order: LeagueId[] = ["leyenda", "diamante", "oro", "plata", "bronce"];
  return order.find((l) => points >= LEAGUES[l].min) ?? "bronce";
}

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(xp / 250) + 1);
}
export function xpIntoLevel(xp: number): { current: number; needed: number } {
  const current = xp % 250;
  return { current, needed: 250 };
}

// ---- Player classes ----
// Fase 1.3 — cada clase tiene identidad de videojuego: rol, copy largo, color
// secundario para el aura, icono lucide y afinidad de mundo. Los campos nuevos
// son opcionales para no romper llamadas previas; hoy todas los definen.
export type PlayerClass = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  tagline: string;
  perk: string;
  role?: string;
  description?: string;
  colorSecondary?: string;
  icon?: string; // nombre de icono lucide (data-driven)
  worldAffinity?: string; // id de mundo con más afinidad
};

export const PLAYER_CLASSES: PlayerClass[] = [
  {
    id: "explorador",
    name: "Explorador",
    emoji: "🧭",
    color: "oklch(0.68 0.19 250)",
    colorSecondary: "oklch(0.78 0.19 150)",
    tagline: "Descubre lo oculto",
    perk: "+ cristales al explorar mundos nuevos",
    role: "Descubrimiento · caminos ocultos",
    description: "Descubre rutas ocultas y abre nuevos caminos en el Nexus.",
    icon: "Compass",
    worldAffinity: "bosque",
  },
  {
    id: "estratega",
    name: "Estratega",
    emoji: "♟️",
    color: "oklch(0.6 0.24 300)",
    colorSecondary: "oklch(0.68 0.19 250)",
    tagline: "Piensa cada jugada",
    perk: "+ puntos por rachas largas",
    role: "Táctica · planificar cada jugada",
    description: "Domina el tablero: cada decisión te acerca a la victoria.",
    icon: "Brain",
    worldAffinity: "algoritmos",
  },
  {
    id: "sabio",
    name: "Sabio",
    emoji: "📚",
    color: "oklch(0.82 0.16 85)",
    colorSecondary: "oklch(0.78 0.16 60)",
    tagline: "El saber es poder",
    perk: "+ XP en puzzles y duelos",
    role: "Conocimiento · dominio del saber",
    description: "El saber es tu arma. Resuelve lo que otros no entienden.",
    icon: "BookOpen",
    worldAffinity: "cronicas",
  },
  {
    id: "velocista",
    name: "Velocista",
    emoji: "⚡",
    color: "oklch(0.78 0.19 150)",
    colorSecondary: "oklch(0.82 0.16 85)",
    tagline: "Rapidez ante todo",
    perk: "+ bonus por responder rápido",
    role: "Velocidad · reflejos",
    description: "Responde antes que nadie y adelanta a tus rivales.",
    icon: "Zap",
    worldAffinity: "lenguas",
  },
  {
    id: "constructor",
    name: "Constructor",
    emoji: "🛠️",
    color: "oklch(0.62 0.2 190)",
    colorSecondary: "oklch(0.68 0.19 250)",
    tagline: "Crea y reconstruye",
    perk: "+ monedas en cada misión",
    role: "Creación · reconstruir el Núcleo",
    description: "Repara el Nexus y levanta lo que el Vacío destruyó.",
    icon: "Wrench",
    worldAffinity: "laboratorio",
  },
];

export function classById(id: string): PlayerClass {
  return PLAYER_CLASSES.find((c) => c.id === id) ?? PLAYER_CLASSES[0];
}

// ---- Companions ----
export type Companion = { id: string; name: string; emoji: string; desc: string };
export const COMPANIONS: Companion[] = [
  { id: "nova", name: "Nova", emoji: "🌟", desc: "Tu chispa de energía. Te guía en cada misión." },
];

// ---- Avatar customization ----
export type AvatarItem = { id: string; label: string; value: string };

// Color principal (energía)
export const AVATAR_COLORS: { id: string; label: string; value: string }[] = [
  { id: "azul", label: "Azul eléctrico", value: "oklch(0.68 0.19 250)" },
  { id: "violeta", label: "Violeta", value: "oklch(0.6 0.24 300)" },
  { id: "energia", label: "Verde energía", value: "oklch(0.78 0.19 150)" },
  { id: "dorado", label: "Dorado", value: "oklch(0.82 0.16 85)" },
  { id: "cian", label: "Cian", value: "oklch(0.62 0.2 190)" },
  { id: "void", label: "Vacío", value: "oklch(0.55 0.2 330)" },
];

// Pelo / tocado
export const AVATAR_HAIR: AvatarItem[] = [
  { id: "none", label: "Sin tocado", value: "" },
  { id: "cap", label: "Gorra", value: "🧢" },
  { id: "phones", label: "Cascos", value: "🎧" },
  { id: "hat", label: "Sombrero", value: "🎩" },
  { id: "band", label: "Cinta", value: "🎽" },
];

// Ropa / estilo (define el degradado del disco)
export const AVATAR_OUTFITS: { id: string; label: string; value: string }[] = [
  { id: "nexus", label: "Nexus", value: "oklch(0.2 0.05 275)" },
  { id: "neon", label: "Neón", value: "oklch(0.32 0.14 300)" },
  { id: "void", label: "Sombrío", value: "oklch(0.16 0.06 330)" },
  { id: "aurora", label: "Aurora", value: "oklch(0.3 0.12 190)" },
];

// Emblema
export const AVATAR_EMBLEM: AvatarItem[] = [
  { id: "none", label: "Ninguno", value: "" },
  { id: "crown", label: "Corona", value: "👑" },
  { id: "bolt", label: "Rayo", value: "⚡" },
  { id: "star", label: "Estrella", value: "✨" },
  { id: "fire", label: "Fuego", value: "🔥" },
];

// ---- Worlds ----
// Fase 1.3 — cada mundo declara su blueprint: orden, materia/tema futuros,
// minijuegos planificados y si es contenido futuro (no jugable todavía). Estos
// campos son SOLO planificación/presentación; NO cambian el gating (eso lo sigue
// derivando gameService a partir del progreso real del jugador).
export type PlannedMinigame = { name: string; kind: string; concept: string };

export type World = {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  status: "unlocked" | "locked";
  route?: string;
  reward: string;
  requirement: string;
  x: number; // % position on map
  y: number;
  order: number;
  subject: string; // materia (futura)
  theme: string; // tema del mundo
  future: boolean; // true = aún no jugable
  plannedMinigames: PlannedMinigame[];
};

export const WORLDS: World[] = [
  {
    id: "bosque",
    name: "Bosque del Descubrimiento",
    tagline: "Tu primera aventura",
    emoji: "🌌",
    status: "unlocked",
    route: "/mundo/bosque",
    reward: "🎁 Cofre de Bienvenida",
    requirement: "Disponible",
    x: 22,
    y: 68,
    order: 1,
    subject: "Biología · ESO",
    theme: "La célula",
    future: false,
    plannedMinigames: [
      { name: "Carrera de Portales", kind: "duelo", concept: "Mitocondria y energía" },
      { name: "Puzzle de Cristales", kind: "puzzle", concept: "Partes de la célula" },
      { name: "Duelo de Cartas", kind: "cartas", concept: "Núcleo y ADN" },
      { name: "Arena de Oleadas", kind: "arena", concept: "Todos los conceptos" },
      { name: "Zumbra, el Vacío", kind: "boss", concept: "Repaso general" },
    ],
  },
  {
    id: "algoritmos",
    name: "Ciudad de los Algoritmos",
    tagline: "Circuitos de razón pura",
    emoji: "🌆",
    status: "locked",
    reward: "🧠 Núcleo Lógico",
    requirement: "Alcanza el nivel 3",
    x: 40,
    y: 46,
    order: 2,
    subject: "Matemáticas · ESO",
    theme: "Números, geometría y lógica",
    future: true,
    plannedMinigames: [
      { name: "Puentes de Ecuaciones", kind: "puzzle", concept: "Ecuaciones y despejes" },
      { name: "Carrera de Proporciones", kind: "duelo", concept: "Proporciones y porcentajes" },
      { name: "Torres de Geometría", kind: "arena", concept: "Figuras y áreas" },
      { name: "Laberinto de Coordenadas", kind: "puzzle", concept: "Plano cartesiano" },
      { name: "El Error Infinito", kind: "boss", concept: "Repaso de Matemáticas" },
    ],
  },
  {
    id: "cronicas",
    name: "Biblioteca de las Crónicas",
    tagline: "Ecos de civilizaciones perdidas",
    emoji: "🏛️",
    status: "locked",
    reward: "💎 Cristal Antiguo",
    requirement: "Completa la Ciudad de los Algoritmos",
    x: 28,
    y: 26,
    order: 3,
    subject: "Geografía e Historia · ESO",
    theme: "Tiempo, mapas y civilizaciones",
    future: true,
    plannedMinigames: [
      { name: "Línea Temporal Viva", kind: "puzzle", concept: "Ordenar eventos históricos" },
      { name: "Cartógrafo de Reinos", kind: "puzzle", concept: "Mapas y territorios" },
      { name: "Archivo de Fuentes", kind: "cartas", concept: "Fuentes históricas" },
      { name: "Consejo de Causas y Consecuencias", kind: "arena", concept: "Causas y efectos" },
      { name: "El Olvido", kind: "boss", concept: "Repaso de Historia" },
    ],
  },
  {
    id: "laboratorio",
    name: "Laboratorio Nexus",
    tagline: "Donde nace la materia",
    emoji: "🧪",
    status: "locked",
    reward: "⚗️ Fórmula Nexus",
    requirement: "Completa la Biblioteca de las Crónicas",
    x: 54,
    y: 64,
    order: 4,
    subject: "Física y Química · ESO",
    theme: "Fuerzas, energía y reacciones",
    future: true,
    plannedMinigames: [
      { name: "Reactor de Fórmulas", kind: "puzzle", concept: "Fórmulas químicas" },
      { name: "Circuitos de Energía", kind: "duelo", concept: "Energía y electricidad" },
      { name: "Mezcla de Elementos", kind: "puzzle", concept: "Elementos y compuestos" },
      { name: "Equilibrio de Fuerzas", kind: "arena", concept: "Fuerzas y movimiento" },
      { name: "La Reacción Caótica", kind: "boss", concept: "Repaso de Física y Química" },
    ],
  },
  {
    id: "lenguas",
    name: "Templo de las Lenguas",
    tagline: "El poder de la palabra",
    emoji: "📜",
    status: "locked",
    reward: "🗝️ Runa Políglota",
    requirement: "Completa el Laboratorio Nexus",
    x: 60,
    y: 38,
    order: 5,
    subject: "Lenguas y Comunicación · ESO",
    theme: "Vocabulario, comprensión e idiomas",
    future: true,
    plannedMinigames: [
      { name: "Diálogo con NPC", kind: "cartas", concept: "Comprensión y respuesta" },
      { name: "Puertas de Traducción", kind: "puzzle", concept: "Traducción de términos" },
      { name: "Carrera de Listening", kind: "duelo", concept: "Comprensión auditiva" },
      { name: "Hechizos de Vocabulario", kind: "arena", concept: "Vocabulario y léxico" },
      { name: "La Torre de Babel", kind: "boss", concept: "Repaso de Lenguas" },
    ],
  },
  {
    id: "observatorio",
    name: "Observatorio Cuántico",
    tagline: "Donde la tecnología cobra vida",
    emoji: "🛰️",
    status: "locked",
    reward: "🤖 Núcleo Digital",
    requirement: "Completa el Templo de las Lenguas",
    x: 78,
    y: 50,
    order: 6,
    subject: "Tecnología y Digitalización · ESO",
    theme: "Código, datos e inteligencia artificial",
    future: true,
    plannedMinigames: [
      { name: "Debug del Robot", kind: "puzzle", concept: "Depuración de errores" },
      { name: "Laberinto de Código", kind: "puzzle", concept: "Lógica de programación" },
      { name: "Redes de Datos", kind: "arena", concept: "Redes y datos" },
      { name: "Entrenamiento de IA", kind: "duelo", concept: "Conceptos de IA" },
      { name: "El Bug Supremo", kind: "boss", concept: "Repaso de Tecnología" },
    ],
  },
  {
    id: "fortaleza-vacio",
    name: "Fortaleza del Vacío",
    tagline: "El desafío final",
    emoji: "🌑",
    status: "locked",
    reward: "👑 Corona de Guardián",
    requirement: "Completa todos los mundos",
    x: 86,
    y: 24,
    order: 7,
    subject: "Prueba final · global",
    theme: "Desafío final del Nexus",
    future: true,
    plannedMinigames: [
      { name: "Repaso de Mundos", kind: "arena", concept: "Todas las materias" },
      { name: "Duelos Mixtos", kind: "duelo", concept: "Retos combinados" },
      { name: "Torneo de Ranking", kind: "cartas", concept: "Competición global" },
      { name: "Boss Rush", kind: "boss", concept: "Todos los bosses" },
      { name: "El Vacío Primordial", kind: "boss", concept: "Boss final del Nexus" },
    ],
  },
];

// ---- Learning content (subject: Biología · "La célula") ----
export type Concept = { id: string; term: string; definition: string };
export type Question = { id: string; prompt: string; options: string[]; answer: number; concept: string };

export const SUBJECT = { area: "Biología · ESO", topic: "La célula", difficulty: "Media" };

export const MOCK_CONCEPTS: Concept[] = [
  { id: "c1", term: "Célula", definition: "Unidad básica y funcional de todos los seres vivos." },
  { id: "c2", term: "Núcleo", definition: "Orgánulo que controla la célula y guarda el ADN." },
  { id: "c3", term: "Mitocondria", definition: "Orgánulo que produce la energía de la célula." },
  { id: "c4", term: "Membrana", definition: "Capa que rodea la célula y controla lo que entra y sale." },
  { id: "c5", term: "Citoplasma", definition: "Medio interno donde flotan los orgánulos." },
  { id: "c6", term: "ADN", definition: "Molécula que guarda la información genética." },
  { id: "c7", term: "Orgánulos", definition: "Estructuras con funciones específicas dentro de la célula." },
];

export const MOCK_QUESTIONS: Question[] = [
  { id: "q1", prompt: "¿Cuál es la unidad básica de todos los seres vivos?", options: ["La célula", "El átomo", "La molécula"], answer: 0, concept: "Célula" },
  { id: "q2", prompt: "¿Qué orgánulo produce la energía de la célula?", options: ["Núcleo", "Mitocondria", "Membrana"], answer: 1, concept: "Mitocondria" },
  { id: "q3", prompt: "¿Dónde se guarda el ADN de la célula?", options: ["En el citoplasma", "En la membrana", "En el núcleo"], answer: 2, concept: "Núcleo" },
  { id: "q4", prompt: "¿Qué controla lo que entra y sale de la célula?", options: ["La membrana", "El ADN", "La mitocondria"], answer: 0, concept: "Membrana" },
  { id: "q5", prompt: "El medio interno donde flotan los orgánulos es el...", options: ["Núcleo", "Citoplasma", "ADN"], answer: 1, concept: "Citoplasma" },
  { id: "q6", prompt: "¿Qué molécula guarda la información genética?", options: ["Proteína", "ARN", "ADN"], answer: 2, concept: "ADN" },
  { id: "q7", prompt: "Las estructuras con función propia dentro de la célula son los...", options: ["Orgánulos", "Tejidos", "Átomos"], answer: 0, concept: "Orgánulos" },
];

export const ANALYSIS_STEPS = [
  { label: "Escaneando documento", detail: "Nova está leyendo tus apuntes…" },
  { label: "Extrayendo conceptos", detail: "Detectando ideas clave y definiciones" },
  { label: "Generando retos", detail: "Creando preguntas, puzzles y duelos" },
  { label: "Forjando la misión", detail: "Construyendo tu aventura personalizada" },
];

// ---- Missions (Bosque del Descubrimiento) ----
export type Mission = {
  id: string;
  n: number;
  title: string;
  npc: string;
  npcEmoji: string;
  objective: string;
  concept: string;
  reward: string;
  route: "/reto/duelo" | "/reto/puzzle" | "/reto/cartas" | "/reto/arena" | "/reto/boss" | "/reto/puentes";
  kind: "duelo" | "puzzle" | "cartas" | "arena" | "boss";
};

export const BOSQUE_MISSIONS: Mission[] = [
  { id: "m1", n: 1, title: "Carrera de Portales", npc: "Guardián Lumen", npcEmoji: "🧝", objective: "Cruza los portales acertando preguntas rápidas.", concept: "Mitocondria y energía", reward: "+80 XP · 💎", route: "/reto/duelo", kind: "duelo" },
  { id: "m2", n: 2, title: "Puzzle de Cristales", npc: "Herrera Kira", npcEmoji: "🧑‍🔧", objective: "Empareja cada concepto con su definición.", concept: "Partes de la célula", reward: "+90 XP · 💎", route: "/reto/puzzle", kind: "puzzle" },
  { id: "m3", n: 3, title: "Duelo de Cartas", npc: "Mago Vex", npcEmoji: "🧙", objective: "Elige la carta-respuesta para atacar al rival.", concept: "Núcleo y ADN", reward: "+100 XP · 💎", route: "/reto/cartas", kind: "cartas" },
  { id: "m4", n: 4, title: "Arena de Oleadas", npc: "Capitán Ryo", npcEmoji: "🥷", objective: "Derrota oleadas de enemigos con la respuesta correcta.", concept: "Todos los conceptos", reward: "+120 XP · 💎", route: "/reto/arena", kind: "arena" },
  { id: "m5", n: 5, title: "Zumbra, el Vacío", npc: "Zumbra", npcEmoji: "👹", objective: "Vence al boss por fases y libera el Bosque.", concept: "Repaso general", reward: "+150 XP · 🎁", route: "/reto/boss", kind: "boss" },
];

// ---- Ciudad de los Algoritmos (Matemáticas · ESO) — expansión Fase 3 ----
// Misión 1: minijuego especial "Puentes de Ecuaciones". El resto reutilizan los
// minijuegos genéricos con banco de preguntas de Matemáticas.
export const ALGORITMOS_MISSIONS: Mission[] = [
  { id: "a1", n: 1, title: "Puentes de Ecuaciones", npc: "Ingeniera Ada", npcEmoji: "👷‍♀️", objective: "Despeja la incógnita y tiende el puente correcto sobre el abismo lógico.", concept: "Ecuaciones y despejes", reward: "+90 XP · 💎", route: "/reto/puentes", kind: "puzzle" },
  { id: "a2", n: 2, title: "Puzzle de Proporciones", npc: "Herrera Kira", npcEmoji: "🧑‍🔧", objective: "Empareja cada concepto matemático con su definición.", concept: "Proporciones y porcentajes", reward: "+95 XP · 💎", route: "/reto/puzzle", kind: "puzzle" },
  { id: "a3", n: 3, title: "Duelo de Cálculo", npc: "Mago Vex", npcEmoji: "🧙", objective: "Juega la carta con el resultado correcto para atacar.", concept: "Operaciones y geometría", reward: "+100 XP · 💎", route: "/reto/cartas", kind: "cartas" },
  { id: "a4", n: 4, title: "Arena de Incógnitas", npc: "Capitán Ryo", npcEmoji: "🥷", objective: "Derrota oleadas resolviendo problemas de Matemáticas.", concept: "Repaso de Matemáticas", reward: "+120 XP · 💎", route: "/reto/arena", kind: "arena" },
  { id: "a5", n: 5, title: "El Error Infinito", npc: "Error Infinito", npcEmoji: "🌀", objective: "Vence al boss lógico y restaura el Núcleo de la ciudad.", concept: "Repaso de Matemáticas", reward: "+150 XP · 🎁", route: "/reto/boss", kind: "boss" },
];

// Ecuaciones lineales sencillas de ESO para "Puentes de Ecuaciones".
export type EquationPuzzle = {
  id: string;
  equation: string; // p.ej. "2x + 3 = 11"
  options: string[]; // opciones de solución
  answer: number; // índice de la opción correcta
  solution: string; // solución en texto, p.ej. "x = 4"
};

export const ALGORITMOS_EQUATIONS: EquationPuzzle[] = [
  { id: "eq1", equation: "x + 5 = 12", options: ["x = 5", "x = 7", "x = 9"], answer: 1, solution: "x = 7" },
  { id: "eq2", equation: "2x = 18", options: ["x = 6", "x = 9", "x = 16"], answer: 1, solution: "x = 9" },
  { id: "eq3", equation: "3x + 3 = 12", options: ["x = 2", "x = 3", "x = 5"], answer: 1, solution: "x = 3" },
  { id: "eq4", equation: "x / 2 = 6", options: ["x = 3", "x = 8", "x = 12"], answer: 2, solution: "x = 12" },
  { id: "eq5", equation: "5x - 4 = 16", options: ["x = 3", "x = 4", "x = 6"], answer: 1, solution: "x = 4" },
];

// ---- Leaderboard ----
export type LeaderboardEntry = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  classId: string;
  points: number;
  level: number;
  streak: number;
  weeklyGain: number;
  accuracy: number;
  isPlayer?: boolean;
};

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { id: "l1", name: "NovaKiller", avatar: "🦸", color: "oklch(0.6 0.24 300)", classId: "estratega", points: 5240, level: 21, streak: 12, weeklyGain: 980, accuracy: 94 },
  { id: "l2", name: "PixelSofía", avatar: "🧙", color: "oklch(0.78 0.19 150)", classId: "sabio", points: 4880, level: 19, streak: 8, weeklyGain: 1240, accuracy: 91 },
  { id: "l3", name: "ByteHunter", avatar: "🤖", color: "oklch(0.62 0.2 190)", classId: "constructor", points: 4120, level: 17, streak: 5, weeklyGain: 640, accuracy: 88 },
  { id: "l4", name: "LucíaCrack", avatar: "👾", color: "oklch(0.82 0.16 85)", classId: "velocista", points: 3760, level: 15, streak: 15, weeklyGain: 1520, accuracy: 96 },
  { id: "l5", name: "MartínZ", avatar: "🥷", color: "oklch(0.68 0.19 250)", classId: "explorador", points: 3110, level: 13, streak: 3, weeklyGain: 420, accuracy: 82 },
  { id: "l6", name: "AreaNova", avatar: "🧑‍🚀", color: "oklch(0.55 0.2 330)", classId: "estratega", points: 2540, level: 11, streak: 6, weeklyGain: 760, accuracy: 85 },
  { id: "l7", name: "ZeroCrack", avatar: "🐉", color: "oklch(0.62 0.24 20)", classId: "velocista", points: 2210, level: 10, streak: 4, weeklyGain: 540, accuracy: 79 },
  { id: "l8", name: "MaiaStorm", avatar: "🦊", color: "oklch(0.78 0.16 60)", classId: "sabio", points: 1980, level: 9, streak: 7, weeklyGain: 690, accuracy: 87 },
  { id: "l9", name: "KenjiX", avatar: "🐺", color: "oklch(0.6 0.18 250)", classId: "explorador", points: 1560, level: 8, streak: 2, weeklyGain: 320, accuracy: 74 },
  { id: "l10", name: "InesRush", avatar: "🦁", color: "oklch(0.72 0.18 90)", classId: "constructor", points: 1240, level: 7, streak: 5, weeklyGain: 480, accuracy: 81 },
];

// ---- Achievements ----
export type Achievement = { id: string; name: string; desc: string; emoji: string; unlocked: boolean };

export const ACHIEVEMENTS: Achievement[] = [
  { id: "a1", name: "Primer Portal", desc: "Completa tu primer reto", emoji: "🌀", unlocked: false },
  { id: "a2", name: "Racha x5", desc: "Consigue una racha de 5 aciertos", emoji: "🔥", unlocked: false },
  { id: "a3", name: "Cazador de Cristales", desc: "Reúne 100 cristales", emoji: "💎", unlocked: false },
  { id: "a4", name: "Zumbra Caída", desc: "Derrota a Zumbra", emoji: "👑", unlocked: false },
  { id: "a5", name: "Mente Brillante", desc: "Acierta un reto perfecto", emoji: "🧠", unlocked: false },
  { id: "a6", name: "Aspirante Constante", desc: "Alcanza el nivel 5", emoji: "⭐", unlocked: false },
];

// ---- Concept matching pairs for the puzzle ----
export const PUZZLE_PAIRS = MOCK_CONCEPTS.slice(0, 4);

// ============================================================================
// Fase 3 — Contenido demo por materia para los mundos restantes del Nexus.
// Todo es contenido demo de entrenamiento (sin IA real). Cada mundo aporta un
// banco de preguntas y parejas concepto/definición reutilizadas por los
// minijuegos genéricos (duelo, cartas, arena, boss, puzzle).
// ============================================================================

// ---- Matemáticas · Ciudad de los Algoritmos ----
export const MATH_CONCEPTS: Concept[] = [
  { id: "mc1", term: "Ecuación", definition: "Igualdad con una incógnita que hay que despejar." },
  { id: "mc2", term: "Porcentaje", definition: "Proporción calculada sobre 100." },
  { id: "mc3", term: "Área", definition: "Medida de la superficie de una figura." },
  { id: "mc4", term: "Perímetro", definition: "Suma de todos los lados de una figura." },
];

export const MATH_QUESTIONS: Question[] = [
  { id: "mq1", prompt: "¿Cuánto es el 25% de 80?", options: ["15", "20", "25"], answer: 1, concept: "Porcentajes" },
  { id: "mq2", prompt: "Resuelve: x + 6 = 15", options: ["x = 6", "x = 9", "x = 21"], answer: 1, concept: "Ecuaciones" },
  { id: "mq3", prompt: "Área de un rectángulo de 5 × 4:", options: ["9", "20", "18"], answer: 1, concept: "Áreas" },
  { id: "mq4", prompt: "Perímetro de un cuadrado de lado 7:", options: ["14", "28", "49"], answer: 1, concept: "Perímetro" },
  { id: "mq5", prompt: "¿Cuánto es 3 elevado al cuadrado?", options: ["6", "9", "12"], answer: 1, concept: "Potencias" },
  { id: "mq6", prompt: "Resuelve: 2x = 14", options: ["x = 6", "x = 7", "x = 12"], answer: 1, concept: "Ecuaciones" },
  { id: "mq7", prompt: "¿Qué fracción equivale a 0,5?", options: ["1/2", "1/3", "1/4"], answer: 0, concept: "Fracciones" },
];

// ---- Geografía e Historia · Biblioteca de las Crónicas ----
export const HIST_CONCEPTS: Concept[] = [
  { id: "hc1", term: "Prehistoria", definition: "Etapa anterior a la invención de la escritura." },
  { id: "hc2", term: "Edad Antigua", definition: "Etapa de las primeras grandes civilizaciones y del Imperio romano." },
  { id: "hc3", term: "Edad Media", definition: "Etapa entre la caída de Roma y el descubrimiento de América." },
  { id: "hc4", term: "Fuente histórica", definition: "Documento u objeto que aporta información del pasado." },
];

export const HIST_QUESTIONS: Question[] = [
  { id: "hq1", prompt: "¿Qué invento marca el fin de la Prehistoria?", options: ["La rueda", "La escritura", "El fuego"], answer: 1, concept: "Prehistoria" },
  { id: "hq2", prompt: "La Edad Media termina con...", options: ["La caída de Roma", "El descubrimiento de América", "La Revolución Francesa"], answer: 1, concept: "Edad Media" },
  { id: "hq3", prompt: "¿Qué civilización construyó las pirámides de Guiza?", options: ["Grecia", "Egipto", "Roma"], answer: 1, concept: "Edad Antigua" },
  { id: "hq4", prompt: "Una vasija encontrada en una excavación es una...", options: ["Fuente histórica", "Leyenda", "Hipótesis"], answer: 0, concept: "Fuente histórica" },
  { id: "hq5", prompt: "¿En qué continente surgió la civilización romana?", options: ["Asia", "Europa", "América"], answer: 1, concept: "Edad Antigua" },
  { id: "hq6", prompt: "La línea que ordena hechos por fecha se llama...", options: ["Mapa", "Eje cronológico", "Brújula"], answer: 1, concept: "Cronología" },
  { id: "hq7", prompt: "¿Qué río fue clave para la civilización egipcia?", options: ["El Nilo", "El Tíber", "El Ebro"], answer: 0, concept: "Edad Antigua" },
];

// ---- Física y Química · Laboratorio Nexus ----
export const PHYS_CONCEPTS: Concept[] = [
  { id: "fc1", term: "Fuerza", definition: "Interacción capaz de cambiar el movimiento de un cuerpo." },
  { id: "fc2", term: "Energía", definition: "Capacidad de un cuerpo para producir cambios o trabajo." },
  { id: "fc3", term: "Átomo", definition: "Unidad más pequeña de un elemento químico." },
  { id: "fc4", term: "Mezcla", definition: "Unión de sustancias que conservan sus propiedades." },
];

export const PHYS_QUESTIONS: Question[] = [
  { id: "fq1", prompt: "¿En qué unidad se mide la fuerza?", options: ["Julios", "Newtons", "Vatios"], answer: 1, concept: "Fuerza" },
  { id: "fq2", prompt: "La energía del movimiento se llama energía...", options: ["Cinética", "Química", "Nuclear"], answer: 0, concept: "Energía" },
  { id: "fq3", prompt: "La partícula con carga negativa del átomo es el...", options: ["Protón", "Electrón", "Neutrón"], answer: 1, concept: "Átomo" },
  { id: "fq4", prompt: "El agua con sal es un ejemplo de...", options: ["Elemento", "Compuesto", "Mezcla"], answer: 2, concept: "Mezcla" },
  { id: "fq5", prompt: "¿Qué estado de la materia tiene forma y volumen fijos?", options: ["Sólido", "Líquido", "Gas"], answer: 0, concept: "Estados de la materia" },
  { id: "fq6", prompt: "La unidad de energía en el SI es el...", options: ["Newton", "Julio", "Amperio"], answer: 1, concept: "Energía" },
  { id: "fq7", prompt: "El símbolo químico del oxígeno es...", options: ["O", "Ox", "Og"], answer: 0, concept: "Elementos" },
];

// ---- Lengua y Comunicación · Templo de las Lenguas ----
export const LANG_CONCEPTS: Concept[] = [
  { id: "lc1", term: "Sustantivo", definition: "Palabra que nombra personas, animales, cosas o ideas." },
  { id: "lc2", term: "Verbo", definition: "Palabra que expresa acciones, estados o procesos." },
  { id: "lc3", term: "Sinónimo", definition: "Palabra con significado igual o parecido a otra." },
  { id: "lc4", term: "Metáfora", definition: "Recurso que identifica una cosa con otra por semejanza." },
];

export const LANG_QUESTIONS: Question[] = [
  { id: "lq1", prompt: "¿Qué palabra es un verbo?", options: ["Correr", "Mesa", "Azul"], answer: 0, concept: "Verbo" },
  { id: "lq2", prompt: "Un sinónimo de 'contento' es...", options: ["Triste", "Feliz", "Cansado"], answer: 1, concept: "Sinónimo" },
  { id: "lq3", prompt: "'Casa' es un...", options: ["Verbo", "Sustantivo", "Adjetivo"], answer: 1, concept: "Sustantivo" },
  { id: "lq4", prompt: "'Sus ojos son dos luceros' es una...", options: ["Rima", "Metáfora", "Sílaba"], answer: 1, concept: "Metáfora" },
  { id: "lq5", prompt: "El antónimo de 'grande' es...", options: ["Enorme", "Pequeño", "Ancho"], answer: 1, concept: "Antónimo" },
  { id: "lq6", prompt: "¿Cuántas sílabas tiene 'ventana'?", options: ["Dos", "Tres", "Cuatro"], answer: 1, concept: "Sílaba" },
  { id: "lq7", prompt: "La palabra que describe al sustantivo es el...", options: ["Adjetivo", "Adverbio", "Artículo"], answer: 0, concept: "Adjetivo" },
];

// ---- Tecnología y Digitalización · Observatorio Cuántico ----
export const TECH_CONCEPTS: Concept[] = [
  { id: "tc1", term: "Algoritmo", definition: "Serie ordenada de pasos para resolver un problema." },
  { id: "tc2", term: "Bug", definition: "Error en un programa que provoca un fallo." },
  { id: "tc3", term: "Bit", definition: "Unidad mínima de información: un 0 o un 1." },
  { id: "tc4", term: "Red", definition: "Conjunto de dispositivos conectados que comparten datos." },
];

export const TECH_QUESTIONS: Question[] = [
  { id: "tq1", prompt: "Un conjunto ordenado de pasos para resolver algo es un...", options: ["Bit", "Algoritmo", "Píxel"], answer: 1, concept: "Algoritmo" },
  { id: "tq2", prompt: "Un error en el código se llama...", options: ["Bug", "Byte", "Link"], answer: 0, concept: "Bug" },
  { id: "tq3", prompt: "La unidad mínima de información es el...", options: ["Bit", "Watt", "Hz"], answer: 0, concept: "Bit" },
  { id: "tq4", prompt: "Un grupo de dispositivos conectados forma una...", options: ["App", "Red", "Web"], answer: 1, concept: "Red" },
  { id: "tq5", prompt: "8 bits equivalen a un...", options: ["Byte", "Megabit", "Hertzio"], answer: 0, concept: "Datos" },
  { id: "tq6", prompt: "El lenguaje que entiende directamente el ordenador es el...", options: ["Binario", "Español", "HTML"], answer: 0, concept: "Bit" },
  { id: "tq7", prompt: "Repetir instrucciones en programación es un...", options: ["Bucle", "Píxel", "Cable"], answer: 0, concept: "Algoritmo" },
];

// ---- Repaso final · Fortaleza del Vacío (mezcla de todas las materias) ----
export const FINAL_CONCEPTS: Concept[] = [
  { id: "vc1", term: "Célula", definition: "Unidad básica de los seres vivos." },
  { id: "vc2", term: "Ecuación", definition: "Igualdad matemática con una incógnita." },
  { id: "vc3", term: "Energía", definition: "Capacidad de producir cambios o trabajo." },
  { id: "vc4", term: "Algoritmo", definition: "Pasos ordenados para resolver un problema." },
];

export const FINAL_QUESTIONS: Question[] = [
  { id: "vq1", prompt: "¿Qué orgánulo produce la energía de la célula?", options: ["Núcleo", "Mitocondria", "Membrana"], answer: 1, concept: "Biología" },
  { id: "vq2", prompt: "Resuelve: x - 5 = 10", options: ["x = 5", "x = 15", "x = 50"], answer: 1, concept: "Matemáticas" },
  { id: "vq3", prompt: "La Edad Media termina con el descubrimiento de...", options: ["América", "el fuego", "la rueda"], answer: 0, concept: "Historia" },
  { id: "vq4", prompt: "¿En qué unidad se mide la fuerza?", options: ["Julios", "Newtons", "Vatios"], answer: 1, concept: "Física" },
  { id: "vq5", prompt: "'Saltar' es un...", options: ["Sustantivo", "Verbo", "Adjetivo"], answer: 1, concept: "Lengua" },
  { id: "vq6", prompt: "Un error en un programa es un...", options: ["Bug", "Bit", "Byte"], answer: 0, concept: "Tecnología" },
  { id: "vq7", prompt: "La unidad básica de los seres vivos es la...", options: ["Molécula", "Célula", "Átomo"], answer: 1, concept: "Biología" },
];

// ---- Misiones de los mundos restantes (4 retos + jefe cada uno) ----
export const CRONICAS_MISSIONS: Mission[] = [
  { id: "h1", n: 1, title: "Puzzle de las Eras", npc: "Cronista Elda", npcEmoji: "🧕", objective: "Empareja cada etapa histórica con su definición.", concept: "Etapas de la Historia", reward: "+90 XP · 💎", route: "/reto/puzzle", kind: "puzzle" },
  { id: "h2", n: 2, title: "Archivo de Fuentes", npc: "Bibliotecario Orin", npcEmoji: "🧑‍🏫", objective: "Juega la carta correcta para descifrar cada crónica.", concept: "Fuentes históricas", reward: "+95 XP · 💎", route: "/reto/cartas", kind: "cartas" },
  { id: "h3", n: 3, title: "Carrera del Tiempo", npc: "Mensajera Nel", npcEmoji: "🏃‍♀️", objective: "Cruza los portales ordenando los hechos históricos.", concept: "Cronología", reward: "+100 XP · 💎", route: "/reto/duelo", kind: "duelo" },
  { id: "h4", n: 4, title: "Consejo de Causas", npc: "Sabia Mora", npcEmoji: "👳‍♀️", objective: "Resiste oleadas de preguntas de Historia.", concept: "Repaso de Historia", reward: "+120 XP · 💎", route: "/reto/arena", kind: "arena" },
  { id: "h5", n: 5, title: "El Olvido", npc: "El Olvido", npcEmoji: "🕯️", objective: "Vence al boss del olvido y recupera las crónicas perdidas.", concept: "Repaso de Historia", reward: "+150 XP · 🎁", route: "/reto/boss", kind: "boss" },
];

export const LABORATORIO_MISSIONS: Mission[] = [
  { id: "f1", n: 1, title: "Circuitos de Energía", npc: "Doctora Ío", npcEmoji: "👩‍🔬", objective: "Cruza los portales acertando sobre fuerzas y energía.", concept: "Fuerzas y energía", reward: "+90 XP · 💎", route: "/reto/duelo", kind: "duelo" },
  { id: "f2", n: 2, title: "Mezcla de Elementos", npc: "Alquimista Ren", npcEmoji: "🧑‍🔬", objective: "Empareja cada concepto de química con su definición.", concept: "Materia y mezclas", reward: "+95 XP · 💎", route: "/reto/puzzle", kind: "puzzle" },
  { id: "f3", n: 3, title: "Reactor de Fórmulas", npc: "Ingeniero Tan", npcEmoji: "👨‍🔧", objective: "Juega la carta con la reacción correcta.", concept: "Reacciones y átomos", reward: "+100 XP · 💎", route: "/reto/cartas", kind: "cartas" },
  { id: "f4", n: 4, title: "Equilibrio de Fuerzas", npc: "Capitana Vela", npcEmoji: "🧑‍🚀", objective: "Resiste oleadas de problemas de Física y Química.", concept: "Repaso de Física y Química", reward: "+120 XP · 💎", route: "/reto/arena", kind: "arena" },
  { id: "f5", n: 5, title: "La Reacción Caótica", npc: "Reacción Caótica", npcEmoji: "☢️", objective: "Vence al boss inestable y estabiliza el laboratorio.", concept: "Repaso de Física y Química", reward: "+150 XP · 🎁", route: "/reto/boss", kind: "boss" },
];

export const LENGUAS_MISSIONS: Mission[] = [
  { id: "l1", n: 1, title: "Duelo de Palabras", npc: "Bardo Lío", npcEmoji: "🧑‍🎤", objective: "Juega la carta con la palabra correcta.", concept: "Sustantivos y verbos", reward: "+90 XP · 💎", route: "/reto/cartas", kind: "cartas" },
  { id: "l2", n: 2, title: "Puertas de Vocabulario", npc: "Guardiana Sira", npcEmoji: "🧝‍♀️", objective: "Empareja cada término con su significado.", concept: "Vocabulario y léxico", reward: "+95 XP · 💎", route: "/reto/puzzle", kind: "puzzle" },
  { id: "l3", n: 3, title: "Carrera de Lectura", npc: "Mensajero Uri", npcEmoji: "📯", objective: "Cruza los portales comprendiendo cada frase.", concept: "Comprensión lectora", reward: "+100 XP · 💎", route: "/reto/duelo", kind: "duelo" },
  { id: "l4", n: 4, title: "Hechizos de Léxico", npc: "Maga Ela", npcEmoji: "🧙‍♀️", objective: "Resiste oleadas de preguntas de Lengua.", concept: "Repaso de Lengua", reward: "+120 XP · 💎", route: "/reto/arena", kind: "arena" },
  { id: "l5", n: 5, title: "La Torre de Babel", npc: "Torre de Babel", npcEmoji: "🗼", objective: "Vence al boss del silencio y libera la palabra.", concept: "Repaso de Lengua", reward: "+150 XP · 🎁", route: "/reto/boss", kind: "boss" },
];

export const OBSERVATORIO_MISSIONS: Mission[] = [
  { id: "t1", n: 1, title: "Debug del Robot", npc: "Técnica Nix", npcEmoji: "👩‍💻", objective: "Cruza los portales corrigiendo el código.", concept: "Depuración y algoritmos", reward: "+90 XP · 💎", route: "/reto/duelo", kind: "duelo" },
  { id: "t2", n: 2, title: "Redes de Datos", npc: "Analista Beo", npcEmoji: "🧑‍💻", objective: "Empareja cada concepto digital con su definición.", concept: "Datos y redes", reward: "+95 XP · 💎", route: "/reto/puzzle", kind: "puzzle" },
  { id: "t3", n: 3, title: "Entrenamiento de IA", npc: "Dron Zeta", npcEmoji: "🤖", objective: "Juega la carta con la instrucción correcta.", concept: "Lógica de programación", reward: "+100 XP · 💎", route: "/reto/cartas", kind: "cartas" },
  { id: "t4", n: 4, title: "Laberinto de Código", npc: "Guía Pix", npcEmoji: "🕹️", objective: "Resiste oleadas de preguntas de Tecnología.", concept: "Repaso de Tecnología", reward: "+120 XP · 💎", route: "/reto/arena", kind: "arena" },
  { id: "t5", n: 5, title: "El Bug Supremo", npc: "Bug Supremo", npcEmoji: "🐞", objective: "Vence al boss corrupto y depura el observatorio.", concept: "Repaso de Tecnología", reward: "+150 XP · 🎁", route: "/reto/boss", kind: "boss" },
];

export const FORTALEZA_MISSIONS: Mission[] = [
  { id: "v1", n: 1, title: "Arena de los Mundos", npc: "Eco de Nova", npcEmoji: "🌟", objective: "Resiste oleadas con preguntas de todas las materias.", concept: "Repaso global", reward: "+110 XP · 💎", route: "/reto/arena", kind: "arena" },
  { id: "v2", n: 2, title: "Duelos Mixtos", npc: "Guardián Final", npcEmoji: "🛡️", objective: "Juega la carta correcta en retos combinados.", concept: "Repaso global", reward: "+120 XP · 💎", route: "/reto/cartas", kind: "cartas" },
  { id: "v3", n: 3, title: "Carrera Definitiva", npc: "Heraldo del Nexus", npcEmoji: "🏁", objective: "Cruza los portales del desafío final.", concept: "Repaso global", reward: "+130 XP · 💎", route: "/reto/duelo", kind: "duelo" },
  { id: "v4", n: 4, title: "Sellos del Saber", npc: "Custodia Aurora", npcEmoji: "🔑", objective: "Empareja los conceptos clave de cada mundo.", concept: "Repaso global", reward: "+140 XP · 💎", route: "/reto/puzzle", kind: "puzzle" },
  { id: "v5", n: 5, title: "El Vacío Primordial", npc: "Vacío Primordial", npcEmoji: "🌑", objective: "Enfréntate al boss final del Nexus y sella el Vacío.", concept: "Repaso global del Nexus", reward: "+200 XP · 👑", route: "/reto/boss", kind: "boss" },
];

// ---- Contenido educativo por mundo (para los minijuegos genéricos) ----
export type WorldContent = { concepts: Concept[]; questions: Question[]; pairs: Concept[] };

export const WORLD_CONTENT: Record<string, WorldContent> = {
  bosque: { concepts: MOCK_CONCEPTS, questions: MOCK_QUESTIONS, pairs: PUZZLE_PAIRS },
  algoritmos: { concepts: MATH_CONCEPTS, questions: MATH_QUESTIONS, pairs: MATH_CONCEPTS },
  cronicas: { concepts: HIST_CONCEPTS, questions: HIST_QUESTIONS, pairs: HIST_CONCEPTS },
  laboratorio: { concepts: PHYS_CONCEPTS, questions: PHYS_QUESTIONS, pairs: PHYS_CONCEPTS },
  lenguas: { concepts: LANG_CONCEPTS, questions: LANG_QUESTIONS, pairs: LANG_CONCEPTS },
  observatorio: { concepts: TECH_CONCEPTS, questions: TECH_QUESTIONS, pairs: TECH_CONCEPTS },
  "fortaleza-vacio": { concepts: FINAL_CONCEPTS, questions: FINAL_QUESTIONS, pairs: FINAL_CONCEPTS },
};
