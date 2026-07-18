import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Lightweight auth state, kept in sync with Supabase Auth by `bootstrapAuth`
 * (see `src/lib/playerSync.ts`). Components read `user` / `initialized` to show
 * the right account affordance. This never gates the app — the Visual Slice
 * stays fully playable as a guest.
 */
type AuthState = {
  user: User | null;
  session: Session | null;
  /** True once the initial session check has completed. */
  initialized: boolean;
  setAuth: (session: Session | null) => void;
  setInitialized: (v: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  initialized: false,
  setAuth: (session) => set({ session, user: session?.user ?? null }),
  setInitialized: (v) => set({ initialized: v }),
}));
