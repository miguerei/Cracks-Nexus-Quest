// Fase 5 — Archipiélago de las Mareas (Lenguas).
//
// Dirección de arte (§8): teal + turquesa + coral. Agua por todas partes: la
// isla jugable se hunde en un mar teal que lo rodea todo, con islotes y
// faros-runa en el horizonte. Un estrecho corta la isla y SOLO se cruza por
// una pasarela de madera. Gaviotas, espuma y corales completan la marea.
// Ruta del layout: playa → estrecho → faro mayor → corales → claro → portal
// → altar del Vacío.

import * as THREE from "three";
import { CylinderCollider, RigidBody } from "@react-three/rapier";

import { samplePath } from "./BosqueEnvironment";
import { Flock, ObstacleShells } from "./environmentExtras";
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
  smoothstep,
  vnoise,
} from "./environmentKit";
import { getWorldLayout, WORLD_CROSSINGS } from "./worldConfig";

const SEED = 444;
const LAYOUT = getWorldLayout("lenguas");
const HALF = LAYOUT.groundHalf;
const CROSS = WORLD_CROSSINGS.lenguas;

// Sol marino alto y brillante desde el noreste.
export const LENGUAS_SUN: [number, number, number] = [0.5, 0.75, -0.35];

// El borde se HUNDE bajo el mar (rimHeight negativo): la isla emerge del agua.
const heightFn = makeGroundHeightFn({
  half: HALF,
  crossZ: CROSS.z,
  carveDepth: 1.15,
  carveWidth: CROSS.half + 1,
  rimHeight: -2.8,
  rimNoise: 0.6,
});

