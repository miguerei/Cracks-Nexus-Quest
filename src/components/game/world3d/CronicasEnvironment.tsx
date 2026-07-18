// Fase 5 — Desierto dorado de las Crónicas.
//
// Dirección de arte (§8): arena + oro + atardecer. Dunas en el horizonte,
// círculo de obeliscos, un coloso de piedra dorada, estandartes al viento y
// una garganta de arena que fluye, cruzada SOLO por un paso de losas.
// Ruta del layout: entrada sur → estandartes → garganta → obeliscos →
// coloso → oasis/claro → portal → altar del Vacío.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

import { samplePath } from "./BosqueEnvironment";
import { ObstacleShells } from "./environmentExtras";
import {
  buildCurve,
  FlowPlane,
  KitBankRocks,
  KitGround,
  KitGroundFog,
  KitParticles,
  KitPath,
  KitPedestal,
  KitPortalFrame,
  KitScatter,
  KitSealedZone,
  KitSky,
  KitSkyline,
  KitVoidAltar,
  KitWalkway,
  makeGroundHeightFn,
  vnoise,
} from "./environmentKit";
import { getWorldLayout, WORLD_CROSSINGS } from "./worldConfig";

const SEED = 222;
const LAYOUT = getWorldLayout("cronicas");
const HALF = LAYOUT.groundHalf;
const CROSS = WORLD_CROSSINGS.cronicas;

// Atardecer: el sol dorado cae bajo por el noroeste.
export const CRONICAS_SUN: [number, number, number] = [-0.55, 0.48, -0.38];

const heightFn = makeGroundHeightFn({
  half: HALF,
  crossZ: CROSS.z,
  carveDepth: 1.4,
  carveWidth: CROSS.half + 1,
  rimHeight: 4.2,
  rimNoise: 2,
});

// Senda de caravana: pasa por el vano de la garganta (x=-5).
const PATH_POINTS: [number, number][] = [
  [0, 25.5], [-3, 20], [-8, 16], [-12, 13], [-10, 10.2], [-5, 8.8],
  [-5, 6.5], [-5, 4.2], [-1, 2.2], [4, 0.5], [9, -1], [4, -3.5],
  [-2, -5], [-7, -7], [-3, -9], [2, -10.5], [8, -12], [13, -13],
  [9, -14.5], [5, -15], [0, -14.8], [-4, -14], [-9, -16], [-15, -19],
  [-10, -21], [-5, -22.2], [0, -23],
];
const curve = buildCurve(PATH_POINTS);
const pathSamples = samplePath(curve);
const avoidSpots: [number, number][] = [
  ...pathSamples,
  ...LAYOUT.missionSpots,
  LAYOUT.decorSpots.npc,
  LAYOUT.decorSpots.rival,
  LAYOUT.decorSpots.portal,
  LAYOUT.decorSpots.blocked,
];

// Arena con ondas de duna y garganta oscurecida.
const C_SAND = new THREE.Color("#cfa763");
const C_SAND2 = new THREE.Color("#e0bd7d");
const C_RIPPLE = new THREE.Color("#e9cf95");
const C_CARVE = new THREE.Color("#8a6a3c");
function groundColor(x: number, z: number, y: number, out: THREE.Color) {
  const n = vnoise(x * 0.7, z * 0.7) * 0.5 + 0.5;
  out.copy(C_SAND).lerp(C_SAND2, n);
  // Ondas de viento sobre la arena (solo color, el relieve es ≤0.1).
  const ripple = Math.sin(x * 1.1 + z * 0.35) * 0.5 + 0.5;
  if (ripple > 0.78) out.lerp(C_RIPPLE, 0.35);
  if (y < -0.3) out.lerp(C_CARVE, Math.min(1, -y * 0.85));
  if (y > 1.2) out.lerp(C_RIPPLE, Math.min(1, (y - 1.2) * 0.2));
}

// ---------------------------------------------------------------------------
// Obelisco: aguja de piedra dorada con franja de glifos emisivos y remate de
// oro. Sólido (collider caja) y siempre fuera de la senda.
// ---------------------------------------------------------------------------
function Obelisco({ x, z, h = 7, rotY = 0 }: { x: number; z: number; h?: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.75, h / 2, 0.75]} position={[0, h / 2, 0]} />
      </RigidBody>
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.9, 0.5, 1.9]} />
        <meshStandardMaterial color="#a3764a" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, h / 2 + 0.3, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.82, h, 4]} />
        <meshStandardMaterial color="#c9a25e" flatShading roughness={0.95} />
      </mesh>
      {/* Franja de glifos: crónicas grabadas que aún brillan. */}
      <mesh position={[0, h * 0.5, 0.62]}>
        <boxGeometry args={[0.22, h * 0.62, 0.06]} />
        <meshStandardMaterial color="#f4c542" emissive="#f4c542" emissiveIntensity={1.25} roughness={0.5} />
      </mesh>
      <mesh position={[0, h + 0.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.55, 0.9, 4]} />
        <meshStandardMaterial color="#f4c542" emissive="#b98a3a" emissiveIntensity={0.7} metalness={0.5} roughness={0.35} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Coloso de las Crónicas: guardián sedente de piedra con ojos de oro. La
