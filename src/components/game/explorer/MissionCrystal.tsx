import { Lock, Check, Zap, Puzzle, Layers, Swords, Crown } from "lucide-react";
import { InteractableNode } from "./InteractableNode";
import type { ExplorerNode } from "./types";
import type { Mission } from "@/services/gameService";

const ICONS: Record<Mission["kind"], typeof Zap> = {
  duelo: Zap,
  puzzle: Puzzle,
  cartas: Layers,
  arena: Swords,
  boss: Crown,
};

/**
 * MissionCrystal — cristal de misión (o jefe) del sistema de exploración.
 * Muestra bloqueado / disponible / completado y estilo especial para el boss.
 */
export function MissionCrystal({ node, active }: { node: ExplorerNode; active: boolean }) {
  const locked = node.status === "locked";
  const done = node.status === "completed";
  const isBoss = node.kind === "boss";
  const Icon = ICONS[node.kind ?? "duelo"];

  const ringClass = locked
    ? "border-secondary/40 bg-fog-void text-muted-foreground grayscale ring-destructive/40"
    : done
      ? "border-energy bg-card text-energy glow-energy ring-primary/50"
      : isBoss
        ? "border-violet-400 bg-gradient-void text-secondary-foreground glow-violet ring-primary/50"
        : "border-primary bg-card text-primary glow-primary ring-primary/50";

  return (
    <InteractableNode node={node} active={active} floating={!locked} ringClass={ringClass}>
      {locked ? <Lock className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
      {done && (
        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-energy text-background">
          <Check className="h-3 w-3" />
        </span>
      )}
    </InteractableNode>
  );
}
