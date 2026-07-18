// Services layer: the ONLY place the UI reads game data from.
//
// Today it returns mock data from `@/data/game`. When Supabase + AI are
// connected, swap the bodies here (e.g. supabase.from(...).select() or an edge
// function) and the UI stays untouched. Routes and components MUST import game
// data through this module, never directly from `@/data/game`.
//
// Selectors are synchronous today because the mock data lives in memory; this
// keeps the current UX (no loading flicker) identical. The async
// analyzeDocument / generateAdventure below are prepared entry points for the
// future AI integration and are intentionally not wired into the flow yet.

import {
  MOCK_CONCEPTS,
  MOCK_QUESTIONS,
  MOCK_LEADERBOARD,
  BOSQUE_MISSIONS,
  ALGORITMOS_MISSIONS,
  ALGORITMOS_EQUATIONS,
  CRONICAS_MISSIONS,
  LABORATORIO_MISSIONS,
  LENGUAS_MISSIONS,
  OBSERVATORIO_MISSIONS,
  FORTALEZA_MISSIONS,
  WORLD_CONTENT,
  WORLDS,
  PUZZLE_PAIRS,
  ACHIEVEMENTS,
  ANALYSIS_STEPS,
  SUBJECT,
  PLAYER_CLASSES,
  COMPANIONS,
  LEAGUES,
  AVATAR_COLORS,
  AVATAR_HAIR,
  AVATAR_OUTFITS,
  AVATAR_EMBLEM,
  classById,
  leagueForPoints,
  levelForXp,
  xpIntoLevel,
  type Concept,
  type Question,
  type LeaderboardEntry,
  type Mission,
  type World,
  type PlayerClass,
  type Companion,
  type Achievement,
  type AvatarItem,
  type EquationPuzzle,
} from "@/data/game";

// Missions grouped by world (all worlds are playable demo content in Fase 3).
const MISSIONS_BY_WORLD: Record<string, Mission[]> = {
  bosque: BOSQUE_MISSIONS,
  algoritmos: ALGORITMOS_MISSIONS,
  cronicas: CRONICAS_MISSIONS,
  laboratorio: LABORATORIO_MISSIONS,
  lenguas: LENGUAS_MISSIONS,
  observatorio: OBSERVATORIO_MISSIONS,
  "fortaleza-vacio": FORTALEZA_MISSIONS,
};

// All playable missions across every world.
const ALL_MISSIONS: Mission[] = Object.values(MISSIONS_BY_WORLD).flat();
// Worlds that are actually playable right now (have implemented minigames).
// Order defines the sequential unlock chain (each unlocks after the previous).
const PLAYABLE_WORLD_IDS = [
  "bosque",
  "algoritmos",
  "cronicas",
  "laboratorio",
  "lenguas",
  "observatorio",
  "fortaleza-vacio",
] as const;

// Re-export shared types & pure helpers so the UI never has to reach into
// `@/data/game` directly.
export type {
  Concept,
  Question,
  LeaderboardEntry,
  Mission,
  World,
  PlayerClass,
  Companion,
  Achievement,
  AvatarItem,
  PlannedMinigame,
  LeagueId,
  EquationPuzzle,
} from "@/data/game";
export { leagueForPoints, levelForXp, xpIntoLevel };

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Worlds ----
export function getWorlds(): World[] {
  return WORLDS;
}

export function getWorldById(worldId: string): World | undefined {
  return WORLDS.find((w) => w.id === worldId);
}

// ---- Missions ----
export function getMissions(worldId: string): Mission[] {
  return MISSIONS_BY_WORLD[worldId] ?? [];
}

export function getMissionById(missionId: string): Mission | undefined {
  return ALL_MISSIONS.find((m) => m.id === missionId);
}

/** Which world a given mission belongs to (defaults to bosque if unknown). */
function worldOfMissionId(missionId: string): string {
  for (const [worldId, missions] of Object.entries(MISSIONS_BY_WORLD)) {
    if (missions.some((m) => m.id === missionId)) return worldId;
  }
  return "bosque";
}

/** Public accessor: the world a mission belongs to (for finish/boss handling). */
export function getWorldOfMission(missionId: string): string {
  return worldOfMissionId(missionId);
}

// ---- Progression (derived state, never hardcoded flags) ----
// Progress is derived from the player's `missionsCleared` / `worldsCleared`
// so the map + mission list always reflect real advancement. This is the
// single source of truth for gating; routes/components must not re-derive it.

export type MissionStatus = "available" | "locked" | "completed";
export type WorldProgressStatus = "current" | "locked" | "completed" | "coming_soon_unlocked";

export type MissionWithStatus = Mission & { status: MissionStatus };
export type WorldWithProgress = World & {
  progressStatus: WorldProgressStatus;
  done: number;
  total: number;
  unlockHint: string;
  playable: boolean;
};

