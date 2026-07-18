import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_BOUNDS, type ExplorerBounds, type ExplorerPoint } from "./types";

type DirKey = "up" | "down" | "left" | "right";

/**
 * PlayerController — motor de movimiento reutilizable para la exploración 2D.
 *
 * Une tres fuentes de entrada en un único vector por frame:
 *  - teclado (WASD / flechas)
 *  - mando táctil analógico (joystick)
 *  - d-pad direccional (por si se prefiere)
 *
 * Solo re-renderiza cuando el héroe se mueve de verdad o cambia de estado
 * (parado ↔ moviéndose, mira izquierda ↔ derecha), para no castigar el móvil.
 * Expone además una tecla de acción (Enter / Espacio) que dispara `onInteract`.
 */
export function usePlayerController({
  start = { x: 50, y: 90 },
  speed = 0.75,
  bounds = DEFAULT_BOUNDS,
  onInteract,
  paused = false,
}: {
  start?: ExplorerPoint;
  speed?: number;
  bounds?: ExplorerBounds;
  onInteract?: () => void;
  /** Cuando es true, se ignora todo movimiento y la tecla de acción (p. ej. mientras hay un diálogo abierto). */
  paused?: boolean;
} = {}) {
  const posRef = useRef<ExplorerPoint>(start);
  const [pos, setPos] = useState<ExplorerPoint>(start);
  const [moving, setMoving] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);

  const dir = useRef<Record<DirKey, boolean>>({ up: false, down: false, left: false, right: false });
  const analog = useRef<ExplorerPoint>({ x: 0, y: 0 });

  // Refs espejo para leer estado sin re-suscribir el loop.
  const movingRef = useRef(false);
  const facingRef = useRef<1 | -1>(1);
  const interactRef = useRef(onInteract);
  interactRef.current = onInteract;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Bucle de movimiento (rAF). Combina teclado + joystick + d-pad.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (pausedRef.current) {
        if (movingRef.current) {
          movingRef.current = false;
          setMoving(false);
        }
        raf = requestAnimationFrame(loop);
        return;
      }
      const d = dir.current;
      let vx = analog.current.x + (d.left ? -1 : 0) + (d.right ? 1 : 0);
      let vy = analog.current.y + (d.up ? -1 : 0) + (d.down ? 1 : 0);
      const mag = Math.hypot(vx, vy);

      if (mag > 0.06) {
        if (mag > 1) {
          vx /= mag;
          vy /= mag;
        }
        let { x, y } = posRef.current;
        x = Math.min(bounds.maxX, Math.max(bounds.minX, x + vx * speed));
        y = Math.min(bounds.maxY, Math.max(bounds.minY, y + vy * speed));
        posRef.current = { x, y };
        setPos({ x, y });
        if (!movingRef.current) {
          movingRef.current = true;
          setMoving(true);
        }
        const nf: 1 | -1 = vx < -0.06 ? -1 : vx > 0.06 ? 1 : facingRef.current;
        if (nf !== facingRef.current) {
          facingRef.current = nf;
          setFacing(nf);
        }
      } else if (movingRef.current) {
        movingRef.current = false;
        setMoving(false);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speed, bounds.maxX, bounds.maxY, bounds.minX, bounds.minY]);

  // Teclado: movimiento + acción.
  useEffect(() => {
    const map = (k: string): DirKey | null => {
      switch (k) {
        case "ArrowUp":
        case "w":
        case "W":
          return "up";
        case "ArrowDown":
        case "s":
        case "S":
          return "down";
        case "ArrowLeft":
        case "a":
        case "A":
          return "left";
        case "ArrowRight":
        case "d":
        case "D":
          return "right";
      }
      return null;
    };
    const down = (e: KeyboardEvent) => {
      if (pausedRef.current) return; // el diálogo gestiona el teclado.
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        interactRef.current?.();
        return;
      }
      const key = map(e.key);
      if (key) {
        dir.current[key] = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = map(e.key);
      if (key) dir.current[key] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const setAnalog = useCallback((x: number, y: number) => {
    analog.current = { x, y };
  }, []);

  const setDir = useCallback((key: DirKey, value: boolean) => {
    dir.current[key] = value;
  }, []);

  /** Handlers "hold to move" para un botón del d-pad. */
  const bindDpad = useCallback(
    (key: DirKey) => ({
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        dir.current[key] = true;
      },
      onPointerUp: () => (dir.current[key] = false),
      onPointerLeave: () => (dir.current[key] = false),
      onPointerCancel: () => (dir.current[key] = false),
    }),
    [],
  );

  return { pos, moving, facing, setAnalog, setDir, bindDpad };
}
