import { Link } from "@tanstack/react-router";
import { Lock, ArrowLeft } from "lucide-react";
import { SystemScreen } from "@/components/game/SystemScreen";

/** Friendly, in-universe fallback shown when the player reaches a locked challenge. */
export function ChallengeLocked() {
  return (
    <SystemScreen
      icon={<Lock className="h-9 w-9 text-muted-foreground" />}
      title="Sendero cubierto por la niebla"
      message="Este sendero sigue cubierto por la niebla del Vacío. Completa la misión anterior para abrir este camino."
      novaMessage="Cada reto que superas disipa un poco más la niebla. ¡Vamos paso a paso!"
    >
      <Link
        to="/mundo/bosque"
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-nexus px-6 py-3.5 font-bold text-primary-foreground glow-primary transition hover:scale-[1.02]"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al Bosque
      </Link>
    </SystemScreen>
  );
}