type PlayerProgress = { worldsCleared: string[]; missionsCleared: string[] };

/**
 * Missions of a world with their derived status.
 * - completed: mission id is in `missionsCleared`.
 * - available: not completed AND every previous mission is completed.
 * - locked: a previous mission is still pending.
 * The boss is the last mission, so it becomes available only when all four
 * previous missions are completed.
 */
export function getMissionsWithStatus(worldId: string, missionsCleared: string[]): MissionWithStatus[] {
  const missions = getMissions(worldId);
  return missions.map((m, i) => {
    const cleared = missionsCleared.includes(m.id);
    const prevAllDone = missions.slice(0, i).every((p) => missionsCleared.includes(p.id));
    const status: MissionStatus = cleared ? "completed" : prevAllDone ? "available" : "locked";
    return { ...m, status };
  });
}

export function getMissionStatus(missionId: string, missionsCleared: string[]): MissionStatus {
  const worldId = worldOfMissionId(missionId);
  return getMissionsWithStatus(worldId, missionsCleared).find((m) => m.id === missionId)?.status ?? "locked";
}

export function canAccessMission(missionId: string, missionsCleared: string[]): boolean {
  return getMissionStatus(missionId, missionsCleared) !== "locked";
}

/** All missions of a world completed → the world is cleared. */
function isWorldCompleted(worldId: string, missionsCleared: string[]): boolean {
  const missions = getMissions(worldId);
  return missions.length > 0 && missions.every((m) => missionsCleared.includes(m.id));
}

/**
 * Sequential unlock chain: the first world is always open; every later world
 * unlocks once the previous world in `PLAYABLE_WORLD_IDS` is fully completed.
 */
function isWorldUnlocked(worldId: string, missionsCleared: string[]): boolean {
  const idx = PLAYABLE_WORLD_IDS.indexOf(worldId as (typeof PLAYABLE_WORLD_IDS)[number]);
  if (idx <= 0) return idx === 0; // first world open; unknown worlds locked
  return isWorldCompleted(PLAYABLE_WORLD_IDS[idx - 1], missionsCleared);
}

/**
 * Whether a challenge can be entered given current progress. When a specific
 * `missionId` is provided (via the `?m=` search param) gating is resolved for
 * that mission; otherwise it falls back to the first mission on the route so
 * legacy links keep working. Checks both that the world is unlocked AND that the
 * mission is not gated behind a previous one — enforced on direct URL access.
 */
export function canAccessChallenge(route: string, player: PlayerProgress, missionId?: string): boolean {
  const m = missionId
    ? ALL_MISSIONS.find((mm) => mm.id === missionId)
    : ALL_MISSIONS.find((mm) => mm.route === route);
  if (!m) return true; // unknown/ungated route: don't block
  const worldId = worldOfMissionId(m.id);
  if (!isWorldUnlocked(worldId, player.missionsCleared)) return false;
  return canAccessMission(m.id, player.missionsCleared);
}

/** The world a given challenge belongs to (for guard redirects). */
export function worldOfChallenge(route: string, missionId?: string): string {
  const m = missionId
    ? ALL_MISSIONS.find((mm) => mm.id === missionId)
    : ALL_MISSIONS.find((mm) => mm.route === route);
  return m ? worldOfMissionId(m.id) : "bosque";
}

/** Worlds with their derived progression status for the map. */
export function getWorldsWithProgress(player: PlayerProgress): WorldWithProgress[] {
  const { missionsCleared } = player;
  return WORLDS.map((w) => {
    const playable = (PLAYABLE_WORLD_IDS as readonly string[]).includes(w.id);
    if (!playable) {
      return { ...w, progressStatus: "locked", done: 0, total: 0, playable: false, unlockHint: w.requirement };
    }
    const unlocked = isWorldUnlocked(w.id, missionsCleared);
    const missions = getMissions(w.id);
    const total = missions.length;
    const done = missions.filter((m) => missionsCleared.includes(m.id)).length;
    const completed = unlocked && total > 0 && done >= total;
    const idx = PLAYABLE_WORLD_IDS.indexOf(w.id as (typeof PLAYABLE_WORLD_IDS)[number]);
    const prevName = idx > 0 ? WORLDS.find((x) => x.id === PLAYABLE_WORLD_IDS[idx - 1])?.name : undefined;
    const progressStatus: WorldProgressStatus = !unlocked ? "locked" : completed ? "completed" : "current";
    const unlockHint = !unlocked
      ? prevName
        ? `Completa ${prevName}`
        : w.requirement
      : completed
        ? "¡Núcleo restaurado!"
        : `Completa las ${total} misiones`;
    return {
      ...w,
      progressStatus,
      done: unlocked ? done : 0,
      total: unlocked ? total : 0,
      playable: true,
      unlockHint,
    };
  });
}


