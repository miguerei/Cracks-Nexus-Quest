import { cn } from "@/lib/utils";
import type { ExplorerNode, ExplorerPoint } from "./types";

const DOT: Record<ExplorerNode["type"], string> = {
  mission: "bg-primary",
  npc: "bg-accent",
  rival: "bg-gold",
  portal: "bg-primary/70",
  blocked: "bg-muted-foreground",
};

/**
 * MiniMap — mapa en miniatura de la escena: puntos de cada nodo y la posición
 * del héroe en tiempo real. Puramente informativo.
 */
export function MiniMap({
  nodes,
  player,
  className,
}: {
  nodes: ExplorerNode[];
  player: ExplorerPoint;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative h-20 w-28 overflow-hidden rounded-xl border border-primary/30 bg-background/70 backdrop-blur",
        className,
      )}
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-hero opacity-60" />
      {nodes.map((n) => (
        <span
          key={n.id}
          className={cn(
            "absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
            DOT[n.type],
            n.status === "completed" && "bg-energy",
            n.status === "locked" && "opacity-50",
          )}
          style={{ left: `${n.pos.x}%`, top: `${n.pos.y}%` }}
        />
      ))}
      <span
        className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-primary-foreground glow-primary"
        style={{ left: `${player.x}%`, top: `${player.y}%` }}
      />
    </div>
  );
}
