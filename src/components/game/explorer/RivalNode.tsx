import { InteractableNode } from "./InteractableNode";
import type { ExplorerNode } from "./types";

/**
 * RivalNode — rival del ranking al que se puede retar/adelantar.
 * Presentacional: la acción (ir al ranking, etc.) la decide quien lo instancia.
 */
export function RivalNode({ node, active }: { node: ExplorerNode; active: boolean }) {
  return (
    <InteractableNode
      node={node}
      active={active}
      ringClass="border-gold/70 bg-gradient-gold text-background glow-gold ring-gold/50"
    >
      <span className="text-2xl leading-none">{node.emoji ?? "🤺"}</span>
    </InteractableNode>
  );
}
