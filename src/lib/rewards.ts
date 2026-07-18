// Shared reward math for minigames. Mock now, easy to move server-side later.

export type ChallengeResult = {
  correct: number;
  total: number;
  bestStreak: number;
  xp: number;
  crystals: number;
  coins: number;
  points: number;
  accuracy: number;
  perfect: boolean;
  streakBonus: number;
  perfectBonus: number;
};

export function computeRewards(opts: {
  correct: number;
  total: number;
  bestStreak: number;
  difficulty?: number; // multiplier
}): ChallengeResult {
  const { correct, total, bestStreak } = opts;
  const difficulty = opts.difficulty ?? 1;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const perfect = correct === total && total > 0;

  const baseXp = correct * 20 * difficulty;
  const streakBonus = bestStreak >= 3 ? bestStreak * 8 : 0;
  const perfectBonus = perfect ? 40 : 0;

  const xp = Math.round(baseXp + streakBonus + perfectBonus);
  const crystals = Math.round(correct * 2 * difficulty + (perfect ? 8 : 0));
  const coins = Math.round(correct * 5 * difficulty);
  const points = Math.round(correct * 15 * difficulty + streakBonus + perfectBonus);

  return { correct, total, bestStreak, xp, crystals, coins, points, accuracy, perfect, streakBonus, perfectBonus };
}
