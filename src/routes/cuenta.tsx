import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { UserCircle, LogOut, Cloud, CloudOff, ShieldCheck, Trophy, Gem } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameHud } from "@/components/hud/GameHud";
import { GameFrame } from "@/components/game/GameFrame";
import { GameButton } from "@/components/game/GameButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { flushPlayerSync } from "@/lib/playerSync";
import { toast } from "sonner";

export const Route = createFileRoute("/cuenta")({
  component: Account,
});

function Account() {
  const navigate = useNavigate();
  const { user, initialized } = useAuthStore();
  const { avatar, points, crystals, hasProfile } = usePlayerStore();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    // Push any pending local state before we drop the session.
    flushPlayerSync();
    await supabase.auth.signOut();
    toast.success("Sesión cerrada", { description: "Tu progreso quedó guardado en la nube." });
    navigate({ to: "/" });
  }

  return (
    <div className="relative min-h-screen">
      <StarField />
      <GameHud />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-accent backdrop-blur">
            <UserCircle className="h-3.5 w-3.5" /> Tu cuenta
          </span>
          <h1 className="mt-2 text-3xl font-black">Cuenta del Aspirante</h1>
          <p className="text-muted-foreground">Gestiona tu sesión y la sincronización en la nube.</p>
        </div>

        {!initialized ? (
          <GameFrame className="text-center text-muted-foreground">Comprobando sesión…</GameFrame>
        ) : user ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <GameFrame glow="energy">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-energy text-energy-foreground">
                  <Cloud className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-energy">Sesión activa</p>
                  <p className="truncate font-bold">{user.email}</p>
                  <p className="text-xs text-muted-foreground">Tu progreso se guarda automáticamente en la nube.</p>
                </div>
              </div>
            </GameFrame>

            <div className="grid grid-cols-2 gap-3">
              <GameFrame className="p-4 text-center">
                <Trophy className="mx-auto mb-1 h-5 w-5 text-gold" />
                <p className="text-2xl font-black tabular-nums">{points}</p>
                <p className="text-xs text-muted-foreground">Puntos de ranking</p>
              </GameFrame>
              <GameFrame className="p-4 text-center">
                <Gem className="mx-auto mb-1 h-5 w-5 text-accent" />
                <p className="text-2xl font-black tabular-nums">{crystals}</p>
                <p className="text-xs text-muted-foreground">Cristales</p>
              </GameFrame>
            </div>

            <GameFrame className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                Aspirante: <span className="font-bold text-foreground">{avatar.name}</span>
                {!hasProfile && " — aún sin crear. Diseña tu héroe para competir en el ranking."}
              </p>
            </GameFrame>

            <div className="flex flex-wrap gap-3">
              {!hasProfile && (
                <GameButton asChild variant="primary">
                  <Link to="/crear-avatar">Crear Aspirante</Link>
                </GameButton>
              )}
              <GameButton asChild variant="ghost">
                <Link to="/perfil">Ver perfil</Link>
              </GameButton>
              <GameButton variant="ghost" onClick={handleSignOut} disabled={signingOut}>
                <LogOut className="h-4 w-4" /> {signingOut ? "Saliendo…" : "Cerrar sesión"}
              </GameButton>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <GameFrame glow="violet">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-void text-primary-foreground">
                  <CloudOff className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--void)" }}>
                    Estás jugando como invitado
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tu progreso solo vive en este dispositivo. Crea una cuenta para guardarlo en la nube y competir en el
                    ranking real.
                  </p>
                </div>
              </div>
            </GameFrame>

            <GameButton asChild variant="primary" size="lg" className="w-full">
              <Link to="/auth" search={{ redirect: "/cuenta" }}>
                Iniciar sesión o registrarme
              </Link>
            </GameButton>
          </motion.div>
        )}
      </main>
    </div>
  );
}
