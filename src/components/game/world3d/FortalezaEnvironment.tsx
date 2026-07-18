// Fase 5 — Fortaleza del Vacío.
//
// Dirección de arte (§8): violeta/negro + magma frío. El ÚNICO mundo oscuro
// del juego — pero legible: el héroe siempre se ve. Púas de obsidiana, niebla
// violeta densa, y un foso de magma frío que corta el patio y SOLO se cruza
// por un paso de obsidiana. Los emisivos del Vacío laten a ~0.6 (amenaza
// sorda, §9); los acentos del jugador (senda, pedestales, portal) sí brillan.
// Ruta del layout: patio de púas → foso → fauces → grietas frías → refugio →
// portal → trono del Vacío.

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
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

const SEED = 666;
const LAYOUT = getWorldLayout("fortaleza-vacio");
const HALF = LAYOUT.groundHalf;
const CROSS = WORLD_CROSSINGS["fortaleza-vacio"];

// Luz fría tenue: una luna enferma tras la bruma, desde el noreste.
export const FORTALEZA_SUN: [number, number, number] = [0.35, 0.8, -0.4];

const heightFn = makeGroundHeightFn({
  half: HALF,
  crossZ: CROSS.z,
  carveDepth: 1.5,
  carveWidth: CROSS.half + 1.1,
  rimHeight: 4.8,
  rimNoise: 2.4,
});

// Senda del asedio: pasa por el vano del foso (x=2).
const PATH_POINTS: [number, number][] = [
  [0, 23.5], [3, 18.5], [7, 15], [10, 12], [7, 9.6], [2, 8.6],
  [2, 6], [2, 3.4], [-2, 1.5], [-5, 0.3], [-8, -1], [-4, -3.5],
  [1, -5], [6, -7], [2, -9], [-3, -10.5], [-8, -11.4], [-12, -12],
  [-8, -13.5], [-4, -14], [0, -13], [3, -12], [8, -14.5], [14, -17],
  [9, -19], [4, -20.2], [0, -21],
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

// Obsidiana con vetas frías violeta y foso hundido casi negro.
const C_OBS = new THREE.Color("#241a30");
const C_OBS2 = new THREE.Color("#2d2240");
const C_VEIN = new THREE.Color("#5b2d8a");
const C_CARVE = new THREE.Color("#150d20");
function groundColor(x: number, z: number, y: number, out: THREE.Color) {
  const n = vnoise(x * 0.8, z * 0.8) * 0.5 + 0.5;
  out.copy(C_OBS).lerp(C_OBS2, n);
  if (vnoise(x * 1.7, z * 1.7) > 0.74) out.lerp(C_VEIN, 0.42);
  if (y < -0.3) out.lerp(C_CARVE, Math.min(1, -y * 0.8));
  if (y > 1.4) out.lerp(C_VEIN, Math.min(1, (y - 1.4) * 0.14));
}

// ---------------------------------------------------------------------------
// Colmillo de obsidiana: púa angulosa con núcleo violeta latiendo a ~0.6.
// Collider cilíndrico justo; siempre fuera de la senda.
// ---------------------------------------------------------------------------
function Colmillo({
  x,
  z,
  h = 6,
  tilt = 0.18,
  rotY = 0,
  phase = 0,
}: {
  x: number;
  z: number;
  h?: number;
  tilt?: number;
  rotY?: number;
  phase?: number;
}) {
  const core = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    // Latido del Vacío: oscila alrededor de 0.6, nunca brillo alegre.
    if (core.current) core.current.emissiveIntensity = 0.6 + Math.sin(state.clock.elapsedTime * 1.3 + phase) * 0.15;
  });
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[h * 0.28, h * 0.14]} position={[0, h * 0.28, 0]} />
      </RigidBody>
      <mesh position={[0, h * 0.4, 0]} rotation={[tilt, 0, -tilt * 0.6]} castShadow>
        <coneGeometry args={[h * 0.17, h, 4]} />
        <meshStandardMaterial color="#1c1226" flatShading roughness={0.55} />
      </mesh>
      {/* Núcleo violeta que late en la base de la púa. */}
      <mesh position={[0, h * 0.16, h * 0.1]}>
        <octahedronGeometry args={[h * 0.07, 0]} />
        <meshStandardMaterial ref={core} color="#1a1028" emissive="#a855f7" emissiveIntensity={0.6} flatShading />
      </mesh>
      {/* Púas menores al pie. */}
      {[1.1, 2.9, 4.6].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * h * 0.22, h * 0.12, Math.sin(a) * h * 0.22]} rotation={[0.3, a, -0.2]} castShadow>
          <coneGeometry args={[0.22, 0.9 + i * 0.3, 4]} />
          <meshStandardMaterial color="#241a30" flatShading roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Trono del Vacío: respaldo de púas tras el altar del jefe, con el núcleo
