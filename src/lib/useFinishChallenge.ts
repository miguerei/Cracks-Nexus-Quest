import { useNavigate } from "@tanstack/react-router";
import { usePlayerStore } from "@/store/usePlayerStore";
import { computeRewards } from "@/lib/rewards";
import { logMissionAttempt, flushPlayerSync } from "@/lib/playerSync";
import { getMissionById } from "@/services/gameService";
import { levelForXp } from "@/data/game";

/** Unique id per finished attempt (idempotency key for mission_attempts). */
function newAttemptId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useFinishChallenge() {
  const navigate = useNavigate();

  return function finish(opts: {
    game: string;
    correct: number;
    total: number;
    bestStreak: number;
    difficulty?: number;
    mastered?: string[];
    weak?: string[];
    worldId?: string;
    missionId?: string;
  }) {
    // Read + mutate the store imperatively. This is an event callback, so it
    // must not subscribe the calling component to store updates.
    const store = usePlayerStore.getState();

    const r = computeRewards(opts);
    const nexos = r.perfect ? 1 : 0;

    const prevXp = store.xp;
    const prevCrystals = store.crystals;

    // One idempotency key shared by the attempt + reward snapshot.
    const attemptId = newAttemptId();

    // Apply the reward to the player exactly once, here.
    store.addReward({ xp: r.xp, crystals: r.crystals, coins: r.coins, points: r.points, nexos });
    store.setStreak(opts.bestStreak);
    store.recordConcepts(opts.mastered ?? [], opts.weak ?? []);
    const attempt = {
      id: attemptId,
      game: opts.game,
      correct: r.correct,
      total: r.total,
      xp: r.xp,
      date: new Date().toISOString(),
    };
    store.recordAttempt(attempt);
    // Mirror to the real Cloud history (no-op when playing as guest).
    logMissionAttempt(attempt);
    if (opts.missionId) store.clearMission(opts.missionId);
    if (opts.worldId) store.clearWorld(opts.worldId);

    // Achievements
    store.unlockAchievement("a1"); // primer reto
    if (opts.bestStreak >= 5) store.unlockAchievement("a2");
    if (prevCrystals + r.crystals >= 100) store.unlockAchievement("a3");
    if (r.perfect) store.unlockAchievement("a5");
    if (opts.worldId === "bosque") store.unlockAchievement("a4");
    if (levelForXp(prevXp + r.xp) >= 5) store.unlockAchievement("a6"); // alcanza nivel 5

    // Detect a level-up so /recompensa can celebrate progression.
    const prevLevel = levelForXp(prevXp);
    const newLevel = levelForXp(prevXp + r.xp);

    // Pick the headline concept the player just mastered (falls back to the
    // mission's concept). Purely for display — no progression logic here.
    const mastered = opts.mastered ?? [];
    const mission = opts.missionId ? getMissionById(opts.missionId) : undefined;
    const concept = mastered[mastered.length - 1] ?? mission?.concept;

    // Persist a snapshot of the applied reward. /recompensa only reads this,
    // so a reload or shared link shows the same result without re-applying.
    store.setLastReward({
      id: attemptId,
      game: opts.game,
      correct: r.correct,
      total: r.total,
      accuracy: r.accuracy,
      perfect: r.perfect,
      xp: r.xp,
      crystals: r.crystals,
      coins: r.coins,
      points: r.points,
      nexos,
      date: new Date().toISOString(),
      bestStreak: opts.bestStreak,
      streakBonus: r.streakBonus,
      perfectBonus: r.perfectBonus,
      mastered,
      missionTitle: mission?.title,
      concept,
      prevLevel,
      newLevel,
    });

    // Push the applied reward to the Cloud immediately (player_state +
    // public_scores) so ranking/state are up to date before /recompensa.
    // No-op for guests.
    flushPlayerSync();

    navigate({ to: "/recompensa" });
  };
}