// Senda de conchas: pasa por el vano del estrecho (x=-3).
const PATH_POINTS: [number, number][] = [
  [0, 22.5], [-3, 18], [-7, 15], [-10, 12], [-8, 9.6], [-3, 8.4],
  [-3, 6], [-3, 3.7], [0, 2], [4, 0.5], [8, -1], [4, -3],
  [-1, -4.5], [-6, -6], [-2, -8], [3, -9.5], [7, -11], [11, -12],
  [7, -13], [4, -13], [0, -12.6], [-3, -12], [-8, -14], [-13, -16],
  [-8, -18], [-4, -19.2], [0, -20],
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

// Hierba de marea en el interior, arena en costas y estrecho, lecho al fondo.
const C_GRASS = new THREE.Color("#5aa072");
const C_GRASS2 = new THREE.Color("#79b98a");
const C_SAND = new THREE.Color("#dcc78d");
const C_BED = new THREE.Color("#3f6e66");
function groundColor(x: number, z: number, y: number, out: THREE.Color) {
  const n = vnoise(x * 0.7, z * 0.7) * 0.5 + 0.5;
  out.copy(C_GRASS).lerp(C_GRASS2, n);
  const r = Math.max(Math.abs(x), Math.abs(z));
  const coast = smoothstep(HALF - 8, HALF - 1, r);
  const gorge = 1 - smoothstep(CROSS.half + 0.6, CROSS.half + 3, Math.abs(z - CROSS.z));
  out.lerp(C_SAND, Math.max(coast, gorge) * 0.85);
  if (y < -0.5) out.lerp(C_BED, Math.min(1, -y * 0.7));
}

// ---------------------------------------------------------------------------
// Faro-runa: torre cónica con bandas teal, linterna emisiva y runa orbital.
// Todos llevan collider cilíndrico (están dentro del área caminable pero
// SIEMPRE fuera de la senda: son obstáculo temático, no bloqueo de ruta).
// ---------------------------------------------------------------------------
function FaroRuna({
  x,
  z,
  h = 6,
  solid = false,
}: {
  x: number;
  z: number;
  h?: number;
  solid?: boolean;
}) {
  const y = heightFn(x, z);
  return (
    <group position={[x, y, z]}>
      {solid && (
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[h / 2, 1]} position={[0, h / 2, 0]} />
        </RigidBody>
      )}
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.35, 1.6, 0.5, 8]} />
        <meshStandardMaterial color="#8a9a8a" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, h / 2 + 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.62, 1.05, h, 8]} />
        <meshStandardMaterial color="#e8e4d8" flatShading roughness={0.9} />
      </mesh>
      {/* Bandas de marea pintadas en la torre. */}
      {[0.32, 0.62].map((k) => (
        <mesh key={k} position={[0, h * k + 0.3, 0]} castShadow>
          <cylinderGeometry args={[1.05 - 0.43 * k, 1.08 - 0.43 * k, h * 0.09, 8]} />
          <meshStandardMaterial color="#2f8a80" flatShading roughness={0.9} />
        </mesh>
      ))}
      {/* Linterna: la runa del faro brilla teal. */}
      <mesh position={[0, h + 0.75, 0]}>
        <sphereGeometry args={[0.42, 8, 6]} />
        <meshStandardMaterial color="#99f6e4" emissive="#2dd4bf" emissiveIntensity={1.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, h + 1.3, 0]} castShadow>
        <coneGeometry args={[0.62, 0.7, 8]} />
        <meshStandardMaterial color="#2f6e68" flatShading roughness={0.9} />
      </mesh>
      {/* Anillo-runa alrededor de la linterna. */}
      <mesh position={[0, h + 0.75, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[0.72, 0.045, 6, 22]} />
        <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={1.3} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Entorno raíz del Archipiélago. Debe montarse DENTRO de <Physics>.
// ---------------------------------------------------------------------------
export default function LenguasEnvironment() {
  return (
    <group>
      <KitSky
        zenith="#2e6e9e"
        mid="#7ac8d8"
        horizon="#e8f4e0"
        sunColor="#fff4d6"
        sunDir={LENGUAS_SUN}
        sunPow={100}
        halo={0.3}
      />
      {/* Islotes lejanos asomando sobre el mar. */}
      <KitSkyline
        seed={SEED + 1}
        rings={[
          { count: 12, radius: 46, spread: 12, hMin: 4, hMax: 9, rMin: 4, rMax: 8, color: "#4a8a6e", sides: 6, sink: 3.6 },
          { count: 9, radius: 64, spread: 14, hMin: 6, hMax: 12, rMin: 5, rMax: 9, color: "#3a6e5e", sides: 5, sink: 4.5 },
        ]}
      />
      <KitGround half={HALF} heightFn={heightFn} colorFn={groundColor} />
      <KitPath curve={curve} heightFn={heightFn} colorA="#d8c48c" colorB="#c8b276" seed={SEED + 2} />
      {/* El mar: una sola lámina teal que llena el estrecho Y rodea la isla
          (el borde del terreno se hunde bajo ella). */}
      <FlowPlane
        width={170}
        length={170}
        position={[0, -0.42, 0]}
        deep="#0f4a4f"
        light="#2dd4bf"
        speed={0.55}
        alpha={0.94}
      />
      <KitWalkway
        crossing={CROSS}
        colorA="#a1703f"
        colorB="#8a5f36"
        railColor="#6e4c2a"
        railGem="#2dd4bf"
        seed={SEED + 3}
      />
      <KitBankRocks crossing={CROSS} half={HALF} heightFn={heightFn} color="#6e7f74" seed={SEED + 4} />
      {/* Faro mayor junto al cristal 2 [8,-1]; faros menores en las costas. */}
      <FaroRuna x={11.5} z={1.5} h={6.5} solid />
      <FaroRuna x={-20} z={17} h={4.5} solid />
      <FaroRuna x={20.5} z={-7} h={5} solid />
      <FaroRuna x={-20.5} z={-9.5} h={4} solid />
      {LAYOUT.missionSpots.slice(0, 4).map(([sx, sz], i) => (
        <KitPedestal key={i} x={sx} z={sz} stone="#c8bfa8" stoneDark="#8a9a8a" ringColor="#2dd4bf" ringIntensity={1.35} />
      ))}
      <KitVoidAltar x={LAYOUT.missionSpots[4][0]} z={LAYOUT.missionSpots[4][1]} seed={SEED + 9} />
      <KitSealedZone x={LAYOUT.decorSpots.blocked[0]} z={LAYOUT.decorSpots.blocked[1]} seed={SEED + 10} />
      <KitPortalFrame x={LAYOUT.decorSpots.portal[0]} z={LAYOUT.decorSpots.portal[1]} stone="#c8bfa8" stoneDark="#8a9a8a" gemColor="#2dd4bf" />
      <ObstacleShells obstacles={LAYOUT.obstacles} color="#7d8f82" capColor="#a8b8a0" kind="rock" />
      {/* Jardín de corales: abanicos naranja/rosa fuera de la senda. */}
      <KitScatter
        seed={SEED + 11}
        count={44}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<coneGeometry args={[0.55, 1.2, 5]} />}
        color="#f97362"
        colorB="#f4a261"
        emissive="#f97362"
        emissiveIntensity={0.35}
        sMin={0.35}
        sMax={0.85}
        yStretchMin={0.9}
        yStretchMax={1.5}
        avoidDist={1.8}
      />
      {/* Hierbas de marea altas mecidas (estáticas, masa instanciada). */}
      <KitScatter
        seed={SEED + 12}
        count={52}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<coneGeometry args={[0.28, 1.4, 4]} />}
        color="#3f8a5c"
        colorB="#67b98a"
        sMin={0.4}
        sMax={0.9}
        yStretchMin={1}
        yStretchMax={1.6}
        avoidDist={1.6}
      />
      {/* Bruma marina + Bruma del Vacío en altar y cala sellada. */}
      <KitGroundFog
        seed={SEED + 13}
        patches={[
          { count: 6, cx: 0, cz: CROSS.z, rx: HALF - 3, rz: 3, color: "#c8ecec", opacity: 0.18 },
          { count: 5, cx: LAYOUT.missionSpots[4][0], cz: LAYOUT.missionSpots[4][1], rx: 5, rz: 4, color: "#8d78d8", opacity: 0.3 },
          { count: 4, cx: LAYOUT.decorSpots.blocked[0], cz: LAYOUT.decorSpots.blocked[1], rx: 4, rz: 4, color: "#8d78d8", opacity: 0.34 },
        ]}
      />
      {/* Espuma y salpicaduras sobre las orillas. */}
      <KitParticles
        seed={SEED + 14}
        count={90}
        cz={CROSS.z}
        rx={HALF - 2}
        rz={4}
        yMin={0.15}
        yMax={1.4}
        colors={["#eaf6ff", "#99f6e4"]}
        size={0.2}
        opacity={0.6}
        mode="drift"
        speed={0.8}
      />
      {/* Motas de luz marina por toda la isla. */}
      <KitParticles
        seed={SEED + 15}
        count={70}
        rx={HALF - 3}
        rz={HALF - 3}
        yMin={0.5}
        yMax={4}
        colors={["#99f6e4", "#eaf6ff", "#7ac8d8"]}
        size={0.22}
        opacity={0.6}
        mode="drift"
        speed={0.5}
      />
      {/* Gaviotas: dos bandadas cruzándose sobre el archipiélago. */}
      <Flock color="#f4f8f2" radius={46} height={17} speed={0.06} />
      <Flock color="#dfe8e0" radius={58} height={23} speed={-0.045} phase={2.4} />
    </group>
  );
}
