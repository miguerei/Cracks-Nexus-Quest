import { Lock } from "lucide-react";
import { InteractableNode } from "./InteractableNode";
import type { ExplorerNode } from "./types";

/**
 * BlockedPathNode — sendero sellado por la niebla del Vacío. Nunca es jugable;
 * al interactuar solo avisa. Sirve para insinuar contenido futuro sin romper
 * el gating real.
 */
export function BlockedPathNode({ node, active }: { node: ExplorerNode; active: boolean }) {
  return (
    <InteractableNode
      node={node}
      active={active}
      floating={false}
      ringClass="border-secondary/40 bg-fog-void text-muted-foreground grayscale ring-destructive/40"
    >
      <Lock className="h-6 w-6" />
    </InteractableNode>
  );
}
