import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { NovaAvatar } from "@/components/hud/NovaAvatar";
import type { ExplorerPoint } from "./types";

/**
 * NovaCompanion — companion seguidor de Nova para el overworld.
 *
 * Flota cerca del héroe siguiéndolo con un pequeño retraso (interpolación
 * suave), con aura de energía e idle animation. Cuando hay una interacción
 * cercana muestra un indicador ("!" / "...") como en un RPG clásico.
 *
 * Es puramente visual/narrativo: no interactúa ni afecta al gating.
 */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function NovaCompanion({
  target,
  indicator = null,
  size = 40,
}: {
  target: ExplorerPoint;
  /** Indicador flotante sobre Nova cuando hay algo cerca. */
  indicator?: "alert" | "hint" | null;
  size?: number;
}) {
  // Objetivo de Nova: ligeramente detrás y por encima del héroe.
  const targetRef = useRef(target);
  targetRef.current = { x: target.x - 8, y: target.y - 9 };

  const posRef = useRef<ExplorerPoint>(targetRef.current);
  const [pos, setPos] = useState<ExplorerPoint>(targetRef.current);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t = targetRef.current;
      const nx = lerp(posRef.current.x, t.x, 0.1);
      const ny = lerp(posRef.current.y, t.y, 0.1);
      // Evita re-render si apenas se ha movido.
      if (Math.abs(nx - posRef.current.x) > 0.02 || Math.abs(ny - posRef.current.y) > 0.02) {
        posRef.current = { x: nx, y: ny };
        setPos({ x: nx, y: ny });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    >
      {/* Aura de energía del conocimiento */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -z-10 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full blur-lg"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.16 230 / 0.55), transparent 70%)" }}
      />
      <NovaAvatar variant="icon" size={size} float />

      {/* Indicador tipo RPG cuando hay algo cerca */}
      {indicator && (
        <motion.span
          initial={{ opacity: 0, scale: 0.5, y: 2 }}
          animate={{ opacity: 1, scale: 1, y: [0, -3, 0] }}
          transition={{ y: { duration: 1, repeat: Infinity, ease: "easeInOut" }, default: { duration: 0.2 } }}
          className="absolute -right-1 -top-3 grid h-6 w-6 place-items-center rounded-full border-2 border-primary bg-background text-sm font-black text-primary shadow-deep"
        >
          {indicator === "alert" ? "!" : "…"}
        </motion.span>
      )}
    </div>
  );
}
