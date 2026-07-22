// Fase 5 — Fortaleza del Vacío. Fase 9 — pase de densidad (Cine Pass).
//
// Dirección de arte (§8): violeta/negro + magma frío. El ÚNICO mundo oscuro
// del juego — pero legible: el héroe siempre se ve. Púas de obsidiana, niebla
// violeta densa, y un foso de magma frío que corta el patio y SOLO se cruza
// por un paso de obsidiana. Los emisivos del Vacío laten a ~0.6 (amenaza
// sorda, §9); los acentos del jugador (senda, pedestales, portal) sí brillan.
// Ruta del layout: patio de púas → foso → fauces → grietas frías → refugio →
// portal → trono del Vacío.
//
// Fase 9 añade: textura de detalle de roca en el suelo, masas ×2-3 (púas,
// colmillos menores, flores del Vacío, grietas emisivas), esquirlas flotantes,
// glint+espuma de energía en el foso, niebla lejana, haces de vigilancia del
// Vacío, nubes negras con parallax y un trono/altar que imponen más.

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
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

const SEED = 666;
const LAYOUT = getWorldLayout("fortaleza-vacio");
const HALF = LAYOUT.groundHalf;
const CROSS = WORLD_CROSSINGS["fortaleza-vacio"];

// Luz fría tenue: una luna enferma tras la bruma, desde el noreste.
export const FORTALEZA_SUN: [number, number, number] = [0.35, 0.8, -0.4];
// Vigilancia del Vacío: haces fríos casi cenitales, como focos desde arriba.
const VOID_GAZE: [number, number, number] = [0.06, 1, -0.05];

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
// Fase 9 — Esquirlas flotantes: fragmentos de obsidiana suspendidos que giran
// y ondulan MUY despacio sobre las cabezas (y ≥ 2.6, sin colisión). Un solo
// instancedMesh actualizado por frame: 1 draw call.
// ---------------------------------------------------------------------------
function EsquirlasFlotantes({ seed, count }: { seed: number; count: number }) {
  const items = useMemo(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      x: (rnd() - 0.5) * (HALF * 2 - 6),
      z: (rnd() - 0.5) * (HALF * 2 - 6),
      y: 2.6 + rnd() * 3.2,
      s: 0.16 + rnd() * 0.3,
      sp: 0.18 + rnd() * 0.45,
      ph: rnd() * Math.PI * 2,
      rx: rnd() * Math.PI,
      ry: rnd() * Math.PI,
    }));
  }, [seed, count]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(
    () => ({ M: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3() }),
    [],
  );
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    items.forEach((it, i) => {
      tmp.p.set(it.x, it.y + Math.sin(t * it.sp + it.ph) * 0.5, it.z);
      tmp.e.set(it.rx + t * it.sp * 0.4, it.ry + t * it.sp * 0.3, 0);
      tmp.q.setFromEuler(tmp.e);
      tmp.s.setScalar(it.s);
      tmp.M.compose(tmp.p, tmp.q, tmp.s);
      m.setMatrixAt(i, tmp.M);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <tetrahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#241a30" emissive="#7c3aed" emissiveIntensity={0.55} flatShading roughness={0.5} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Fase 9 — Grietas emisivas del suelo: losas finísimas violeta (~0.6) que
// laten todas juntas, colocadas de forma determinista FUERA de la senda y del
// foso. Un instancedMesh estático + un solo material animado: 1 draw call.
// ---------------------------------------------------------------------------
function GrietasDelSuelo({ seed, count }: { seed: number; count: number }) {
  const items = useMemo(() => {
    const rnd = mulberry32(seed);
    const out: { m: THREE.Matrix4 }[] = [];
    const M = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    let guard = 0;
    while (out.length < count && guard++ < count * 14) {
      const x = (rnd() - 0.5) * (HALF * 2 - 4);
      const z = (rnd() - 0.5) * (HALF * 2 - 4);
      if (Math.abs(z - CROSS.z) < CROSS.half + 1.8) continue;
      let near = false;
      for (const [ax, az] of avoidSpots) {
        if ((ax - x) * (ax - x) + (az - z) * (az - z) < 4.4) {
          near = true;
          break;
        }
      }
      if (near) continue;
      const len = 1.4 + rnd() * 2.6;
      const w = 0.07 + rnd() * 0.1;
      p.set(x, heightFn(x, z) + 0.03, z);
      e.set(0, rnd() * Math.PI, 0);
      q.setFromEuler(e);
      s.set(len, 1, w);
      M.compose(p, q, s);
      out.push({ m: M.clone() });
    }
    return out;
  }, [seed, count]);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    // Latido lento y sordo de toda la red de grietas a la vez.
    if (mat.current) mat.current.emissiveIntensity = 0.6 + Math.sin(state.clock.elapsedTime * 0.9) * 0.12;
  });
  return (
    <instancedMesh
      ref={(m) => {
        if (!m) return;
        items.forEach((it, i) => m.setMatrixAt(i, it.m));
        m.instanceMatrix.needsUpdate = true;
      }}
      args={[undefined, undefined, items.length]}
    >
      <boxGeometry args={[1, 0.05, 1]} />
      <meshStandardMaterial ref={mat} color="#1a0f26" emissive="#a855f7" emissiveIntensity={0.6} flatShading roughness={0.6} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Trono del Vacío (Fase 9: más imponente): dais, respaldo ancho, corona de
// púas de hasta ~9 u, hombreras de púas, veta emisiva y el núcleo del Coloso
// latiendo (intensidad + escala) con una corona de esquirlas orbitando.
// Collider detrás del altar, fuera de la ruta.
// ---------------------------------------------------------------------------
function TronoDelVacio({ x, z }: { x: number; z: number }) {
  const core = useRef<THREE.MeshStandardMaterial>(null);
  const coreMesh = useRef<THREE.Mesh>(null);
  const shards = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const beat = Math.sin(t * 1.1);
    if (core.current) core.current.emissiveIntensity = 0.55 + beat * 0.18;
    if (coreMesh.current) coreMesh.current.scale.setScalar(1 + beat * 0.07);
    if (shards.current) {
      shards.current.rotation.y = t * 0.35;
      shards.current.children.forEach((c, i) => {
        c.position.y = Math.sin(t * 1.2 + i * 1.5) * 0.28;
      });
    }
  });
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[3, 2.6]} position={[0, 3, 0]} />
      </RigidBody>
      {/* Dais de obsidiana. */}
      <mesh position={[0, 0.14, 0]} receiveShadow>
        <cylinderGeometry args={[3.6, 3.9, 0.28, 8]} />
        <meshStandardMaterial color="#1c1226" flatShading roughness={0.9} />
      </mesh>
      {/* Corona de púas del respaldo (más alta y más densa que en Fase 5). */}
      {[-3.1, -2.1, -1.05, 0, 1.05, 2.1, 3.1].map((sx, i) => (
        <mesh key={i} position={[sx, 2.6 + (3.1 - Math.abs(sx)) * 1.15, 0]} rotation={[0, 0, sx * -0.1]} castShadow>
          <coneGeometry args={[0.55, 4.6 + (3.1 - Math.abs(sx)) * 2.1, 4]} />
          <meshStandardMaterial color="#1c1226" flatShading roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.4, 2.4, 1.8]} />
        <meshStandardMaterial color="#241a30" flatShading roughness={0.7} />
      </mesh>
      {/* Veta emisiva que recorre el frente del respaldo (amenaza sorda). */}
      <mesh position={[0, 1.62, 0.92]}>
        <boxGeometry args={[4.6, 0.1, 0.05]} />
        <meshStandardMaterial color="#1a1028" emissive="#7c3aed" emissiveIntensity={0.6} flatShading />
      </mesh>
      {/* Hombreras: racimos de púas inclinadas a ambos flancos. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 3.3, 0, 0.2]}>
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[side * i * 0.42, 1 + i * 0.75, -i * 0.18]}
              rotation={[-0.12, 0, side * (0.32 + i * 0.14)]}
              castShadow
            >
              <coneGeometry args={[0.36 - i * 0.07, 2.6 - i * 0.5, 4]} />
              <meshStandardMaterial color="#1c1226" flatShading roughness={0.55} />
            </mesh>
          ))}
        </group>
      ))}
      {/* El núcleo del Vacío observa el patio: late en intensidad Y tamaño. */}
      <mesh ref={coreMesh} position={[0, 3.9, 0.75]}>
        <octahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial ref={core} color="#1a1028" emissive="#7c3aed" emissiveIntensity={0.6} flatShading />
      </mesh>
      {/* Corona de esquirlas orbitando el núcleo. */}
      <group position={[0, 3.9, 0.75]}>
        <group ref={shards}>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5]} rotation={[a, a * 2, 0]}>
                <tetrahedronGeometry args={[0.22, 0]} />
                <meshStandardMaterial color="#1c1226" emissive="#a855f7" emissiveIntensity={0.6} flatShading />
              </mesh>
            );
          })}
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Entorno raíz de la Fortaleza. Debe montarse DENTRO de <Physics>.
// ---------------------------------------------------------------------------
export default function FortalezaEnvironment() {
  return (
    <group>
      {/* Cielo del Vacío: negro-violeta con ascuas de estrellas moribundas y
          (Fase 9) bandas de nubes negras-violeta con parallax lentísimo. */}
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
        cloudBands={[
          { count: 5, y: 40, radius: 200, scale: 190, color: "#180d26", opacity: 0.42, speed: 0.002 },
          { count: 4, y: 62, radius: 225, scale: 210, color: "#2a1640", opacity: 0.3, speed: 0.0013 },
          { count: 3, y: 26, radius: 185, scale: 160, color: "#4a2a66", opacity: 0.2, speed: 0.0026 },
        ]}
        cloudSeed={SEED + 20}
      />
      {/* Murallas de púas de obsidiana cerrando el horizonte. */}
      <KitSkyline
        seed={SEED + 2}
        rings={[
          { count: 17, radius: 44, spread: 12, hMin: 14, hMax: 28, rMin: 3, rMax: 5.5, color: "#1c1226", sides: 4, emissive: "#7c3aed", emissiveIntensity: 0.22, sink: 5 },
          { count: 12, radius: 66, spread: 18, hMin: 20, hMax: 40, rMin: 5, rMax: 8, color: "#140c1e", sides: 4, emissive: "#5b21b6", emissiveIntensity: 0.14, sink: 6 },
        ]}
      />
      {/* Fase 9: obsidiana con moteado mineral + grietas finas (bump). Las
          vetas violeta tenues las ponen los vertex colors (C_VEIN). */}
      <KitGround
        half={HALF}
        heightFn={heightFn}
        colorFn={groundColor}
        detailStyle="roca"
        detailSeed={SEED + 21}
        detailRepeat={26}
        bumpScale={0.07}
      />
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
      {/* Foso de magma frío violeta bajo el paso de obsidiana. Fase 9: glint
          de la luna enferma + espuma de energía lamiendo las orillas. */}
      <FlowPlane
        width={HALF * 2 + 8}
        length={CROSS.half * 2 + 1.6}
        position={[0, -0.5, CROSS.z]}
        deep="#1c1030"
        light="#7c3aed"
        speed={0.32}
        alpha={0.96}
        sunDir={FORTALEZA_SUN}
        glint={0.35}
        glintColor="#d8c2ff"
        foam={0.35}
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
      {/* Fase 9: la antesala del jefe intimida — colmillos escoltando el
          altar y el trono, fuera de la senda. */}
      <Colmillo x={-6.5} z={-22.5} h={8} rotY={0.9} phase={2.8} />
      <Colmillo x={6.5} z={-23.5} h={8.5} rotY={2.4} tilt={-0.14} phase={1.1} />
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
      {/* Campo de púas menores: la fortaleza entera está erizada (Fase 9: ×2.3). */}
      <KitScatter
        seed={SEED + 12}
        count={scaleCount(150)}
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
      {/* Fase 9: colmillos menores en racimos — el estrato intermedio entre
          las púas de suelo y los Colmillos con collider. */}
      <KitScatter
        seed={SEED + 22}
        count={scaleCount(44)}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.8}
        geometry={<coneGeometry args={[0.45, 2.4, 4]} />}
        color="#1c1226"
        colorB="#241a30"
        emissive="#5b21b6"
        emissiveIntensity={0.3}
        sMin={0.7}
        sMax={1.4}
        yStretchMin={1.2}
        yStretchMax={2}
        avoidDist={2.1}
      />
      {/* Grietas frías: fragmentos violeta a ras de suelo (cristal 3, ×2.3). */}
      <KitScatter
        seed={SEED + 13}
        count={scaleCount(70)}
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
      {/* Fase 9: flores del Vacío — cristalitos violeta apagados, la única
          "vegetación" que crece en la obsidiana. */}
      <KitScatter
        seed={SEED + 23}
        count={scaleCount(90)}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<octahedronGeometry args={[0.5, 0]} />}
        color="#3a2456"
        colorB="#6d3fa8"
        emissive="#a855f7"
        emissiveIntensity={0.6}
        sMin={0.16}
        sMax={0.4}
        yStretchMin={1.2}
        yStretchMax={1.8}
        sink={0.05}
        avoidDist={1.7}
      />
      {/* Fase 9: red de grietas emisivas latiendo bajo los pies. */}
      <GrietasDelSuelo seed={SEED + 24} count={scaleCount(34)} />
      {/* Fase 9: esquirlas de obsidiana suspendidas sobre el patio. */}
      <EsquirlasFlotantes seed={SEED + 25} count={scaleCount(30)} />
      {/* Fase 9: vigilancia del Vacío — dos haces fríos casi cenitales sobre
          el trono y las fauces. Conos aditivos, cero luces reales. */}
      <KitLightShafts
        spots={[[0, -22.5], [-8, -1]]}
        sunDir={VOID_GAZE}
        color="#7c5ad8"
        opacity={0.075}
        radius={2.8}
        height={16}
        y={7}
      />
      {/* Fase 9: bruma lejana densa cerrando el perímetro (la más espesa de
          todos los mundos: es la firma del único mundo oscuro). */}
      <KitFarFog seed={SEED + 26} color="#5a4390" count={9} radius={HALF + 8} y={2.6} scale={32} opacity={0.15} />
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
      {/* Ascuas del Vacío: motas violeta que ascienden despacio (Fase 9: +50%). */}
      <KitParticles
        seed={SEED + 15}
        count={scaleCount(128)}
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
