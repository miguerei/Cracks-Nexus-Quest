// Player persistence bridge: keeps the local Zustand player store in sync with
// the real Cloud database (`player_state` + `public_scores` + `mission_attempts`).
//
// Design goal: NEVER break the guest Visual Slice. The local store + localStorage
// remain the baseline. When a user signs in we:
//   1. Load their Cloud snapshot. If it has a profile, the Cloud wins (real
//      cross-device persistence).
//   2. Otherwise we push the current local progress up (so a guest who played
//      then signed up keeps everything).
// After that, every local store change is debounced and pushed back to the Cloud.

import { supabase } from "@/integrations/supabase/client";
import {
  usePlayerStore,
  type RemotePlayerSnapshot,
  type MissionAttempt,
} from "@/store/usePlayerStore";
import { useAuthStore } from "@/store/useAuthStore";

let currentUserId: string | null = null;
let unsubscribeStore: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
// While we hydrate FROM the cloud, avoid echoing the same data straight back.
let suppressPush = false;

function snapshotFromStore(): RemotePlayerSnapshot {
  const s = usePlayerStore.getState();
  return {
    hasProfile: s.hasProfile,
    avatar: s.avatar,
    xp: s.xp,
    crystals: s.crystals,
    coins: s.coins,
    nexos: s.nexos,
    points: s.points,
    streak: s.streak,
    documentName: s.documentName,
    worldsCleared: s.worldsCleared,
    missionsCleared: s.missionsCleared,
    achievements: s.achievements,
    weakConcepts: s.weakConcepts,
    masteredConcepts: s.masteredConcepts,
    lastReward: s.lastReward,
  };
}

/** Map a `player_state` row (snake_case) into the local snapshot shape. */
function rowToSnapshot(row: Record<string, unknown>, attempts?: MissionAttempt[]): RemotePlayerSnapshot {
  return {
    hasProfile: Boolean(row.has_profile),
    avatar: row.avatar as RemotePlayerSnapshot["avatar"],
    xp: Number(row.xp ?? 0),
    crystals: Number(row.crystals ?? 0),
    coins: Number(row.coins ?? 0),
    nexos: Number(row.nexos ?? 0),
    points: Number(row.points ?? 0),
    streak: Number(row.streak ?? 0),
    documentName: (row.document_name as string | null) ?? null,
    worldsCleared: (row.worlds_cleared as string[]) ?? [],
    missionsCleared: (row.missions_cleared as string[]) ?? [],
    achievements: (row.achievements as string[]) ?? [],
    weakConcepts: (row.weak_concepts as string[]) ?? [],
    masteredConcepts: (row.mastered_concepts as string[]) ?? [],
    lastReward: (row.last_reward as RemotePlayerSnapshot["lastReward"]) ?? null,
    attempts,
  };
}

async function pushNow(userId: string) {
  const snap = snapshotFromStore();
  const { error } = await supabase.from("player_state").upsert(
    {
      user_id: userId,
      has_profile: snap.hasProfile,
      avatar: snap.avatar,
      xp: snap.xp,
      crystals: snap.crystals,
      coins: snap.coins,
      nexos: snap.nexos,
      points: snap.points,
      streak: snap.streak,
      document_name: snap.documentName,
      worlds_cleared: snap.worldsCleared,
      missions_cleared: snap.missionsCleared,
      achievements: snap.achievements,
      weak_concepts: snap.weakConcepts,
      mastered_concepts: snap.masteredConcepts,
      last_reward: snap.lastReward,
    },
    { onConflict: "user_id" },
  );
  if (error) console.error("[playerSync] player_state upsert failed", error.message);

  // Public ranking row + profile: only ever written once the player has a hero.
  if (snap.hasProfile) {
    const { error: profErr } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: snap.avatar.name || "Aspirante" }, { onConflict: "id" });
    if (profErr) console.error("[playerSync] profiles upsert failed", profErr.message);

    const { error: scoreErr } = await supabase.from("public_scores").upsert(
      {
        user_id: userId,
        name: snap.avatar.name || "Aspirante",
        class_id: snap.avatar.classId,
        points: snap.points,
        xp: snap.xp,
      },
      { onConflict: "user_id" },
    );
    if (scoreErr) console.error("[playerSync] public_scores upsert failed", scoreErr.message);
  }
}

