// world3d/MusicToggle.tsx — toggle 🎵 de la música ambiental procedural.
//
// Componente DOM puro (sin three): seguro de importar desde cualquier ruta.
// Misma filosofía que QualityToggle: si llega `className` se delega TODO el
// estilo al consumidor; el estado apagado se marca atenuando el botón.
// El click ES el gesto de usuario que permite crear el AudioContext (music.ts).

import { useState } from "react";
import { cn } from "@/lib/utils";
import { music } from "@/lib/music";

export function MusicToggle({ className, label = false }: { className?: string; label?: boolean }) {
  const [on, setOn] = useState(() => music.isOn());

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Apagar la música ambiental" : "Encender la música ambiental"}
      title={on ? "Apagar música" : "Encender música"}
      onClick={() => {
        const next = !on;
        music.setOn(next);
        setOn(next);
      }}
      className={cn(className, !on && "opacity-50 grayscale")}
    >
      <span aria-hidden="true">🎵</span>
      {label ? <span className="ml-1">Música: {on ? "Sí" : "No"}</span> : null}
    </button>
  );
}
