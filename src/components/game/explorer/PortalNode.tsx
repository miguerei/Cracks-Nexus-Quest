import { DoorOpen } from "lucide-react";
import { InteractableNode } from "./InteractableNode";
import type { ExplorerNode } from "./types";

/**
 * PortalNode — salida a otra pantalla (mapa, otro mundo…).
 * Presentacional: la navegación la decide quien lo instancia vía onInteract.
 */
export function PortalNode({ node, active }: { node: ExplorerNode; active: boolean }) {
  return (
    <InteractableNode
      node={node}
      active={active}
      ringClass="border-primary/70 bg-gradient-nexus text-primary-foreground glow-primary ring-primary/50"
    >
      <DoorOpen className="h-6 w-6" />
    </InteractableNode>
  );
}