function schedulePush() {
  if (suppressPush || !currentUserId) return;
  if (pushTimer) clearTimeout(pushTimer);
  const uid = currentUserId;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (uid) void pushNow(uid);
  }, 700);
}

async function hydrateOrCreate(userId: string) {
  const [{ data: row, error }, { data: att }] = await Promise.all([
    supabase.from("player_state").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("mission_attempts")
      .select("id, game, correct, total, xp, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (error) {
    console.error("[playerSync] load failed", error.message);
    return;
  }

  const attempts: MissionAttempt[] = (att ?? []).map((a) => ({
    id: a.id,
    game: a.game,
    correct: a.correct,
    total: a.total,
    xp: a.xp,
    date: a.created_at,
  }));

  if (row && row.has_profile) {
    // Cloud is the source of truth for a returning player.
    suppressPush = true;
    usePlayerStore.getState().applyRemote(rowToSnapshot(row, attempts));
    suppressPush = false;
  } else {
    // No cloud profile yet: upload whatever the guest built locally.
    await pushNow(userId);
  }
}

function startStoreSubscription() {
  if (unsubscribeStore) return;
  unsubscribeStore = usePlayerStore.subscribe(() => schedulePush());
}

function stopStoreSubscription() {
  if (unsubscribeStore) {
    unsubscribeStore();
    unsubscribeStore = null;
  }
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}

/**
 * Insert a mission attempt into the real history table (fire-and-forget).
 * Uses the client-generated attempt id as the primary key and upserts on it,
 * so an accidental double-finish never creates a duplicate row.
 */
export function logMissionAttempt(a: MissionAttempt) {
  if (!currentUserId) return;
  void supabase
    .from("mission_attempts")
    .upsert(
      {
        id: a.id,
        user_id: currentUserId,
        game: a.game,
        correct: a.correct,
        total: a.total,
        xp: a.xp,
      },
      { onConflict: "id" },
    )
    .then(({ error }) => {
      if (error) console.error("[playerSync] attempt upsert failed", error.message);
    });
}

/** Force an immediate push of the current local state to the Cloud. */
export function flushPlayerSync() {
  if (currentUserId) void pushNow(currentUserId);
}

let bootstrapped = false;

/**
 * Wire Supabase Auth to the app once, from the root. Keeps `useAuthStore` fresh,
 * hydrates/pushes the player store, and invalidates router/query caches on
 * identity transitions.
 */
export function bootstrapAuth(onIdentityChange?: () => void) {
  if (bootstrapped) return;
  bootstrapped = true;

  supabase.auth.getSession().then(({ data }) => {
    useAuthStore.getState().setAuth(data.session ?? null);
    useAuthStore.getState().setInitialized(true);
    if (data.session?.user) {
      currentUserId = data.session.user.id;
      void hydrateOrCreate(currentUserId).then(startStoreSubscription);
    }
  });

  supabase.auth.onAuthStateChange((event, session) => {
    useAuthStore.getState().setAuth(session ?? null);
    useAuthStore.getState().setInitialized(true);

    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      const uid = session?.user?.id ?? null;
      if (uid && uid !== currentUserId) {
        currentUserId = uid;
        void hydrateOrCreate(uid).then(startStoreSubscription);
      }
      if (event === "SIGNED_IN") onIdentityChange?.();
    } else if (event === "SIGNED_OUT") {
      currentUserId = null;
      stopStoreSubscription();
      onIdentityChange?.();
    } else if (event === "USER_UPDATED") {
      onIdentityChange?.();
    }
  });
}
