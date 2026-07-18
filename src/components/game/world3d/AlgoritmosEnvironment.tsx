// Fase 5 — Ciudadela circuito (Núcleo de Algoritmos).
//
// Dirección de arte (§8): azules fríos + cian. Torres de datos en el horizonte,
// suelo con rejilla y vetas de circuito emisivas, canal de datos que corta el
// mapa y SOLO se cruza por un puente de luz, pilones holográficos y motas de
// datos ascendentes. La ruta es la del layout: entrada sur → plaza de datos →
// canal → foro de torres → pilones → claro → portal → altar del Vacío.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

import { samplePath } from "./BosqueEnvironment";
import { ObstacleShells } from "./environmentExtras";
import {
  buildCurve,
  FlowPlane,
  KitBankRocks,
  KitFarFog,
  KitGround,
  KitGroundFog,
  KitLightShafts,
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
  mulberry32,
  scaleCount,
  vnoise,
} from "./environmentKit";
import { getWorldLayout, WORLD_CROSSINGS } from "./worldConfig";

// Semilla base del mundo (todas las sub-semillas derivan de ella).
const SEED = 111;
const LAYOUT = getWorldLayout("algoritmos");
const HALF = LAYOUT.groundHalf;
const CROSS = WORLD_CROSSINGS.algoritmos;

// El sol frío entra desde el noreste: se camina hacia la luz (norte).
export const ALGORITMOS_SUN: [number, number, number] = [0.45, 0.7, -0.4];

const heightFn = makeGroundHeightFn({
  half: HALF,
  crossZ: CROSS.z,
  carveDepth: 1.2,
  carveWidth: CROSS.half + 1.1,
  rimHeight: 3.2,
  rimNoise: 1.1,
});