export function getWorldProgress(worldId: string, player: PlayerProgress): WorldWithProgress | undefined {
  return getWorldsWithProgress(player).find((w) => w.id === worldId);
}

// ---- Learning content ----
export function getQuestions(): Question[] {
  return MOCK_QUESTIONS;
}

export function getConcepts(): Concept[] {
  return MOCK_CONCEPTS;
}

export function getPuzzlePairs(): Concept[] {
  return PUZZLE_PAIRS;
}

// Ecuaciones de "Puentes de Ecuaciones" (Ciudad de los Algoritmos).
export function getAlgoritmosEquations(): EquationPuzzle[] {
  return ALGORITMOS_EQUATIONS;
}

// ---- Per-mission content (drives the generic minigames across worlds) ----
export type MissionContent = {
  worldId: string;
  mission?: Mission;
  questions: Question[];
  pairs: Concept[];
  concept: string;
  title?: string;
};

/**
 * Content for a challenge, resolved from its mission (`?m=` param). The generic
 * minigames (duelo/puzzle/cartas/arena/boss) read their question bank and puzzle
 * pairs from here so the same route serves every world. Falls back to the
 * Bosque (Biología) demo when no mission id is provided.
 */
export function getMissionContent(missionId?: string): MissionContent {
  const mission = missionId ? getMissionById(missionId) : undefined;
  const worldId = mission ? worldOfMissionId(mission.id) : "bosque";
  const content = WORLD_CONTENT[worldId] ?? WORLD_CONTENT.bosque;
  return {
    worldId,
    mission,
    questions: content.questions,
    pairs: content.pairs.slice(0, 4),
    concept: mission?.concept ?? SUBJECT.topic,
    title: mission?.title,
  };
}

export function getSubject() {
  return SUBJECT;
}

export function getAnalysisSteps() {
  return ANALYSIS_STEPS;
}

// ---- Ranking ----
export function getLeaderboard(): LeaderboardEntry[] {
  return MOCK_LEADERBOARD;
}

export type RemoteScore = {
  user_id: string;
  name: string;
  class_id: string | null;
  points: number;
  xp: number;
};

/**
 * Real ranking from the Cloud (`public_scores`). Ordered by points then XP.
 * Returns [] on error so the UI can still render the local player.
 */
export async function fetchLeaderboard(limit = 100): Promise<RemoteScore[]> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase
    .from("public_scores")
    .select("user_id, name, class_id, points, xp")
    .order("points", { ascending: false })
    .order("xp", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[gameService] fetchLeaderboard failed", error.message);
    return [];
  }
  return data ?? [];
}

export function getLeagues() {
  return LEAGUES;
}

// ---- Progression meta ----
export function getAchievements(): Achievement[] {
  return ACHIEVEMENTS;
}

// ---- Avatar / classes ----
export function getPlayerClasses(): PlayerClass[] {
  return PLAYER_CLASSES;
}

export function getClassById(id: string): PlayerClass {
  return classById(id);
}

export function getCompanions(): Companion[] {
  return COMPANIONS;
}

export function getAvatarOptions(): {
  colors: { id: string; label: string; value: string }[];
  hair: AvatarItem[];
  outfits: { id: string; label: string; value: string }[];
  emblem: AvatarItem[];
} {
  return {
    colors: AVATAR_COLORS,
    hair: AVATAR_HAIR,
    outfits: AVATAR_OUTFITS,
    emblem: AVATAR_EMBLEM,
  };
}

// ---- Demo library ----
// Todos los documentos de ejemplo pertenecen a la demo de Biología · "La célula".
// No hay otras materias porque el contenido generado siempre es esta demo.
const SAMPLE_DOCS = [
  "Biología ESO · La célula.pdf",
  "Orgánulos celulares.docx",
  "Membrana plasmática y transporte.txt",
  "Resumen de célula animal y vegetal.pdf",
];

export function getSampleDocuments(): string[] {
  return SAMPLE_DOCS;
}

// ---- Prepared AI hooks (mock, not wired into the flow yet) ----
/** Simulated document analysis. NOTE: this is a mock, no real AI runs here. */
export async function analyzeDocument(_docName: string): Promise<{
  concepts: Concept[];
  questions: Question[];
}> {
  await delay(200);
  return { concepts: MOCK_CONCEPTS, questions: MOCK_QUESTIONS };
}

/** Simulated adventure generation for a given document. Mock, no AI yet. */
export async function generateAdventure(_documentId: string): Promise<{
  worldId: string;
  concepts: Concept[];
  missions: Mission[];
}> {
  await delay(200);
  return { worldId: "bosque", concepts: MOCK_CONCEPTS, missions: BOSQUE_MISSIONS };
}
