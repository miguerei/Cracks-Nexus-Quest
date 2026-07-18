// battle3d/BattleStageBackdrop.tsx — montaje seguro del escenario de combate.
//
// El UI DOM del reto es completo por sí mismo: si WebGL falla o aún carga,
// aquí degradamos a null y el reto sigue perfectamente jugable. La escena
// (three/R3F) solo se importa lazy y solo en el navegador (<ClientOnly>).

import { Component, Suspense, lazy, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { BattleStage3DProps } from "./types";

const BattleStage3D = lazy(() => import("./BattleStage3D"));

/** Si el canvas revienta (WebGL no disponible…), el fondo desaparece sin ruido. */
class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Fondo de combate del reto: capa fija detrás de todo el UI DOM.
 * Incluye un velo inferior degradado para que preguntas y botones
 * (que van encima) mantengan el contraste y la legibilidad.
 */
export function BattleStageBackdrop(props: BattleStage3DProps) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
      <StageBoundary>
        <ClientOnly fallback={null}>
          <Suspense fallback={null}>
            <BattleStage3D {...props} />
          </Suspense>
        </ClientOnly>
      </StageBoundary>
      {/* Velo de legibilidad: oscurece la mitad inferior, donde vive el UI */}
      <div className="absolute inset-0 bg-background/15" />
      <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-background/85 via-background/40 to-transparent" />
    </div>
  );
}
