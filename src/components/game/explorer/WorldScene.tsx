import { forwardRef } from "react";
import { Gamepad2 } from "lucide-react";
import { ARTBOOK } from "@/lib/artbook";
import { WORLD_SCALE, type ExplorerPoint } from "./types";

/**
 * WorldScene — lienzo de una escena de mundo explorable con CÁMARA.
 *
 * Fase 4 — Ahora el mundo es un plano mayor que la ventana visible: el viewport
 * recorta el escenario y una cámara (transform translate) sigue al héroe, de
 * modo que caminar desplaza el mundo y da sensación de RPG top-down (estilo del
 * vídeo de referencia). La estructura es:
 *
 *   viewport (overflow-hidden)
 *     └─ world plane  ← más grande, se traslada con la cámara (forwardRef mide px)
 *          ├─ fondo (Key Art) + atmósfera
 *          ├─ sendero guía entre nodos
 *          └─ children  ← nodos, héroe y Nova (viven dentro del mundo)
 *     └─ overlay       ← HUD fijo (joystick, botón, minimapa, diálogo…)
 *
 * Es presentacional: los nodos, héroe y controles se pasan como props.
 */
export const WorldScene = forwardRef<
  HTMLDivElement,
  {
    background?: string;
    pathPoints?: ExplorerPoint[];
    hint?: string;
    /** Desplazamiento de la cámara en px (traslada el plano del mundo). */
    camera?: ExplorerPoint;
    /** HUD fijo al viewport (no se desplaza con la cámara). */
    overlay?: React.ReactNode;
    /** Contenido del mundo (nodos, héroe, Nova); se desplaza con la cámara. */
    children: React.ReactNode;
  }
>(function WorldScene(
  { background = ARTBOOK.keyArt, pathPoints = [], hint, camera = { x: 0, y: 0 }, overlay, children },
  ref,
) {
  const pathD = pathPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <div className="relative h-[58vh] min-h-[430px] w-full select-none overflow-hidden rounded-3xl border-2 border-primary/30 shadow-deep">
      {/* Plano del mundo: mayor que el viewport y trasladado por la cámara. */}
      <div
        ref={ref}
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          width: `${WORLD_SCALE * 100}%`,
          height: `${WORLD_SCALE * 100}%`,
          transform: `translate3d(${camera.x}px, ${camera.y}px, 0)`,
          transition: "transform 120ms linear",
          backgroundImage: `url(${background})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Atmósfera */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-hero opacity-70" />
        <div className="pointer-events-none absolute inset-0 bg-fog-void opacity-25" />

        {/* Sendero guía entre nodos */}
        {pathPoints.length > 1 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d={pathD}
              fill="none"
              stroke="oklch(0.62 0.2 190 / 45%)"
              strokeWidth={0.7}
              strokeDasharray="1.6 1.6"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {children}
      </div>

      {/* Viñeta suave para reforzar el foco en el héroe centrado. */}
      <div
        className="pointer-events-none absolute inset-0 z-20"
        style={{ boxShadow: "inset 0 0 120px 20px oklch(0.12 0.05 265 / 0.55)" }}
      />

      {/* Aviso de controles */}
      {hint && (
        <div className="pointer-events-none absolute left-3 top-3 z-30 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur">
          <Gamepad2 className="h-3.5 w-3.5 text-primary" /> {hint}
        </div>
      )}

      {/* HUD fijo (no se desplaza con la cámara). */}
      {overlay}
    </div>
  );
});
