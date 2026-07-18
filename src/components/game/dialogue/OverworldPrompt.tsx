import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * OverworldPrompt — pequeño aviso flotante estilo RPG que aparece sobre un
 * interactuable cercano ("▲ Pulsa Enter"). Invita a interactuar sin tapar la
 * escena. Presentacional puro.
 */
export function OverworldPrompt({
  label = "Hablar",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.9 }}
      animate={{ opacity: 1, y: [0, -3, 0], scale: 1 }}
      transition={{ y: { duration: 1.4, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 0.2 } }}
      className={cn(
        "pointer-events-none inline-flex items-center gap-1 rounded-full border border-primary/60 bg-background/85 px-2.5 py-1 text-[11px] font-black text-primary shadow-deep backdrop-blur",
        className,
      )}
    >
      <span className="text-primary">⏎</span>
      <span className="text-foreground">{label}</span>
    </motion.div>
  );
}
