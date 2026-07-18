// battle3d/SfxToggle.tsx — toggle discreto de efectos de sonido.
//
// Componente DOM puro (sin three): seguro de importar desde cualquier ruta.
// Vive junto al escenario de combate porque acompaña a sus eventos sonoros;
// se ancla abajo-derecha, por encima del backdrop y sin invadir el HUD.

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { sfx } from "@/lib/sfx";

export function SfxToggle() {
  const [on, setOn] = useState(() => sfx.isOn());

  return (
    <button
      type="button"
      aria-label={on ? "Silenciar efectos de sonido" : "Activar efectos de sonido"}
      title={on ? "Silenciar efectos" : "Activar efectos"}
      onClick={() => {
        const next = !on;
        sfx.setOn(next);
        setOn(next);
        if (next) sfx.play("click"); // confirma con un blip al reactivar
      }}
      className="fixed bottom-4 right-4 z-40 grid h-10 w-10 place-items-center rounded-full border border-border bg-card/70 text-muted-foreground backdrop-blur transition hover:border-primary/60 hover:text-foreground"
    >
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </button>
  );
}
