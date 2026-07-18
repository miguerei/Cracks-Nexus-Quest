// battle3d/stageActors.tsx — actores humanoides del escenario de combate.
//
// StageActor intenta usar el modelo ANIMADO de characters3d (Adventurer, rig
// KayKit con animaciones reales: Spellcast_Shoot, Hit_A, Cheer, Death_A…) y
// degrada al HeroModel procedural actual si:
//   a) src/components/game/world3d/characters3d.tsx aún no existe
//      (import.meta.glob devuelve vacío → el build NUNCA se rompe), o
//   b) la carga del módulo/GLB falla en runtime (boundary + Suspense).
//
// OJO al rig: el origen del KayKit está en los PIES; el del HeroModel, en la
// CADERA. El ajuste (-HERO_HIP_Y) vive aquí para que la escena componga ambos
// modelos con el mismo grupo exterior sin saber cuál cargó.

import { Component, Suspense, lazy, useRef, type ComponentType, type MutableRefObject, type ReactNode } from "react";
import type { HeroLook } from "../worldConfig";
import { HeroModel } from "./heroLink";
import { HERO_HIP_Y } from "./stageConfig";

/** Poses del rig animado (characters3d). En "stage" vuelve solo a Idle. */
export type StagePose = "idle" | "cast" | "hit" | "cheer" | "defeat";

/** Firma pública del Adventurer que entrega characters3d (otro agente). */
export type AdventurerProps = {
  classId?: string;
  variant?: "hero" | "npc" | "rival";
  mode: "world" | "stage";
  pose?: StagePose;
  poseN?: number;
  accent?: string;
  scale?: number;
  /** El rig gira solo (suavizado) hacia este ángulo Y. */
  facingRef?: MutableRefObject<number>;
  /** Qué renderizar si el GLB falla al cargar (su límite interno lo captura). */
  fallback?: ReactNode;
};

export type StageActorProps = {
  /** Quién es: héroe del jugador o rival humanoide. */
  variant: "hero" | "rival";
  classId?: string;
  /** Color de cuerpo para el fallback procedural. */
  bodyColor: string;
  /** Color de acento (prop, energía). */
  accent: string;
  /** Look canónico para el fallback procedural. */
  look: HeroLook;
  /** Pose animada actual; `poseN` re-dispara la misma pose. */
  pose: StagePose;
  poseN: number;
  /** Ángulo Y al que mira el actor (estático en el stage). */
  facingRef?: MutableRefObject<number>;
};

// El glob NO falla si el fichero no existe: clave ausente ⇒ fallback.
// Cuando characters3d.tsx aparezca, el siguiente build lo recoge solo.
const CHAR_MODULES = import.meta.glob<{ Adventurer?: ComponentType<AdventurerProps> }>(
  "../characters3d.tsx",
);

/** Fallback: el HeroModel procedural de siempre (origen en la cadera). */
function FallbackActor(p: StageActorProps) {
  const speedRef = useRef(0);
  return (
    <HeroModel
      bodyColor={p.bodyColor}
      accent={p.accent}
      look={p.look}
      variant={p.variant}
      speedRef={speedRef}
      facingRef={p.facingRef}
      classId={p.classId}
    />
  );
}

/** Envuelve al Adventurer real bajando el rig KayKit de la cadera a los pies. */
function makeAdventurerActor(Adventurer: ComponentType<AdventurerProps>): ComponentType<StageActorProps> {
  return function AdventurerActor(p: StageActorProps) {
    return (
      <group position={[0, -HERO_HIP_Y, 0]}>
        <Adventurer
          mode="stage"
          classId={p.classId}
          variant={p.variant}
          pose={p.pose}
          poseN={p.poseN}
          accent={p.accent}
          facingRef={p.facingRef}
          // Si el GLB falla (404, corrupto…), su límite interno renderiza esto:
          // el HeroModel procedural, devuelto a su origen de cadera.
          fallback={
            <group position={[0, HERO_HIP_Y, 0]}>
              <FallbackActor {...p} />
            </group>
          }
        />
      </group>
    );
  };
}

const LazyActor = lazy(async () => {
  const loader = CHAR_MODULES["../characters3d.tsx"];
  if (loader) {
    try {
      const mod = await loader();
      if (mod.Adventurer) return { default: makeAdventurerActor(mod.Adventurer) };
    } catch {
      // characters3d roto o GLB inaccesible: seguimos con el procedural.
    }
  }
  return { default: FallbackActor };
});

/** Si el rig animado revienta al renderizar, volvemos al procedural. */
class ActorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Actor humanoide del stage: Adventurer animado si está disponible,
 * HeroModel procedural en cualquier otro caso (carga, ausencia o error).
 */
export function StageActor(props: StageActorProps) {
  const fallback = <FallbackActor {...props} />;
  return (
    <ActorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LazyActor {...props} />
      </Suspense>
    </ActorBoundary>
  );
}
