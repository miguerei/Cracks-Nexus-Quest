import { Gem, Coins, Zap, KeyRound, Trophy, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fase 1.2-A — Iconos de recurso del videojuego (Art Bible).
 *
 * Set unificado para representar los recursos del juego (cristales, monedas,
 * XP/energía, llaves del Nexus, puntos) con el mismo lenguaje visual: icono
 * monocromo dentro de un disco con glow acorde al recurso. Sólo presentación.
 */
export type ResourceKind = "crystal" | "coin" | "xp" | "key" | "points";

const CONFIG: Record<ResourceKind, { icon: LucideIcon; wrap: string; icon_cls: string }> = {
  crystal: { icon: Gem, wrap: "bg-primary/15 glow-primary", icon_cls: "text-primary" },
  coin: { icon: Coins, wrap: "bg-gold/15 glow-gold", icon_cls: "text-gold" },
  xp: { icon: Zap, wrap: "bg-energy/15 glow-energy", icon_cls: "text-energy" },
  key: { icon: KeyRound, wrap: "bg-gold/15 glow-gold", icon_cls: "text-gold" },
  points: { icon: Trophy, wrap: "bg-secondary/15 glow-violet", icon_cls: "text-secondary" },
};

const SIZES = {
  sm: { box: "h-8 w-8", icon: "h-4 w-4" },
  md: { box: "h-11 w-11", icon: "h-5 w-5" },
  lg: { box: "h-14 w-14", icon: "h-7 w-7" },
} as const;

export function CrystalIcon({
  kind = "crystal",
  size = "md",
  glow = true,
  className,
}: {
  kind?: ResourceKind;
  size?: keyof typeof SIZES;
  glow?: boolean;
  className?: string;
}) {
  const c = CONFIG[kind];
  const s = SIZES[size];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl",
        s.box,
        glow ? c.wrap : c.wrap.replace(/glow-\S+/, ""),
        className,
      )}
    >
      <Icon className={cn(s.icon, c.icon_cls)} aria-hidden="true" />
    </span>
  );
}