// estatua es colosal pero su colisión es un cilindro justo (fuera de senda).
// ---------------------------------------------------------------------------
function Coloso({ x, z, face = 0.5 }: { x: number; z: number; face?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, face, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[3, 2.4]} position={[0, 3, 0]} />
      </RigidBody>
      {/* Trono/base hundido en la arena. */}
      <mesh position={[0, 0.7, -0.6]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 1.6, 3.4]} />
        <meshStandardMaterial color="#a3764a" flatShading roughness={1} />
      </mesh>
      {/* Piernas y torso. */}
      {[-1.15, 1.15].map((sx) => (
        <mesh key={sx} position={[sx, 1.15, 1]} castShadow>
          <boxGeometry args={[1.15, 1.4, 2.2]} />
          <meshStandardMaterial color="#b8905a" flatShading roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 3.1, -0.5]} castShadow>
        <boxGeometry args={[3.4, 3.4, 2.2]} />
        <meshStandardMaterial color="#c9a25e" flatShading roughness={1} />
      </mesh>
      {/* Brazos apoyados en las rodillas. */}
      {[-1.95, 1.95].map((sx) => (
        <mesh key={sx} position={[sx, 2.4, 0.5]} rotation={[0.5, 0, 0]} castShadow>
          <boxGeometry args={[0.8, 2.4, 0.8]} />
          <meshStandardMaterial color="#b8905a" flatShading roughness={1} />
        </mesh>
      ))}
      {/* Cabeza con tocado y ojos que aún guardan memoria. */}
      <mesh position={[0, 5.5, -0.5]} castShadow>
        <boxGeometry args={[1.7, 1.6, 1.5]} />
        <meshStandardMaterial color="#c9a25e" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 6.45, -0.7]} castShadow>
        <boxGeometry args={[2.3, 0.5, 1.7]} />
        <meshStandardMaterial color="#f4c542" metalness={0.5} roughness={0.4} flatShading />
      </mesh>
      {[-0.42, 0.42].map((sx) => (
        <mesh key={sx} position={[sx, 5.55, 0.28]}>
          <boxGeometry args={[0.26, 0.14, 0.08]} />
          <meshStandardMaterial color="#f4c542" emissive="#f4c542" emissiveIntensity={1.3} />
        </mesh>
      ))}
      {/* Tablilla de crónicas sobre el regazo. */}
      <mesh position={[0, 2.05, 1.1]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[1.6, 0.14, 1.1]} />
        <meshStandardMaterial color="#e9cf95" emissive="#b98a3a" emissiveIntensity={0.5} roughness={0.6} flatShading />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Estandarte: mástil con paño que ondea al viento del desierto. Sin colisión
