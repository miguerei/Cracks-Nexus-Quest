import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import {
  ACHIEVEMENTS,
  leagueForPoints,
  levelForXp,
  type LeagueId,
} from "@/data/game";

export type PlayerAvatar = {
  name: string;
  classId: string; // player class
  base: string; // emoji (derived from class)
  color: string; // oklch principal color
  hair: string; // emoji or ""
  outfit: string; // oklch secondary color for the disc
  emblem: string; // emoji or ""
  companion: string; // companion id
};

export type MissionAttempt = {
  id: string;
  game: string;
  correct: number;
  total: number;
  xp: number;
  date: string;
};

/**
 * Snapshot of the last reward that was actually applied to the player.
 * The /recompensa screen only displays this — it never re-applies rewards,
 * so a page reload or a shared link shows the same result without duplicating
 * XP, crystals, coins, points or Nexos.
 */
export type LastReward = {
  id: string;
  game: string;
  correct: number;
  total: number;
  accuracy: number;
  perfect: boolean;
  xp: number;
  crystals: number;
  coins: number;
  points: number;
  nexos: number;
  date: string;
  // P2-1: richer mission summary. Optional so older persisted snapshots
  // (before these fields existed) still render without crashing.
  bestStreak?: number;
  streakBonus?: number;
  perfectBonus?: number;
  mastered?: string[];
  missionTitle?: string;
  concept?: string;
  prevLevel?: number;
  newLevel?: number;
};

type PlayerState = {
  hasProfile: boolean;
  avatar: PlayerAvatar;
  xp: number;
  crystals: number; // premium currency
  coins: number;
  nexos: number; // rare prestige currency
  points: number; // ranking points
  streak: number;
  documentName: string | null;
  worldsCleared: string[];
  missionsCleared: string[];
  achievements: string[]; // unlocked ids
  weakConcepts: string[];
  masteredConcepts: string[];
  attempts: MissionAttempt[];
  lastReward: LastReward | null;

  createProfile: (avatar: PlayerAvatar) => void;
  setDocument: (name: string) => void;
  addReward: (r: { xp?: number; crystals?: number; coins?: number; points?: number; nexos?: number }) => void;
  setStreak: (n: number) => void;
  clearWorld: (id: string) => void;
  clearMission: (id: string) => void;
  unlockAchievement: (id: string) => void;
  recordConcepts: (mastered: string[], weak: string[]) => void;
  recordAttempt: (a: MissionAttempt) => void;
  setLastReward: (r: LastReward) => void;
  applyRemote: (snap: RemotePlayerSnapshot) => void;
  resetAll: () => void;
};

/**
 * Full persistable snapshot of a player. Used to hydrate the local store from
 * the remote Cloud (`player_state`) on sign-in and to build the payload we push
 * back to the Cloud on every change. Mirrors the persisted fields 1:1.
 */
export type RemotePlayerSnapshot = {
  hasProfile: boolean;
  avatar: PlayerAvatar;
  xp: number;
  crystals: number;
  coins: number;
  nexos: number;
  points: number;
  streak: number;
  documentName: string | null;
  worldsCleared: string[];
  missionsCleared: string[];
  achievements: string[];
  weakConcepts: string[];
  masteredConcepts: string[];
  lastReward: LastReward | null;
  attempts?: MissionAttempt[];
};

const defaultAvatar: PlayerAvatar = {
  name: "Aspirante",
  classId: "explorador",
  base: "🧭",
  color: "oklch(0.68 0.19 250)",
  hair: "",
  outfit: "oklch(0.2 0.05 275)",
  emblem: "",
  companion: "nova",
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      hasProfile: false,
      avatar: defaultAvatar,
      xp: 0,
      crystals: 0,
      coins: 0,
      nexos: 0,
      points: 0,
      streak: 0,
      documentName: null,
      worldsCleared: [],
      missionsCleared: [],
      achievements: [],
      weakConcepts: [],
      masteredConcepts: [],
      attempts: [],
      lastReward: null,

      createProfile: (avatar) =>
        set({ hasProfile: true, avatar, xp: 50, crystals: 10, coins: 25, nexos: 1, points: 120 }),
      setDocument: (name) => set({ documentName: name }),
      addReward: (r) =>
        set((s) => ({
          xp: s.xp + (r.xp ?? 0),
          crystals: s.crystals + (r.crystals ?? 0),
          coins: s.coins + (r.coins ?? 0),
          nexos: s.nexos + (r.nexos ?? 0),
          points: s.points + (r.points ?? 0),
        })),
      setStreak: (n) => set({ streak: n }),
      clearWorld: (id) => set((s) => ({ worldsCleared: Array.from(new Set([...s.worldsCleared, id])) })),
      clearMission: (id) => set((s) => ({ missionsCleared: Array.from(new Set([...s.missionsCleared, id])) })),
      unlockAchievement: (id) =>
        set((s) => (s.achievements.includes(id) ? s : { achievements: [...s.achievements, id] })),
      recordConcepts: (mastered, weak) =>
        set((s) => ({
          masteredConcepts: Array.from(new Set([...s.masteredConcepts, ...mastered])),
          weakConcepts: Array.from(new Set([...s.weakConcepts.filter((c) => !mastered.includes(c)), ...weak])),
        })),
      recordAttempt: (a) => set((s) => ({ attempts: [a, ...s.attempts].slice(0, 20) })),
      setLastReward: (r) => set({ lastReward: r }),
      applyRemote: (snap) =>
        set({
          hasProfile: snap.hasProfile,
          avatar: snap.avatar,
          xp: snap.xp,
          crystals: snap.crystals,
          coins: snap.coins,
          nexos: snap.nexos,
          points: snap.points,
          streak: snap.streak,
          documentName: snap.documentName,
          worldsCleared: snap.worldsCleared,
          missionsCleared: snap.missionsCleared,
          achievements: snap.achievements,
          weakConcepts: snap.weakConcepts,
          masteredConcepts: snap.masteredConcepts,
          lastReward: snap.lastReward,
          ...(snap.attempts ? { attempts: snap.attempts } : {}),
        }),
      resetAll: () =>
        set({
          hasProfile: false,
          avatar: defaultAvatar,
          xp: 0,
          crystals: 0,
          coins: 0,
          nexos: 0,
          points: 0,
          streak: 0,
          documentName: null,
          worldsCleared: [],
          missionsCleared: [],
          achievements: [],
          weakConcepts: [],
          masteredConcepts: [],
          attempts: [],
          lastReward: null,
        }),
    }),
    { name: "nexus-quest-player", version: 3 },
  ),
);

export function usePlayerDerived() {
  const xp = usePlayerStore((s) => s.xp);
  const points = usePlayerStore((s) => s.points);
  return {
    level: levelForXp(xp),
    league: leagueForPoints(points) as LeagueId,
  };
}

/**
 * Whether the persisted store has finished rehydrating from localStorage.
 * Progression gates must wait for this before enforcing redirects, otherwise
 * a direct deep-link would be judged against the empty default state.
 */
export function usePlayerHydrated(): boolean {
  const [hydrated, setHydrated] = useState<boolean>(() => usePlayerStore.persist.hasHydrated());
  useEffect(() => {
    setHydrated(usePlayerStore.persist.hasHydrated());
    const unsub = usePlayerStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}

export const ACHIEVEMENT_LIST = ACHIEVEMENTS;
