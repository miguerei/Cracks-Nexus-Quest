import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Lock, Sparkles, Check } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameFrame } from "@/components/game/GameFrame";
import { GameHud } from "@/components/hud/GameHud";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { getWorldsWithProgress, type WorldWithProgress } from "@/services/gameService";
import { StatusBadge, type GameStatus } from "@/components/game/StatusBadge";
import { CrystalIcon } from "@/components/game/CrystalIcon";
import { OverworldMap } from "@/components/game/explorer";
import { ARTBOOK } from "@/lib/artbook";
import { usePlayerStore } from "@/store/usePlayerStore";

export const Route = createFileRoute("/mapa")({
  component: WorldMap,
});

/** Whether a world can be entered (has a playable screen right now). */
function isLinkable(w: WorldWithProgress): boolean {
  return w.playable && (w.progressStatus === "current" || w.progressStatus === "completed");
}

/** Links a world node/card to its playable screen, or the future-world page. */
function WorldLink({ w, children }: { w: WorldWithProgress; children: ReactNode }) {
  if (isLinkable(w) && w.id === "bosque") return <Link to="/mundo/bosque">{children}</Link>;
  if (isLinkable(w) && w.id === "algoritmos") return <Link to="/mundo/algoritmos">{children}</Link>;
  return (
    <Link to="/mundo/$worldId" params={{ worldId: w.id }} title={w.unlockHint}>
      {children}
    </Link>
  );
}

/** Maps a world's progress status to the shared StatusBadge state. */
function statusOf(w: WorldWithProgress): GameStatus {
  switch (w.progressStatus) {
    case "completed":
      return "completed";
    case "current":
      return "current";
    case "coming_soon_unlocked":
      return "coming_soon";
    default:
      return "locked";
  }
}

/** Frame glow per world state, kept subtle so the map doesn't over-bloom. */
function glowOf(w: WorldWithProgress): "primary" | "gold" | "energy" | "violet" | "none" {
  switch (w.progressStatus) {
    case "completed":
      return "energy";
    case "current":
      return "primary";
    case "coming_soon_unlocked":
      return "gold";
    default:
      return "none";
  }
}

function WorldMap() {
  const worldsCleared = usePlayerStore((s) => s.worldsCleared);
  const missionsCleared = usePlayerStore((s) => s.missionsCleared);
  const worlds = getWorldsWithProgress({ worldsCleared, missionsCleared });
  const bosqueDone = worlds.find((w) => w.id === "bosque")?.progressStatus === "completed";

  return (
    <div className="relative min-h-screen">
      <StarField density={90} />
      {/* Key Art atmosphere + Void fog, purely decorative and non-blocking. */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <img
          src={ARTBOOK.keyArt}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="h-full w-full object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-gradient-hero opacity-80" />
        <div className="absolute inset-0 bg-fog-void opacity-40" />
      </div>
      <GameHud />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-1 text-3xl font-black">Mapa de Nexus</h1>
        <p className="mb-4 text-muted-foreground">Explora los mundos. Supera misiones para desbloquear nuevas zonas.</p>

        <div className="mb-6">
          <NovaBubble
            mood="hint"
            message={
              bosqueDone
                ? "¡Buen viaje, Aspirante! Cada mundo que restauras abre el siguiente. Sigue el sendero luminoso del Nexus."
                : "El Bosque del Descubrimiento está abierto. Complétalo para desbloquear la Ciudad de los Algoritmos y el resto del Nexus."
            }
          />
        </div>


        {/* Playable Nexus Overworld: mueve a tu Aspirante, recorre los senderos
            luminosos y entra a cada mundo al acercarte. Nova te acompaña y los
            mundos bloqueados quedan cubiertos por la niebla del Vacío. */}
        <div className="mb-8">
          <OverworldMap worlds={worlds} />
        </div>


        {/* World cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {worlds.map((w, i) => {
            const locked = w.progressStatus === "locked";
            const comingSoon = w.progressStatus === "coming_soon_unlocked";
            const completed = w.progressStatus === "completed";
            const linkable = isLinkable(w);
            const pct = w.total > 0 ? Math.round((w.done / w.total) * 100) : completed ? 100 : 0;
            const card = (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="h-full"
              >
                <GameFrame
                  glow={glowOf(w)}
                  className={`h-full ${
                    locked
                      ? "opacity-80"
                      : linkable
                        ? "transition hover:-translate-y-1 hover:shadow-deep"
                        : ""
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl bevel-highlight ${locked ? "bg-fog-void grayscale" : comingSoon ? "bg-gradient-void" : completed ? "bg-gradient-energy" : "bg-gradient-nexus"}`}>
                      {locked ? <Lock className="h-5 w-5 text-muted-foreground" /> : w.emoji}
                    </span>
                    <StatusBadge status={statusOf(w)} className="px-2 py-1" />
                  </div>
                  <p className="font-bold">{w.name}</p>
                  <p className="mb-3 text-xs text-muted-foreground">{w.tagline}</p>
                  {w.total > 0 && (
                    <div className="mb-2">
                      <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                        <span>Restauración del Núcleo</span><span>{w.done}/{w.total}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-energy" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-background/60 px-2 py-1 text-gold">
                      <CrystalIcon kind="key" size="sm" glow={false} className="h-5 w-5 rounded-lg" />
                      {w.reward}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${comingSoon ? "bg-gold/10 text-gold" : "bg-background/60 text-muted-foreground"}`}>
                      {comingSoon ? <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" /> : <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />}
                      {w.unlockHint}
                    </span>
                  </div>
                </GameFrame>
              </motion.div>
            );
            return (
              <WorldLink key={w.id} w={w}>
                {card}
              </WorldLink>
            );
          })}
        </div>
      </main>
    </div>
  );
}
