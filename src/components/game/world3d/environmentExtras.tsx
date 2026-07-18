// Fase 5 — Piezas compartidas por varios entornos (fuera del kit base).
//
// ObstacleShells: la escena dibuja los obstáculos del layout como "roca con
// musgo" (estilo Bosque) en todos los mundos con entorno propio. Cada bioma
// los recubre con una carcasa temática ligeramente mayor para que la misma
// colisión luzca como bloque de servidor, ruina de arena, cuarzo u obsidiana.
//
// Flock: bandada low-poly (gaviotas, aves) que orbita el mapa a gran altura.
// Todo determinista y sin luces nuevas.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { WorldLayout } from "./worldConfig";

// ---------------------------------------------------------------------------
// Carcasa temática sobre los obstáculos del layout. La roca base de la escena
// mide 0.62·size (más casquete a 0.38·h): estas medidas la cubren siempre.
// ---------------------------------------------------------------------------
export function ObstacleShells({
  obstacles,
  color,
  capColor,
  emissive,
  emissiveIntensity = 0,
  kind = "rock",
}: {
  obstacles: WorldLayout["obstacles"];
  color: string;
  /** Casquete superior (tapa el musgo verde de la escena). */
  capColor: string;
  emissive?: string;
  emissiveIntensity?: number;
  /** Silueta: roca facetada, bloque tallado o cristal. */
  kind?: "rock" | "block" | "crystal";
}) {
  return (
    <group>
      {obstacles.map((o, i) => (
        // Misma posición y rotación que usa la escena para su roca (i * 1.7).
        <group key={i} position={[o.pos[0], o.size[1] / 2, o.pos[1]]} rotation={[0, i * 1.7, 0]}>
          <mesh castShadow receiveShadow scale={[o.size[0] * 0.7, o.size[1] * 0.7, o.size[2] * 0.7]}>
            {kind === "block" ? (
              <boxGeometry args={[1.1, 1.1, 1.1]} />
            ) : kind === "crystal" ? (
              <octahedronGeometry args={[0.95, 0]} />
            ) : (
              <dodecahedronGeometry args={[1, 0]} />
            )}
            <meshStandardMaterial
              color={color}
              flatShading
              roughness={1}
              emissive={emissive ?? "#000000"}
              emissiveIntensity={emissive ? emissiveIntensity : 0}
            />
          </mesh>
          {/* Casquete: cubre el musgo del Bosque con el material del bioma. */}
          <mesh
            position={[0, o.size[1] * 0.38, 0]}
            scale={[o.size[0] * 0.5, o.size[1] * 0.24, o.size[2] * 0.5]}
          >
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color={capColor} flatShading roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bandada que sobrevuela el mapa en círculos (planos batientes, como en el
// Bosque). Parametrizable en color, radio y altura para gaviotas o aves.
// ---------------------------------------------------------------------------
export function Flock({
  color,
  radius = 50,
  height = 20,
  speed = 0.055,
  phase = 0,
}: {
  color: string;
  radius?: number;
  height?: number;
  speed?: number;
  phase?: number;
}) {
  const flock = useRef<THREE.Group>(null);
  const wings = useRef<(THREE.Mesh | null)[]>([]);
  const offsets: [number, number, number][] = [
    [0, 0, 0],
    [-2.2, 0.4, 1.6],
    [2.2, 0.3, 1.7],
    [-4.2, 0.8, 3.4],
    [4.4, 0.6, 3.5],
  ];
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (flock.current) {
      const a = t * speed + phase;
      flock.current.position.set(Math.cos(a) * radius, height + Math.sin(t * 0.3 + phase) * 2.2, Math.sin(a) * radius);
      flock.current.rotation.y = -a - Math.PI / 2;
    }
    wings.current.forEach((w, i) => {
      if (w) w.rotation.x = Math.sin(t * 7 + i + phase) * 0.7;
    });
  });
  return (
    <group ref={flock}>
      {offsets.map((o, i) => (
        <mesh key={i} ref={(el) => (wings.current[i] = el)} position={o}>
          <planeGeometry args={[1.5, 0.34]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} fog={false} />
        </mesh>
      ))}
    </group>
  );
}