// (poste fino, decorativo).
// ---------------------------------------------------------------------------
function Estandarte({ x, z, phase = 0 }: { x: number; z: number; phase?: number }) {
  const cloth = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!cloth.current) return;
    const t = state.clock.elapsedTime;
    cloth.current.rotation.y = Math.sin(t * 1.6 + phase) * 0.22;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.9, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 3.8, 6]} />
        <meshStandardMaterial color="#6f5330" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 3.9, 0]}>
        <sphereGeometry args={[0.14, 6, 5]} />
        <meshStandardMaterial color="#f4c542" emissive="#b98a3a" emissiveIntensity={0.8} metalness={0.5} roughness={0.4} />
      </mesh>
      <group position={[0, 3.15, 0]}>
        <mesh ref={cloth} position={[0.62, 0, 0]} castShadow>
          <planeGeometry args={[1.2, 1.7, 4, 1]} />
          <meshStandardMaterial color="#a3342e" side={THREE.DoubleSide} roughness={1} />
        </mesh>
      </group>
      <mesh position={[0.62, 3.15, 0.012]}>
        <circleGeometry args={[0.24, 8]} />
        <meshStandardMaterial color="#f4c542" emissive="#f4c542" emissiveIntensity={1.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Entorno raíz del Desierto. Debe montarse DENTRO de <Physics>.
// ---------------------------------------------------------------------------
export default function CronicasEnvironment() {
  const obeliskRing = useMemo(() => {
    // Círculo de obeliscos alrededor del cristal 2 [9,-1], dejando libre el
    // lado oeste (por donde entra y sale la senda).
    const cx = LAYOUT.missionSpots[1][0];
    const cz = LAYOUT.missionSpots[1][1];
    const angles = [-2.1, -1.05, -0.35, 0.35, 1.05, 2.1];
    return angles.map((a, i) => ({
      x: cx + Math.cos(a) * 4.8,
      z: cz + Math.sin(a) * 4.8,
      h: 6 + (i % 3),
      rotY: -a,
    }));
  }, []);
  return (
    <group>
      <KitSky
        zenith="#3a5a8e"
        mid="#e0955e"
        horizon="#f6c878"
        sunColor="#ffd98a"
        sunDir={CRONICAS_SUN}
        sunPow={60}
        halo={0.4}
      />
      {/* Horizonte: dunas suaves y mesetas lejanas doradas. */}
      <KitSkyline
        seed={SEED + 1}
        rings={[
          { count: 15, radius: 52, spread: 18, hMin: 6, hMax: 12, rMin: 9, rMax: 16, color: "#caa268", sides: 6, sink: 5 },
          { count: 10, radius: 80, spread: 22, hMin: 9, hMax: 17, rMin: 8, rMax: 14, color: "#b8905a", kind: "box", sink: 7 },
        ]}
      />
      <KitGround half={HALF} heightFn={heightFn} colorFn={groundColor} />
      <KitPath curve={curve} heightFn={heightFn} colorA="#d9b878" colorB="#c2a05c" seed={SEED + 2} />
      {/* Garganta de arena dorada que fluye lenta bajo el paso de losas. */}
      <FlowPlane
        width={HALF * 2 + 8}
        length={CROSS.half * 2 + 1.6}
        position={[0, -0.5, CROSS.z]}
        deep="#8a6a3c"
        light="#e8c878"
        speed={0.28}
        alpha={0.96}
      />
      <KitWalkway
        crossing={CROSS}
        colorA="#c9a25e"
        colorB="#a3764a"
        railColor="#8a6a3c"
        railGem="#f4c542"
        seed={SEED + 3}
      />
      <KitBankRocks crossing={CROSS} half={HALF} heightFn={heightFn} color="#a3764a" seed={SEED + 4} />
      {/* Hitos: círculo de obeliscos, coloso y estandartes de caravana. */}
      {obeliskRing.map((o, i) => (
        <Obelisco key={i} x={o.x} z={o.z} h={o.h} rotY={o.rotY} />
      ))}
      <Coloso x={-13} z={-4.5} face={0.7} />
      <Estandarte x={-15.5} z={15} phase={0} />
      <Estandarte x={-16.5} z={10.5} phase={1.2} />
      <Estandarte x={3.5} z={21.5} phase={0.6} />
      <Estandarte x={-6.5} z={22.5} phase={1.8} />
      <Estandarte x={16} z={-8} phase={2.4} />
      {LAYOUT.missionSpots.slice(0, 4).map(([sx, sz], i) => (
        <KitPedestal key={i} x={sx} z={sz} stone="#c9a25e" stoneDark="#a3764a" ringColor="#f4c542" ringIntensity={1.3} />
      ))}
      <KitVoidAltar x={LAYOUT.missionSpots[4][0]} z={LAYOUT.missionSpots[4][1]} seed={SEED + 9} />
      <KitSealedZone x={LAYOUT.decorSpots.blocked[0]} z={LAYOUT.decorSpots.blocked[1]} seed={SEED + 10} />
      <KitPortalFrame x={LAYOUT.decorSpots.portal[0]} z={LAYOUT.decorSpots.portal[1]} stone="#c9a25e" stoneDark="#a3764a" gemColor="#f4c542" />
      <ObstacleShells obstacles={LAYOUT.obstacles} color="#b8905a" capColor="#cfa763" kind="block" />
      {/* Ruinas menudas tragadas por la arena (fuera de la ruta). */}
      <KitScatter
        seed={SEED + 11}
        count={40}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<boxGeometry args={[1, 0.7, 0.8]} />}
        color="#b8905a"
        colorB="#8a6a3c"
        sMin={0.4}
        sMax={1.3}
        sink={0.3}
        avoidDist={2}
      />
      {/* Cardos secos del desierto. */}
      <KitScatter
        seed={SEED + 12}
        count={34}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<coneGeometry args={[0.5, 1.1, 5]} />}
        color="#8f8050"
        colorB="#6f6338"
        sMin={0.35}
        sMax={0.8}
        avoidDist={1.7}
      />
      <KitGroundFog
        seed={SEED + 13}
        patches={[
          { count: 5, cx: LAYOUT.missionSpots[4][0], cz: LAYOUT.missionSpots[4][1], rx: 5, rz: 4, color: "#8d78d8", opacity: 0.3 },
          { count: 4, cx: LAYOUT.decorSpots.blocked[0], cz: LAYOUT.decorSpots.blocked[1], rx: 4, rz: 4, color: "#8d78d8", opacity: 0.34 },
          { count: 6, cx: 0, cz: CROSS.z, rx: HALF - 4, rz: 2.5, color: "#f0d8a0", opacity: 0.16 },
        ]}
      />
      {/* Polvo dorado en suspensión, encendido por el atardecer. */}
      <KitParticles
        seed={SEED + 14}
        count={95}
        rx={HALF - 3}
        rz={HALF - 3}
        yMin={0.5}
        yMax={4.5}
        colors={["#f4c542", "#ffe08a", "#f0d089"]}
        size={0.2}
        opacity={0.55}
        mode="drift"
        speed={0.6}
      />
    </group>
  );
}
