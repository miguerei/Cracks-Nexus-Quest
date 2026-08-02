// battle3d/VoidMotes.tsx — motas de Vacío suspendidas por TODO el encuadre.
//
// FASE 11 (fotograma GAMEPLAY): partículas violetas flotando por toda la
// escena, no solo junto al coloso — es lo que más vende la lámina. UN solo
// THREE.Points por stage (una draw call), determinista (mulberry32), drift
// lento por refs en useFrame (jamás setState). Material aditivo translúcido
// sin depthWrite: exento del cel-shading y entra suave en el bloom.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "./battleUtils";

const VIOLETA_MOTA = "#b06cf7";

/** Volumen que cubre todo el encuadre (del primer término al fondo). */
const X_MAX = 13;
const Y_MIN = 0.25;
const Y_MAX = 9.5;
const Z_MIN = -16;
const Z_MAX = 7;

type MoteData = {
  baseX: Float32Array;
  baseZ: Float32Array;
  phase: Float32Array;
  sway: Float32Array;
  rise: Float32Array;
};

export default function VoidMotes({ count, seed = 90511 }: { count: number; seed?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geo, mat, data } = useMemo(() => {
    const rnd = mulberry32(seed);
    const pos = new Float32Array(count * 3);
    const data: MoteData = {
      baseX: new Float32Array(count),
      baseZ: new Float32Array(count),
      phase: new Float32Array(count),
      sway: new Float32Array(count),
      rise: new Float32Array(count),
    };
    for (let i = 0; i < count; i++) {
      data.baseX[i] = (rnd() * 2 - 1) * X_MAX;
      data.baseZ[i] = Z_MIN + rnd() * (Z_MAX - Z_MIN);
      data.phase[i] = rnd() * Math.PI * 2;
      data.sway[i] = 0.15 + rnd() * 0.4;
      data.rise[i] = 0.08 + rnd() * 0.22; // ascenso lento, casi ingrávido
      pos[i * 3] = data.baseX[i];
      pos[i * 3 + 1] = Y_MIN + rnd() * (Y_MAX - Y_MIN);
      pos[i * 3 + 2] = data.baseZ[i];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: VIOLETA_MOTA,
      size: 0.16,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat, data };
  }, [count, seed]);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame((state, dt) => {
    const points = pointsRef.current;
    if (!points) return;
    const t = state.clock.elapsedTime;
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const n = data.baseX.length;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      // Vaivén horizontal suave + ascenso lento con reciclaje por arriba.
      arr[j] = data.baseX[i] + Math.sin(t * 0.22 + data.phase[i]) * data.sway[i];
      let y = arr[j + 1] + data.rise[i] * dt;
      if (y > Y_MAX) y = Y_MIN;
      arr[j + 1] = y;
      arr[j + 2] = data.baseZ[i] + Math.cos(t * 0.17 + data.phase[i] * 1.7) * data.sway[i] * 0.6;
    }
    attr.needsUpdate = true;
    // Titileo colectivo muy sutil (amenaza sorda, no brillo alegre).
    mat.opacity = 0.62 + Math.sin(t * 0.9) * 0.13;
  });

  return <points ref={pointsRef} geometry={geo} material={mat} frustumCulled={false} />;
}
