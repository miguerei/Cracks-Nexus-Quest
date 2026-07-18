import { motion } from "framer-motion";
import { RARITY, type Rarity } from "@/lib/artbook";
import { CrystalIcon, type ResourceKind } from "@/components/game/CrystalIcon";
import { cn } from "@/lib/utils";

/**
 * Fase 1.2-A — Carta de recompensa vertical (Art Bible, bloque UI/Recompensas).
 *
 * Carta con marco ornamentado y glow según rareza (azul Cristal de Saber,
 * violeta Fragmento Épico, dorado Llave del Nexus), con cantidad "x150". Es
 * puramente presentacional: recibe los valores ya calculados, nunca aplica
 * recompensas ni toca el store.
 */
export function RewardCard({
  rarity,
  title,
  amount,
  resource = "crystal",
  index = 0,
  className,
}: {
  rarity: Rarity;
  title?: string;
  amount: number;
  resource?: ResourceKind;
  index?: number;
  className?: string;
}) {
  const r = RARITY[rarity];
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, rotateX: -8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 220, damping: 20 }}
      className={cn(
        "relative flex w-full flex-col items-center gap-3 rounded-3xl border border-border/70 p-4 text-center",
        "bevel-highlight",
        r.glow,
        className,
      )}
    >
      {/* Cabecera de rareza con el color/gradiente correspondiente */}
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-x-0 top-0 h-1.5 rounded-t-3xl", r.bg)}
      />
      <div className={cn("mt-1 rounded-2xl p-0.5", r.bg)}>
        <CrystalIcon kind={resource} size="lg" glow={false} className="bg-background/40" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{title ?? r.label}</p>
        <p className="text-2xl font-black">x{amount}</p>
      </div>
    </motion.div>
  );
}
