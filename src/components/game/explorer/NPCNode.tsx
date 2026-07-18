import { InteractableNode } from "./InteractableNode";
import { NovaAvatar } from "@/components/hud/NovaAvatar";
import type { ExplorerNode } from "./types";

/**
 * NPCNode — aliado que da pistas o sabor narrativo (p. ej. Nova).
 * Presentacional: la acción (mostrar mensaje) la decide quien lo instancia.
 * Cuando el nodo es Nova, muestra su retrato oficial en lugar del emoji.
 */
export function NPCNode({ node, active }: { node: ExplorerNode; active: boolean }) {
  const isNova = node.id === "nova";
  return (
    <InteractableNode
      node={node}
      active={active}
      ringClass="border-accent/70 bg-card text-accent glow-primary ring-accent/50"
    >
      {isNova ? (
        <NovaAvatar variant="icon" size={40} float={false} className="border-0 shadow-none" />
      ) : (
        <span className="text-2xl leading-none">{node.emoji ?? "✨"}</span>
      )}
    </InteractableNode>
  );
}
