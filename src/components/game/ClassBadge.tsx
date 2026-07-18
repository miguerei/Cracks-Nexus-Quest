import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fase 1.2-C / 1.3 — Insignia de clase del Aspirante (Art Bible).
 *
 * Tile seleccionable que representa una clase de jugador como una gema/cristal
 * enmarcado: disco con glow tintado por el color de la clase, emoji central,
 * nombre, rol y tagline. Es puramente presentacional (no toca el store); el
 * estado `selected` sólo cambia el aspecto. Úsalo como botón pasando `onClick`.
 *
 * Fase 1.3: `role` es opcional y retrocompatible; cuando se pasa, se muestra
 * como micro-etiqueta de rol bajo el nombre.
 */
export function ClassBadge({
  emoji,
  name,
  tagline,
  role,
  color,
  image,
  selected = false,
  onClick,
  className,
}: {
  emoji: string;
  name: string;
  tagline?: string;
  role?: string;
  color: string;
  /** Optional hero portrait shown instead of the emoji. */
  image?: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col items-start gap-2 rounded-2xl border-2 p-3 text-left transition",
        "bevel-highlight hover:-translate-y-0.5",
        selected
          ? "border-primary bg-primary/10 ring-2 ring-ring/40"
          : "border-border bg-card/50 hover:border-primary/50",
        className,
      )}
    >
      {selected ? (
        <span className="absolute right-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" aria-hidden="true" />
        </span>
      ) : null}
      <span
        className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl text-2xl transition group-hover:scale-105"
        style={{
          background: image ? "oklch(0.16 0.045 275)" : `radial-gradient(circle at 30% 25%, ${color}, transparent 75%)`,
          boxShadow: selected ? `0 0 22px -4px ${color}` : `0 0 12px -6px ${color}`,
          border: `1.5px solid ${color}`,
        }}
      >
        {image ? (
          <img src={image} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          emoji
        )}
      </span>
      <span className="text-sm font-bold leading-tight">{name}</span>
      {role ? (
        <span
          className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
        >
          {role}
        </span>
      ) : null}
      {tagline ? (
        <span className="text-[11px] leading-tight text-muted-foreground">{tagline}</span>
      ) : null}
    </button>
  );
}
