// battle3d/heroLink.tsx — puente hacia el modelo canónico del héroe.
//
// Reusamos el HeroModel de World3DScene (lo exporta como named export otro
// agente en esta misma oleada). Mientras ese export no exista, degradamos a
// un placeholder mínimo con la misma silueta de color, sin romper el build:
// el acceso por clave computada evita que Rollup falle por export ausente.

import { useRef, type ComponentType, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import * as World3DSceneModule from "../World3DScene";
import type { HeroLook } from "../worldConfig";

export type HeroModelProps = {
  bodyColor: string;
  accent: string;
  look: HeroLook;
  variant: "hero" | "npc" | "rival";
  /** ref con la magnitud de velocidad horizontal (0..1). */
  speedRef?: MutableRefObject<number>;
  /** ref con el ángulo de rotación Y objetivo. */
  facingRef?: MutableRefObject<number>;
  /** Clase del avatar (prop opcional del HeroModel canónico). */
  classId?: string;
};

/** Placeholder mínimo: cápsula + cabeza + orbe de acento, con giro suave. */
function PlaceholderHeroModel({ bodyColor, accent, facingRef }: HeroModelProps) {
  const root = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    const g = root.current;
    if (!g) return;
    // Respiración sutil + giro suavizado hacia el objetivo.
    g.position.y = Math.sin(state.clock.elapsedTime * 2.1) * 0.015;
    if (facingRef) {
      const target = facingRef.current;
      let delta = target - g.rotation.y;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      g.rotation.y += delta * Math.min(1, dt * 12);
    }
  });
  return (
    <group ref={root}>
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.32, 0.9, 6, 12]} />
        <meshStandardMaterial color={bodyColor} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <sphereGeometry args={[0.28, 16, 14]} />
        <meshStandardMaterial color="#f3d5b5" roughness={0.55} />
      </mesh>
      {/* Orbe de energía en la mano dominante */}
      <mesh position={[0.4, 0.1, 0]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} />
      </mesh>
      <pointLight color={accent} intensity={3} distance={5} position={[0, 0.5, 0]} />
    </group>
  );
}

/** HeroModel real si ya está exportado; placeholder si aún no. */
export const HeroModel: ComponentType<HeroModelProps> =
  ((World3DSceneModule as unknown as Record<string, unknown>).HeroModel as
    | ComponentType<HeroModelProps>
    | undefined) ?? PlaceholderHeroModel;
