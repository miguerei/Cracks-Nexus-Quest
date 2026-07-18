import { Check, Lock, Sparkles, Compass, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared status pill so every "completed / in-progress / locked" chip looks the
// same across the map, world and missions. Icons carry the meaning so the state
// never depends on an emoji (accessibility + visual consistency, P2-6).
export type GameStatus = "completed" | "current" | "coming_soon" | "locked";

const CONFIG: Record<GameStatus, { label: string; icon: LucideIcon; cls: string }> = {
  completed: { label: "Completado", icon: Check, cls: "bg-energy/15 text-energy" },
  current: { label: "En curso", icon: Compass, cls: "bg-primary/15 text-primary" },
  coming_soon: { label: "Desbloqueado", icon: Sparkles, cls: "bg-secondary/15 text-secondary" },
  locked: { label: "Bloqueado", icon: Lock, cls: "bg-background/60 text-muted-foreground" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: GameStatus;
  /** Optional label override (e.g. feminine "Completada" for a mission). */
  label?: string;
  className?: string;
}) {
  const c = CONFIG[status];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
        c.cls,
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" /> {label ?? c.label}
    </span>
  );
}
