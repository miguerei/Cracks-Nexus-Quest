import { motion } from "framer-motion";
import type { ExplorerNode } from "./types";

/**
 * InteractionPrompt — banner contextual que aparece cuando el héroe está cerca
 * de un nodo. Muestra el título/subtítulo del interactuable activo.
 */
export function InteractionPrompt({ node }: { node: ExplorerNode | null }) {
  if (!node) return null;
  const locked = node.status === "locked";
  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute inset-x-3 top-12 z-30 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-primary/40 bg-background/85 p-3 backdrop-blur"
    >
      <span className="text-lg">{node.emoji ?? "✨"}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{node.title ?? node.label}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {locked ? "Bloqueado · completa la misión anterior" : node.sublabel ?? "Pulsa Entrar para interactuar"}
        </p>
      </div>
    </motion.div>
  );
}
