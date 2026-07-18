import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ExplorerNode } from "./types";

/**
 * InteractableNode — envoltorio base de cualquier interactuable de la escena.
 * Coloca el nodo en su coordenada %, aplica el aro de "activo" y muestra el
 * rótulo. Las variantes (cristal, NPC, rival, portal, sendero) pasan su cuerpo
 * visual como `children`.
 */
export function InteractableNode({
  node,
  active,
  floating = true,
  ringClass,
  children,
}: {
  node: ExplorerNode;
  active: boolean;
  floating?: boolean;
  ringClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${node.pos.x}%`, top: `${node.pos.y}%` }}
    >
      <motion.div
        className={cn(
          "relative grid h-14 w-14 place-items-center rounded-2xl border-2 bevel-highlight transition",
          ringClass,
          active && "scale-110 ring-4",
        )}
        animate={floating ? { y: [0, -4, 0] } : undefined}
        transition={floating ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        {children}
      </motion.div>
      <p className="mt-1 w-24 -translate-x-1/2 text-center text-[10px] font-bold leading-tight" style={{ marginLeft: 28 }}>
        {node.label}
      </p>
    </div>
  );
}
