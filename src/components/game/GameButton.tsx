import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

/**
 * Fase 1.2-A — Botón base del videojuego (Art Bible).
 *
 * Botón biselado con marco metálico y glow, en las dos variantes oficiales del
 * Style Guide: "primary" (azul energía, acción de jugar/avanzar) y "gold"
 * (dorado, acción de reclamar/recompensa). Es puramente presentacional: no
 * añade lógica de negocio. Úsalo con `asChild` para envolver un <Link>.
 */
export type GameButtonVariant = "primary" | "gold" | "energy" | "void" | "ghost";
export type GameButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<GameButtonVariant, string> = {
  primary: "bg-gradient-nexus text-primary-foreground glow-primary",
  gold: "bg-gradient-gold text-gold-foreground glow-gold",
  energy: "bg-gradient-energy text-energy-foreground glow-energy",
  void: "bg-gradient-void text-secondary-foreground glow-violet",
  ghost: "border border-primary/50 bg-card/50 text-primary hover:bg-card/70",
};

const SIZES: Record<GameButtonSize, string> = {
  sm: "px-4 py-2 text-sm rounded-xl gap-1.5",
  md: "px-6 py-3 text-base rounded-2xl gap-2",
  lg: "px-6 py-4 text-base rounded-2xl gap-2",
};

export interface GameButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  asChild?: boolean;
}

export const GameButton = forwardRef<HTMLButtonElement, GameButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "group inline-flex items-center justify-center font-bold transition",
          "bevel-highlight hover:scale-[1.02] active:scale-[0.99]",
          "disabled:pointer-events-none disabled:opacity-50",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      />
    );
  },
);
GameButton.displayName = "GameButton";
