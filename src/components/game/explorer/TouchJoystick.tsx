import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * TouchJoystick — mando analógico para móvil. Devuelve un vector normalizado
 * (-1..1) en cada movimiento y (0,0) al soltar. No captura eventos de teclado;
 * convive con WASD/flechas.
 */
export function TouchJoystick({
  onChange,
  className,
  size = 116,
}: {
  onChange: (x: number, y: number) => void;
  className?: string;
  size?: number;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const radius = size / 2;
  const maxKnob = radius - 22;

  const move = (clientX: number, clientY: number) => {
    if (!origin.current) return;
    let dx = clientX - origin.current.x;
    let dy = clientY - origin.current.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxKnob) {
      dx = (dx / dist) * maxKnob;
      dy = (dy / dist) * maxKnob;
    }
    setKnob({ x: dx, y: dy });
    onChange(dx / maxKnob, dy / maxKnob);
  };

  const reset = () => {
    origin.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={baseRef}
      className={cn(
        "relative grid touch-none place-items-center rounded-full border border-primary/40 bg-background/40 backdrop-blur transition",
        active && "bg-background/60",
        className,
      )}
      style={{ width: size, height: size }}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const rect = baseRef.current!.getBoundingClientRect();
        origin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        setActive(true);
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => active && move(e.clientX, e.clientY)}
      onPointerUp={reset}
      onPointerCancel={reset}
      onPointerLeave={() => active && reset()}
      aria-label="Mando de movimiento"
      role="application"
    >
      <div
        className="pointer-events-none grid h-11 w-11 place-items-center rounded-full border-2 border-primary/70 bg-gradient-nexus text-primary-foreground shadow-deep"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      >
        <span className="text-[10px] font-black uppercase tracking-wider">MOVER</span>
      </div>
    </div>
  );
}
