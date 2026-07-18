// Fase 5 — Cavernas de cristal (Laboratorio).
//
// Dirección de arte (§8): violeta claro + rosa + azul. Sin sol duro: una gruta
// luminosa donde la luz sale de cristales colosales, setas fosforescentes y
// esporas en suspensión. La grieta de cristal corta el mapa y SOLO se cruza
// por una pasarela de láminas de cuarzo. Ruta del layout: jardín de setas →
// grieta → sala de cristales → alambiques → claro → portal → altar del Vacío.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
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

const SEED = 333;
const LAYOUT = getWorldLayout("laboratorio");
const HALF = LAYOUT.groundHalf;
const CROSS = WORLD_CROSSINGS.laboratorio;

// "Sol" de caverna: un resplandor difuso que cae casi cenital.
export const LABORATORIO_SUN: [number, number, number] = [0.3, 0.85, -0.3];

const heightFn = makeGroundHeightFn({
  half: HALF,
  crossZ: CROSS.z,
  carveDepth: 1.3,
  carveWidth: CROSS.half + 1,
  rimHeight: 5,
  rimNoise: 2.2,
});

// Senda de la gruta: pasa por el vano de la grieta (x=3).
const PATH_POINTS: [number, number][] = [
  [0, 19.5], [2, 15.5], [6, 12.5], [9, 10], [7, 8.2], [3, 7.2],
  [3, 5], [3, 2.9], [-1, 1.4], [-4, 0.3], [-7, -1], [-3, -3],
  [1, -4], [5, -5], [1, -7], [-3, -8.5], [-7, -9.5], [-10, -10],
  [-7, -11], [-4, -11], [0, -10.6], [3, -10], [6, -12], [10, -14],
  [6, -15.6], [3, -16.4], [0, -17],
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

// Roca violeta con vetas de cuarzo claras y grieta hundida más oscura.
const C_ROCK = new THREE.Color("#3a2b58");
const C_ROCK2 = new THREE.Color("#4b3775");
const C_VEIN = new THREE.Color("#8a6ec0");
const C_CARVE = new THREE.Color("#221740");
function groundColor(x: number, z: number, y: number, out: THREE.Color) {
  const n = vnoise(x * 0.7, z * 0.7) * 0.5 + 0.5;
  out.copy(C_ROCK).lerp(C_ROCK2, n);
  if (vnoise(x * 1.9, z * 1.9) > 0.72) out.lerp(C_VEIN, 0.4);
  if (y < -0.3) out.lerp(C_CARVE, Math.min(1, -y * 0.9));
  if (y > 1.4) out.lerp(C_VEIN, Math.min(1, (y - 1.4) * 0.18));
}

// ---------------------------------------------------------------------------
// Cristal colosal: monolito emisivo con fragmentos satélite. Collider
// cilíndrico justo; siempre fuera de la senda.
// ---------------------------------------------------------------------------
function CristalColosal({
  x,
  z,
  h = 7,
  color,
  tilt = 0.12,
  rotY = 0,
}: {
  x: number;
  z: number;
  h?: number;
  color: string;
  tilt?: number;
  rotY?: number;
}) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[h * 0.3, h * 0.17]} position={[0, h * 0.3, 0]} />
      </RigidBody>
      {/* Cuerpo principal (octaedro estirado). */}
      <mesh position={[0, h * 0.42, 0]} rotation={[tilt, 0.4, -tilt]} scale={[h * 0.22, h * 0.55, h * 0.22]} castShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.35} flatShading roughness={0.3} />
      </mesh>
      {/* Fragmentos satélite clavados en la roca. */}
      {[0.9, 2.5, 4.2].map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * (h * 0.24 + 0.5), 0.55 + i * 0.2, Math.sin(a) * (h * 0.24 + 0.5)]}
          rotation={[0.3, a, 0.2]}
          scale={[0.3, 0.9 + i * 0.25, 0.3]}
          castShadow
        >
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} flatShading roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <cylinderGeometry args={[h * 0.26, h * 0.32, 0.36, 7]} />
        <meshStandardMaterial color="#2c2144" flatShading roughness={1} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Mesa de alambiques: banco de laboratorio con matraces burbujeantes (los
// líquidos suben y bajan). Collider de la mesa; junto al cristal 3.
// ---------------------------------------------------------------------------
function MesaAlambiques({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const bubbles = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!bubbles.current) return;
    const t = state.clock.elapsedTime;
    bubbles.current.children.forEach((c, i) => {
      c.scale.setScalar(0.9 + Math.sin(t * 2.2 + i * 1.7) * 0.12);
    });
  });
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.55, 1.6]} position={[0, 0.55, 0]} />
      </RigidBody>
      <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.9, 0.18, 1.3]} />
        <meshStandardMaterial color="#5a4482" flatShading roughness={0.8} />
      </mesh>
      {[-1.1, 1.1].map((sx) => (
        <mesh key={sx} position={[sx, 0.45, 0]} castShadow>
          <boxGeometry args={[0.3, 0.9, 1]} />
          <meshStandardMaterial color="#463366" flatShading roughness={1} />
        </mesh>
      ))}
      <group ref={bubbles}>
        {[
          { p: [-0.9, "#c084fc"] as const, r: 0.3 },
          { p: [0, "#f0a8d8"] as const, r: 0.38 },
          { p: [0.9, "#8ab6ff"] as const, r: 0.28 },
        ].map((b, i) => (
          <mesh key={i} position={[b.p[0], 1.35, 0]}>
            <sphereGeometry args={[b.r, 8, 6]} />
            <meshStandardMaterial
              color={b.p[1]}
              emissive={b.p[1]}
              emissiveIntensity={1.3}
              transparent
              opacity={0.85}
              roughness={0.25}
            />
          </mesh>
        ))}
      </group>
      {/* Tubos de vidrio entre matraces. */}
      <mesh position={[0, 1.62, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 1.9, 5]} />
        <meshStandardMaterial color="#c7b8e8" transparent opacity={0.5} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Entorno raíz de las Cavernas. Debe montarse DENTRO de <Physics>.
