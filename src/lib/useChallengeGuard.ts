import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { canAccessChallenge, worldOfChallenge } from "@/services/gameService";
import { usePlayerStore, usePlayerHydrated } from "@/store/usePlayerStore";

/**
 * Client-side gate for challenge routes. Reads real progress from the store
 * and, if the challenge is locked, redirects back to its world with a
 * "reto bloqueado" toast. It waits for store hydration so a legitimate
 * deep-link isn't judged against the empty default state.
 *
 * `missionId` (from the `?m=` search param) resolves gating and the redirect
 * target for the specific mission, so a challenge route reused across worlds
 * is gated for the right world/mission. Without it, gating falls back to the
 * first mission on the route (legacy behaviour).
 *
 * Returns whether the challenge is currently accessible; callers should render
 * a locked fallback while it's false. While hydrating it returns true to avoid
 * flashing the locked screen before persisted progress loads.
 */
export function useChallengeGuard(route: string, missionId?: string): boolean {
  const navigate = useNavigate();
  const hydrated = usePlayerHydrated();
  const missionsCleared = usePlayerStore((s) => s.missionsCleared);
  const worldsCleared = usePlayerStore((s) => s.worldsCleared);
  const allowed = canAccessChallenge(route, { worldsCleared, missionsCleared }, missionId);

  useEffect(() => {
    if (hydrated && !allowed) {
      toast.error("Reto bloqueado. Completa la misión anterior para abrir este sendero.");
      const worldId = worldOfChallenge(route, missionId);
      navigate({ to: "/mundo/$worldId", params: { worldId } });
    }
  }, [hydrated, allowed, navigate, route, missionId]);

  return hydrated ? allowed : true;
}
