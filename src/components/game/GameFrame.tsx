import { createElement } from "react";
import { cn } from "@/lib/utils";

/**
 * Fase 1.2-A — Marco metálico biselado del HUD (Art Bible).
 *
 * Contenedor reutilizable con marco metálico, bisel interior y glow suave, para
 * dar el aspecto de panel de videojuego a cards, paneles y secciones. Sólo
 * presentación; no impone layout interno más allá del padding y el radio.
 */
export type GameFrameGlow = "none" | "primary" | "gold" | "energy" | "violet";

const GLOW: Record<GameFrameGlow, string> = {
  none: "",
  primary: "glow-primary",
  gold: "glow-gold",
  energy: "glow-energy",
  violet: "glow-violet",
};

export function GameFrame({
  children,
  glow = "none",
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  glow?: GameFrameGlow;
  className?: string;
  as?: React.ElementType;
}) {
  return createElement(
    Tag,
    {
      className: cn(
        "relative rounded-3xl border border-border bg-card/60 p-5 backdrop-blur",
        "bevel-highlight",
        GLOW[glow],
        className,
      ),
    },
    // Filo metálico superior sutil, como en los paneles del Style Guide
    <span
      key="edge"
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-3xl frame-metal opacity-70"
    />,
    children,
  );
}