// ---------------------------------------------------------------------------
export default function LaboratorioEnvironment() {
  return (
    <group>
      {/* Bóveda de gruta: gradiente violeta con un resplandor difuso, no sol. */}
      <KitSky
        zenith="#241a3e"
        mid="#3a2b58"
        horizon="#6e4a9e"
        sunColor="#8a6ec0"
        sunDir={LABORATORIO_SUN}
        sunPow={16}
        halo={0.18}
      />
      {/* Paredes de la caverna: agujas de cristal en el horizonte. */}
      <KitSkyline
        seed={SEED + 1}
        rings={[
          { count: 15, radius: 40, spread: 10, hMin: 10, hMax: 22, rMin: 2.5, rMax: 4.5, color: "#5c3a8e", kind: "crystal", emissive: "#a855f7", emissiveIntensity: 0.5, sink: 4 },
          { count: 12, radius: 58, spread: 16, hMin: 16, hMax: 30, rMin: 4, rMax: 7, color: "#3a2b58", kind: "crystal", emissive: "#7c3aed", emissiveIntensity: 0.35, sink: 5 },
        ]}
      />
      <KitGround half={HALF} heightFn={heightFn} colorFn={groundColor} />
      <KitPath
        curve={curve}
        heightFn={heightFn}
        colorA="#6a4e9e"
        colorB="#7d5cb8"
        emissive="#a855f7"
        emissiveIntensity={0.5}
        seed={SEED + 2}
      />
      {/* Grieta de cristal: luz líquida violeta bajo la pasarela de cuarzo. */}
      <FlowPlane
        width={HALF * 2 + 8}
        length={CROSS.half * 2 + 1.4}
        position={[0, -0.45, CROSS.z]}
        deep="#2a1a4e"
        light="#c084fc"
        speed={0.5}
      />
      <KitWalkway
        crossing={CROSS}
        colorA="#e6d5ff"
        colorB="#cbaaff"
        emissive="#c084fc"
        emissiveIntensity={1.2}
        railColor="#4a3670"
        railGem="#f0a8d8"
        seed={SEED + 3}
      />
      <KitBankRocks
        crossing={CROSS}
        half={HALF}
        heightFn={heightFn}
        color="#4a3670"
        emissive="#a855f7"
        emissiveIntensity={0.5}
        seed={SEED + 4}
      />
      {/* Sala de los cristales colosales (alrededor del cristal 2, off-path). */}
      <CristalColosal x={-11.5} z={2} h={8} color="#a855f7" rotY={0.4} />
      <CristalColosal x={-10.5} z={-4.5} h={6.5} color="#f0a8d8" rotY={1.3} tilt={0.2} />
      <CristalColosal x={-4} z={4.2} h={5} color="#8ab6ff" rotY={2.2} tilt={0.08} />
      <CristalColosal x={14.5} z={12.5} h={6} color="#c084fc" rotY={0.9} />
      <CristalColosal x={-16.5} z={-7} h={7} color="#8ab6ff" rotY={1.7} tilt={0.16} />
      <CristalColosal x={13.5} z={-16} h={5.5} color="#f0a8d8" rotY={2.8} />
      {/* Alambiques junto al cristal 3 [5,-5]. */}
      <MesaAlambiques x={8.2} z={-4} rotY={-0.5} />
      {LAYOUT.missionSpots.slice(0, 4).map(([sx, sz], i) => (
        <KitPedestal key={i} x={sx} z={sz} stone="#4a3670" stoneDark="#3a2b58" ringColor="#c084fc" ringIntensity={1.35} />
      ))}
      <KitVoidAltar x={LAYOUT.missionSpots[4][0]} z={LAYOUT.missionSpots[4][1]} seed={SEED + 9} />
      <KitSealedZone x={LAYOUT.decorSpots.blocked[0]} z={LAYOUT.decorSpots.blocked[1]} seed={SEED + 10} />
      <KitPortalFrame x={LAYOUT.decorSpots.portal[0]} z={LAYOUT.decorSpots.portal[1]} stone="#4a3670" stoneDark="#3a2b58" gemColor="#f0a8d8" />
      <ObstacleShells obstacles={LAYOUT.obstacles} color="#4a3670" capColor="#5c4488" emissive="#7c3aed" emissiveIntensity={0.3} kind="crystal" />
      {/* Setas fosforescentes: casquetes de luz rosa a ras de suelo. */}
      <KitScatter
        seed={SEED + 11}
        count={60}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<sphereGeometry args={[1, 7, 5]} />}
        color="#f0a8d8"
        colorB="#c084fc"
        emissive="#f0a8d8"
        emissiveIntensity={1.3}
        sMin={0.22}
        sMax={0.5}
        yStretchMin={0.5}
        yStretchMax={0.7}
        sink={0.05}
        avoidDist={1.8}
      />
      {/* Brotes de cuarzo menores repartidos por la gruta. */}
      <KitScatter
        seed={SEED + 12}
        count={48}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<octahedronGeometry args={[0.62, 0]} />}
        color="#a855f7"
        colorB="#8ab6ff"
        emissive="#a855f7"
        emissiveIntensity={0.9}
        sMin={0.35}
        sMax={0.9}
        yStretchMin={1.4}
        yStretchMax={2.4}
        avoidDist={1.9}
      />
      {/* Niebla baja violeta clara + Bruma del Vacío en altar y zona sellada. */}
      <KitGroundFog
        seed={SEED + 13}
        patches={[
          { count: 7, cx: 0, cz: 0, rx: HALF - 4, rz: HALF - 4, color: "#b9a2d8", opacity: 0.2 },
          { count: 5, cx: LAYOUT.missionSpots[4][0], cz: LAYOUT.missionSpots[4][1], rx: 5, rz: 4, color: "#8d78d8", opacity: 0.32 },
          { count: 4, cx: LAYOUT.decorSpots.blocked[0], cz: LAYOUT.decorSpots.blocked[1], rx: 4, rz: 4, color: "#8d78d8", opacity: 0.34 },
        ]}
      />
      {/* Esporas flotantes rosa/azul (la vida de la caverna). */}
      <KitParticles
        seed={SEED + 14}
        count={110}
        rx={HALF - 3}
        rz={HALF - 3}
        yMin={0.5}
        yMax={5}
        colors={["#c084fc", "#f0a8d8", "#8ab6ff"]}
        size={0.26}
        opacity={0.75}
        mode="drift"
        speed={0.5}
      />
    </group>
  );
}