// Senda de energía: espejo x del Bosque, pasa por el vano del canal (x=4).
const PATH_POINTS: [number, number][] = [
  [0, 21.5], [2, 17], [6, 14], [10, 11], [8, 8.6], [4, 7.6],
  [4, 5.5], [4, 3.4], [0, 2], [-4, 0.5], [-8, -1], [-5, -3.5],
  [0, -4.5], [6, -6], [2, -8], [-3, -9.5], [-8, -10.5], [-11, -11],
  [-7, -13], [-4, -13], [0, -12.5], [3, -11], [7, -13], [12, -16],
  [8, -17.5], [4, -18.4], [0, -19],
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

// Colores del suelo: placa base azul noche con rejilla tenue cada 4 unidades.
const C_BASE = new THREE.Color("#182842");
const C_ALT = new THREE.Color("#20345a");
const C_GRID = new THREE.Color("#2a4a7a");
const C_CARVE = new THREE.Color("#0a1424");
function groundColor(x: number, z: number, y: number, out: THREE.Color) {
  const n = vnoise(x * 0.8, z * 0.8) * 0.5 + 0.5;
  out.copy(C_BASE).lerp(C_ALT, n);
  const gx = Math.abs((((x % 4) + 4) % 4) - 2);
  const gz = Math.abs((((z % 4) + 4) % 4) - 2);
  if (gx > 1.84 || gz > 1.84) out.lerp(C_GRID, 0.4);
  if (y < -0.25) out.lerp(C_CARVE, Math.min(1, -y));
  if (y > 1) out.lerp(C_GRID, Math.min(1, (y - 1) * 0.22));
}

// ---------------------------------------------------------------------------
// Torre de datos: bloque tecnológico con franjas de ventanas emisivas y
// antena. Sólida (collider caja) y SIEMPRE fuera de la ruta caminable.
// ---------------------------------------------------------------------------
function DataTower({ x, z, h = 10, w = 2.6, seed = 1 }: { x: number; z: number; h?: number; w?: number; seed?: number }) {
  const strips = useMemo(() => {
    const rnd = mulberry32(SEED + seed);
    return Array.from({ length: 5 }, () => ({
      y: 1 + rnd() * (h - 2.4),
      side: Math.floor(rnd() * 4),
      len: 0.35 + rnd() * 0.4,
    }));
  }, [h, seed]);
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[w * 0.55, h / 2, w * 0.55]} position={[0, h / 2, 0]} />
      </RigidBody>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, w]} />
        <meshStandardMaterial color="#1a2c48" flatShading roughness={0.55} metalness={0.35} />
      </mesh>
      <mesh position={[0, h + 0.35, 0]} castShadow>
        <boxGeometry args={[w * 0.62, 0.7, w * 0.62]} />
        <meshStandardMaterial color="#223a5e" flatShading roughness={0.5} metalness={0.35} />
      </mesh>
      <mesh position={[0, h + 1.35, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 1.4, 5]} />
        <meshStandardMaterial color="#2a4a7a" flatShading roughness={0.6} />
      </mesh>
      <mesh position={[0, h + 2.1, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={1.6} />
      </mesh>
      {/* Franjas de ventanas de datos. */}
      {strips.map((s, i) => {
        const rot = (s.side * Math.PI) / 2;
        return (
          <group key={i} rotation={[0, rot, 0]}>
            <mesh position={[0, s.y, w / 2 + 0.02]}>
              <boxGeometry args={[w * s.len, 0.16, 0.05]} />
              <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={1.4} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Pilón holográfico: columna translúcida cian con anillo que asciende en
// bucle. Sin colisión (es un holograma).
// ---------------------------------------------------------------------------
function HoloPillar({ x, z, phase = 0 }: { x: number; z: number; phase?: number }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ring.current) return;
    const t = state.clock.elapsedTime;
    ring.current.position.y = 0.4 + ((t * 0.7 + phase) % 1) * 2.4;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.75, 0.2, 6]} />
        <meshStandardMaterial color="#1d3050" flatShading roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.42, 0.5, 2.8, 6, 1, true]} />
        <meshStandardMaterial
          color="#7dd3fc"
          emissive="#38bdf8"
          emissiveIntensity={1.25}
          transparent
          opacity={0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.62, 20]} />
        <meshStandardMaterial
          color="#7dd3fc"
          emissive="#7dd3fc"
          emissiveIntensity={1.5}
          transparent
          opacity={0.8}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Vetas de circuito: trazas Manhattan emisivas incrustadas en el suelo.
// Instanciadas, planas (0.02 de alto: muy por debajo del relieve ≤0.1).
// ---------------------------------------------------------------------------
function CircuitVeins() {
  const traces = useMemo(() => {
    const rnd = mulberry32(SEED + 40);
    const out: { p: [number, number, number]; len: number; rotY: number }[] = [];
    const N = scaleCount(84); // Fase 7: más vetas (equivalente a la hierba ×density)
    let guard = 0;
    while (out.length < N && guard++ < N * 14) {
      const x = (rnd() - 0.5) * (HALF * 2 - 6);
      const z = (rnd() - 0.5) * (HALF * 2 - 6);
      // Fuera del canal de datos y de la senda (evita z-fighting con la cinta).
      if (Math.abs(z - CROSS.z) < CROSS.half + 1.6) continue;
      let near = false;
      for (const [ax, az] of pathSamples) {
        if ((ax - x) * (ax - x) + (az - z) * (az - z) < 1.7) { near = true; break; }
      }
      if (near) continue;
      const len = 1.6 + rnd() * 3.2;
      const rotY = rnd() > 0.5 ? 0 : Math.PI / 2;
      out.push({ p: [x, heightFn(x, z) + 0.03, z], len, rotY });
    }
    return out;
  }, []);
  return (
    <instancedMesh
      ref={(m) => {
        if (!m) return;
        const M = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const p = new THREE.Vector3();
        const s = new THREE.Vector3();
        traces.forEach((tr, i) => {
          p.set(...tr.p);
          q.setFromEuler(new THREE.Euler(0, tr.rotY, 0));
          s.set(tr.len, 1, 1);
          M.compose(p, q, s);
          m.setMatrixAt(i, M);
        });
        m.instanceMatrix.needsUpdate = true;
      }}
      args={[undefined, undefined, traces.length]}
    >
      <boxGeometry args={[1, 0.02, 0.13]} />
      <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.3} roughness={0.4} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Entorno raíz de la Ciudadela. Debe montarse DENTRO de <Physics>.
// ---------------------------------------------------------------------------
export default function AlgoritmosEnvironment() {
  return (
    <group>
      <KitSky
        zenith="#1e3a6e"
        mid="#4a7ab8"
        horizon="#a8d4f0"
        sunColor="#dceaff"
        sunDir={ALGORITMOS_SUN}
        sunPow={110}
        halo={0.22}
        cloudBands={[
          { count: 3, y: 34, radius: 200, scale: 160, color: "#dcecff", opacity: 0.22, speed: 0.002 },
          { count: 3, y: 58, radius: 225, scale: 190, color: "#c2d8f2", opacity: 0.16, speed: 0.0014 },
        ]}
        cloudSeed={SEED + 20}
      />
      {/* Skyline: dos anillos de torres de datos con ventanas cian. */}
      <KitSkyline
        seed={SEED + 1}
        rings={[
          { count: 16, radius: 44, spread: 14, hMin: 12, hMax: 26, rMin: 2.4, rMax: 4.4, color: "#1d3050", kind: "box", emissive: "#38bdf8", emissiveIntensity: 0.32 },
          { count: 14, radius: 68, spread: 20, hMin: 18, hMax: 36, rMin: 3.5, rMax: 6, color: "#16263e", kind: "box", emissive: "#2563b0", emissiveIntensity: 0.22 },
        ]}
      />
      <KitGround half={HALF} heightFn={heightFn} colorFn={groundColor} detailStyle="placa" detailSeed={SEED + 21} detailRepeat={24} />
      <KitPath
        curve={curve}
        heightFn={heightFn}
        colorA="#2c5a86"
        colorB="#38709e"
        emissive="#1d6fa8"
        emissiveIntensity={0.7}
        seed={SEED + 2}
      />
      <CircuitVeins />
      {/* Canal de datos: corriente cian con reflejo del sol frío y espuma de
          bits en las orillas, bajo el puente de luz. */}
      <FlowPlane
        width={HALF * 2 + 8}
        length={CROSS.half * 2 + 1.4}
        position={[0, -0.42, CROSS.z]}
        deep="#0a2038"
        light="#38bdf8"
        speed={1.15}
        sunDir={ALGORITMOS_SUN}
        glint={0.55}
        glintColor="#dceaff"
        foam={0.45}
      />
      <KitWalkway
        crossing={CROSS}
        colorA="#9adcff"
        colorB="#5ec2f7"
        emissive="#7dd3fc"
        emissiveIntensity={1.4}
        railColor="#274a6e"
        railGem="#7dd3fc"
        seed={SEED + 3}
      />
      <KitBankRocks
        crossing={CROSS}
        half={HALF}
        heightFn={heightFn}
        color="#22405e"
        emissive="#1d4ed8"
        emissiveIntensity={0.4}
        seed={SEED + 4}
      />
      {/* Torres de datos jugables (fuera de la senda) y pilones del foro. */}
      <DataTower x={-17} z={12} h={11} seed={5} />
      <DataTower x={16} z={16} h={9} w={2.2} seed={6} />
      <DataTower x={-18} z={-5} h={12} seed={7} />
      <DataTower x={17} z={-3} h={8.5} w={2.2} seed={8} />
      <HoloPillar x={9} z={-7.5} phase={0} />
      <HoloPillar x={4} z={-9.5} phase={0.4} />
      <HoloPillar x={9} z={-3.5} phase={0.7} />
      <HoloPillar x={-12} z={2} phase={0.2} />
      {/* Nodos anclados al mundo: pedestales, altar, sellado y portal. */}
      {LAYOUT.missionSpots.slice(0, 4).map(([sx, sz], i) => (
        <KitPedestal key={i} x={sx} z={sz} stone="#2c4468" stoneDark="#1d3050" ringColor="#38bdf8" ringIntensity={1.35} />
      ))}
      <KitVoidAltar x={LAYOUT.missionSpots[4][0]} z={LAYOUT.missionSpots[4][1]} seed={SEED + 9} />
      <KitSealedZone x={LAYOUT.decorSpots.blocked[0]} z={LAYOUT.decorSpots.blocked[1]} seed={SEED + 10} />
      <KitPortalFrame x={LAYOUT.decorSpots.portal[0]} z={LAYOUT.decorSpots.portal[1]} stone="#2c4468" stoneDark="#1d3050" gemColor="#7dd3fc" />
      <ObstacleShells obstacles={LAYOUT.obstacles} color="#223a5e" capColor="#2c4a74" emissive="#1d4ed8" emissiveIntensity={0.25} kind="block" />
      {/* Chatarra de datos: fragmentos de placa dispersos fuera de la ruta. */}
      <KitScatter
        seed={SEED + 11}
        count={scaleCount(70)}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<boxGeometry args={[1, 0.5, 0.7]} />}
        color="#20355a"
        colorB="#2c4a74"
        emissive="#1d4ed8"
        emissiveIntensity={0.3}
        sMin={0.4}
        sMax={1.1}
        avoidDist={2}
      />
      {/* Fase 7: hierba de datos — aletas finas emisivas que brotan del suelo. */}
      <KitScatter
        seed={SEED + 15}
        count={scaleCount(60)}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<boxGeometry args={[0.08, 1, 0.4]} />}
        color="#2a5a8e"
        colorB="#38709e"
        emissive="#38bdf8"
        emissiveIntensity={0.7}
        sMin={0.4}
        sMax={0.9}
        yStretchMin={1}
        yStretchMax={1.8}
        sink={0.05}
        avoidDist={1.5}
      />
      {/* Fase 7: haces de luz fría sobre la plaza de datos y el foro. */}
      <KitLightShafts
        spots={[[10, 11], [-8, -1]]}
        sunDir={ALGORITMOS_SUN}
        color="#bfe4ff"
        opacity={0.06}
      />
      {/* Fase 7: niebla de distancia baja en el perímetro. */}
      <KitFarFog seed={SEED + 16} color="#9fc8f0" radius={HALF + 9} y={2.2} opacity={0.08} />
      {/* Niebla del Vacío en el altar y el nodo corrupto sellado. */}
      <KitGroundFog
        seed={SEED + 12}
        patches={[
          { count: 5, cx: LAYOUT.missionSpots[4][0], cz: LAYOUT.missionSpots[4][1], rx: 5, rz: 4, color: "#8d78d8", opacity: 0.3 },
          { count: 4, cx: LAYOUT.decorSpots.blocked[0], cz: LAYOUT.decorSpots.blocked[1], rx: 4, rz: 4, color: "#8d78d8", opacity: 0.34 },
          { count: 6, cx: 0, cz: CROSS.z, rx: HALF - 4, rz: 2.5, color: "#9fc8f0", opacity: 0.16 },
        ]}
      />
      {/* Motas de datos que ascienden por toda la ciudadela (Fase 7: +50%). */}
      <KitParticles
        seed={SEED + 13}
        count={scaleCount(180)}
        rx={HALF - 3}
        rz={HALF - 3}
        yMin={0.4}
        yMax={6.5}
        colors={["#38bdf8", "#7dd3fc", "#eaf6ff"]}
        size={0.24}
        opacity={0.8}
        mode="rise"
        speed={0.9}
      />
    </group>
  );
}