// violeta del Coloso latiendo en el centro. Collider detrás del altar.
// ---------------------------------------------------------------------------
function TronoDelVacio({ x, z }: { x: number; z: number }) {
  const core = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    if (core.current) core.current.emissiveIntensity = 0.55 + Math.sin(state.clock.elapsedTime * 1.1) * 0.18;
  });
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[2.5, 2]} position={[0, 2.5, 0]} />
      </RigidBody>
      {/* Corona de púas del respaldo. */}
      {[-2.2, -1.1, 0, 1.1, 2.2].map((sx, i) => (
        <mesh key={i} position={[sx, 2.2 + (2 - Math.abs(sx)) * 1.1, 0]} rotation={[0, 0, sx * -0.12]} castShadow>
          <coneGeometry args={[0.55, 4.4 + (2 - Math.abs(sx)) * 2.2, 4]} />
          <meshStandardMaterial color="#1c1226" flatShading roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 2, 1.6]} />
        <meshStandardMaterial color="#241a30" flatShading roughness={0.7} />
      </mesh>
      {/* El núcleo del Vacío observa el patio. */}
      <mesh position={[0, 3.4, 0.6]}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial ref={core} color="#1a1028" emissive="#7c3aed" emissiveIntensity={0.6} flatShading />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Entorno raíz de la Fortaleza. Debe montarse DENTRO de <Physics>.
// ---------------------------------------------------------------------------
export default function FortalezaEnvironment() {
  return (
    <group>
      {/* Cielo del Vacío: negro-violeta con ascuas de estrellas moribundas. */}
      <KitSky
        zenith="#0e0716"
        mid="#1c1028"
        horizon="#3a2149"
        sunColor="#6e5a9e"
        sunDir={FORTALEZA_SUN}
        sunPow={40}
        halo={0.2}
        stars={240}
        starColor="#a78bfa"
        starSeed={SEED + 1}
      />
      {/* Murallas de púas de obsidiana cerrando el horizonte. */}
      <KitSkyline
        seed={SEED + 2}
        rings={[
          { count: 17, radius: 44, spread: 12, hMin: 14, hMax: 28, rMin: 3, rMax: 5.5, color: "#1c1226", sides: 4, emissive: "#7c3aed", emissiveIntensity: 0.22, sink: 5 },
          { count: 12, radius: 66, spread: 18, hMin: 20, hMax: 40, rMin: 5, rMax: 8, color: "#140c1e", sides: 4, emissive: "#5b21b6", emissiveIntensity: 0.14, sink: 6 },
        ]}
      />
      <KitGround half={HALF} heightFn={heightFn} colorFn={groundColor} />
      {/* La senda es un acento del JUGADOR: brilla más que el Vacío. */}
      <KitPath
        curve={curve}
        heightFn={heightFn}
        colorA="#3a2c4e"
        colorB="#32244a"
        emissive="#f43f5e"
        emissiveIntensity={0.45}
        seed={SEED + 3}
      />
      {/* Foso de magma frío violeta bajo el paso de obsidiana. */}
      <FlowPlane
        width={HALF * 2 + 8}
        length={CROSS.half * 2 + 1.6}
        position={[0, -0.5, CROSS.z]}
        deep="#1c1030"
        light="#7c3aed"
        speed={0.32}
        alpha={0.96}
      />
      <KitWalkway
        crossing={CROSS}
        colorA="#3a2a52"
        colorB="#2c2140"
        railColor="#241a30"
        railGem="#a855f7"
        seed={SEED + 4}
      />
      <KitBankRocks
        crossing={CROSS}
        half={HALF}
        heightFn={heightFn}
        color="#241a30"
        emissive="#7c3aed"
        emissiveIntensity={0.5}
        seed={SEED + 5}
      />
      {/* Fauces de obsidiana: dos colmillos flanquean el foro del cristal 2. */}
      <Colmillo x={-8} z={3.2} h={7} rotY={0.4} phase={0} />
      <Colmillo x={-8} z={-5.4} h={7.5} rotY={2.1} tilt={-0.16} phase={1.4} />
      {/* Colmillos mayores marcando el perímetro del patio. */}
      <Colmillo x={15} z={17} h={9} rotY={1.1} phase={0.6} />
      <Colmillo x={-16} z={12} h={8} rotY={2.8} phase={2.2} />
      <Colmillo x={18} z={-6} h={8.5} rotY={0.2} tilt={-0.2} phase={3.1} />
      <Colmillo x={-17} z={-6} h={7} rotY={1.7} phase={4} />
      <TronoDelVacio x={0} z={-24.6} />
      {LAYOUT.missionSpots.slice(0, 4).map(([sx, sz], i) => (
        <KitPedestal key={i} x={sx} z={sz} stone="#302344" stoneDark="#241a30" ringColor="#f43f5e" ringIntensity={1.5} />
      ))}
      <KitVoidAltar
        x={LAYOUT.missionSpots[4][0]}
        z={LAYOUT.missionSpots[4][1]}
        base="#221631"
        baseDark="#180f24"
        seed={SEED + 9}
      />
      {/* La Bruma sella la brecha SO con más espinas que en otros mundos. */}
      <KitSealedZone x={LAYOUT.decorSpots.blocked[0]} z={LAYOUT.decorSpots.blocked[1]} seed={SEED + 10} />
      <KitSealedZone x={LAYOUT.decorSpots.blocked[0] + 3.4} z={LAYOUT.decorSpots.blocked[1] + 2.8} seed={SEED + 11} />
      <KitPortalFrame x={LAYOUT.decorSpots.portal[0]} z={LAYOUT.decorSpots.portal[1]} stone="#302344" stoneDark="#241a30" gemColor="#f43f5e" />
      <ObstacleShells obstacles={LAYOUT.obstacles} color="#241a30" capColor="#2d2240" emissive="#7c3aed" emissiveIntensity={0.25} kind="crystal" />
      {/* Campo de púas menores: la fortaleza entera está erizada. */}
      <KitScatter
        seed={SEED + 12}
        count={64}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<coneGeometry args={[0.4, 1.6, 4]} />}
        color="#1c1226"
        colorB="#2d2240"
        emissive="#7c3aed"
        emissiveIntensity={0.35}
        sMin={0.45}
        sMax={1.2}
        yStretchMin={1}
        yStretchMax={1.8}
        avoidDist={1.9}
      />
      {/* Grietas frías: fragmentos violeta a ras de suelo (cristal 3). */}
      <KitScatter
        seed={SEED + 13}
        count={30}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<octahedronGeometry args={[0.6, 0]} />}
        color="#3a2a52"
        colorB="#5b2d8a"
        emissive="#a855f7"
        emissiveIntensity={0.55}
        sMin={0.3}
        sMax={0.7}
        yStretchMin={0.5}
        yStretchMax={0.9}
        avoidDist={1.8}
      />
      {/* Niebla violeta DENSA: la firma del único mundo oscuro. */}
      <KitGroundFog
        seed={SEED + 14}
        patches={[
          { count: 9, cx: 0, cz: 0, rx: HALF - 3, rz: HALF - 3, color: "#7a62b8", opacity: 0.26 },
          { count: 7, cx: 0, cz: CROSS.z, rx: HALF - 4, rz: 3, color: "#8d78d8", opacity: 0.34 },
          { count: 6, cx: LAYOUT.missionSpots[4][0], cz: LAYOUT.missionSpots[4][1], rx: 6, rz: 5, color: "#6d54b8", opacity: 0.38 },
          { count: 5, cx: LAYOUT.decorSpots.blocked[0], cz: LAYOUT.decorSpots.blocked[1], rx: 4.5, rz: 4.5, color: "#8d78d8", opacity: 0.4 },
        ]}
      />
      {/* Ascuas del Vacío: motas violeta que ascienden despacio. */}
      <KitParticles
        seed={SEED + 15}
        count={85}
        rx={HALF - 3}
        rz={HALF - 3}
        yMin={0.3}
        yMax={5.5}
        colors={["#7c3aed", "#a855f7", "#5b21b6"]}
        size={0.2}
        opacity={0.5}
        mode="rise"
        speed={0.45}
      />
    </group>
  );
}
