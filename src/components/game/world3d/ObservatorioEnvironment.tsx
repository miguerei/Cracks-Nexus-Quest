// Fase 5 — Plataformas astrales (Observatorio).
//
// Dirección de arte (§8): índigo + estrellas + plata. El ÚNICO mundo nocturno
// luminoso: cielo estrellado, anillos orbitales gigantes inclinados, un gran
// telescopio y un suelo de constelaciones. La plataforma flota: sus bordes
// caen hacia un vacío estelar, y un hueco lo corta por el centro, cruzado
// SOLO por un puente de anillos. Ruta del layout: mirador sur → hueco →
// telescopio → constelaciones → claro → portal → altar del Vacío.

import { useMemo, useRef } from "react";
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
  makeGlowTexture,
  makeGroundHeightFn,
  mulberry32,
  vnoise,
} from "./environmentKit";
import { getWorldLayout, WORLD_CROSSINGS } from "./worldConfig";

const SEED = 555;
const LAYOUT = getWorldLayout("observatorio");
const HALF = LAYOUT.groundHalf;
const CROSS = WORLD_CROSSINGS.observatorio;

// La "luna" del observatorio: luz fría plateada desde el noroeste.
export const OBSERVATORIO_SUN: [number, number, number] = [-0.4, 0.75, -0.45];

// El borde CAE al vacío estelar (rimHeight negativo, drama en los bordes).
const heightFn = makeGroundHeightFn({
  half: HALF,
  crossZ: CROSS.z,
  carveDepth: 2,
  carveWidth: CROSS.half + 1,
  rimHeight: -3.4,
  rimNoise: 0.8,
});

// Senda de losas astrales: pasa por el vano del hueco (x=0).
const PATH_POINTS: [number, number][] = [
  [0, 21.5], [-3, 17], [-7, 14], [-10, 11], [-7, 8.9], [-3, 7.9],
  [0, 7.4], [0, 5.5], [0, 3.6], [3, 1.6], [6, 0], [8, -2],
  [4, -4], [-1, -5.5], [-6, -7], [-2, -9], [3, -10.5], [7, -11.4],
  [11, -12], [7, -13], [4, -13], [0, -12.6], [-4, -12], [1, -14],
  [7, -14.6], [13, -15], [8, -17], [4, -18.2], [0, -19],
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

// Losa índigo con motas de plata; el hueco y los bordes caen a azul-noche.
const C_STONE = new THREE.Color("#262a4c");
const C_STONE2 = new THREE.Color("#313666");
const C_SILVER = new THREE.Color("#5560a8");
const C_VOID = new THREE.Color("#0b0d1d");
function groundColor(x: number, z: number, y: number, out: THREE.Color) {
  const n = vnoise(x * 0.8, z * 0.8) * 0.5 + 0.5;
  out.copy(C_STONE).lerp(C_STONE2, n);
  if (vnoise(x * 2.3, z * 2.3) > 0.78) out.lerp(C_SILVER, 0.5);
  if (y < -0.4) out.lerp(C_VOID, Math.min(1, -y * 0.55));
}

// ---------------------------------------------------------------------------
// Anillos orbitales: tres aros gigantes inclinados que giran lentísimo sobre
// el mapa. Puro cielo cinético, sin colisión.
// ---------------------------------------------------------------------------
function AnillosOrbitales() {
  const g1 = useRef<THREE.Mesh>(null);
  const g2 = useRef<THREE.Mesh>(null);
  const g3 = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (g1.current) g1.current.rotation.z += dt * 0.02;
    if (g2.current) g2.current.rotation.z -= dt * 0.014;
    if (g3.current) g3.current.rotation.z += dt * 0.01;
  });
  return (
    <group>
      <mesh ref={g1} position={[0, 26, -18]} rotation={[1.15, 0.2, 0]}>
        <torusGeometry args={[26, 0.55, 6, 64]} />
        <meshStandardMaterial color="#aab2e8" emissive="#818cf8" emissiveIntensity={0.55} flatShading roughness={0.4} metalness={0.4} fog={false} />
      </mesh>
      <mesh ref={g2} position={[8, 32, -8]} rotation={[1.35, -0.3, 0.4]}>
        <torusGeometry args={[17, 0.4, 6, 56]} />
        <meshStandardMaterial color="#8890d8" emissive="#6a74d8" emissiveIntensity={0.45} flatShading roughness={0.4} metalness={0.4} fog={false} />
      </mesh>
      <mesh ref={g3} position={[-14, 22, 6]} rotation={[1.05, 0.5, -0.3]}>
        <torusGeometry args={[11, 0.3, 6, 48]} />
        <meshStandardMaterial color="#c7d2fe" emissive="#a5b4fc" emissiveIntensity={0.5} flatShading roughness={0.4} metalness={0.4} fog={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Gran telescopio: cúpula plateada con tubo apuntando a los anillos. Sólido
// (collider cilíndrico) junto al cristal 2, fuera de la senda.
// ---------------------------------------------------------------------------
function GranTelescopio({ x, z, rotY = -0.6 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.4, 1.9]} position={[0, 1.4, 0]} />
      </RigidBody>
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.8, 2.1, 1.6, 8]} />
        <meshStandardMaterial color="#2a2e52" flatShading roughness={0.8} />
      </mesh>
      <mesh position={[0, 2, 0]} castShadow>
        <sphereGeometry args={[1.7, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3c4278" flatShading roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Tubo del telescopio hacia el cielo. */}
      <mesh position={[0, 3.1, 0.9]} rotation={[-0.85, 0, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.6, 3.4, 8]} />
        <meshStandardMaterial color="#aab2e8" flatShading roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Lente que recoge la luz de las estrellas. */}
      <mesh position={[0, 4.35, 1.9]} rotation={[-0.85, 0, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 0.12, 8]} />
        <meshStandardMaterial color="#7dd3fc" emissive="#7dd3fc" emissiveIntensity={1.5} roughness={0.3} />
      </mesh>
      {/* Anillo de latón rúnico en la base. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[2.4, 2.9, 28]} />
        <meshStandardMaterial color="#818cf8" emissive="#818cf8" emissiveIntensity={0.8} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Suelo de constelaciones: estrellas engarzadas y trazos que las unen, planos
// sobre la losa (relieve 0). Alrededor del cristal 3.
// ---------------------------------------------------------------------------
function SueloConstelaciones({ cx, cz }: { cx: number; cz: number }) {
  const glowTex = useMemo(() => makeGlowTexture(), []);
  const { starGeo, lineGeo } = useMemo(() => {
    const rnd = mulberry32(SEED + 21);
    const stars: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) {
      // Cuatro constelaciones pequeñas alrededor del centro.
      const a = (i / 4) * Math.PI * 2 + 0.5;
      const bx = cx + Math.cos(a) * 3.6;
      const bz = cz + Math.sin(a) * 3.6;
      let px = bx;
      let pz = bz;
      for (let k = 0; k < 4; k++) {
        stars.push(new THREE.Vector3(px, 0, pz));
        px += (rnd() - 0.5) * 2.6;
        pz += (rnd() - 0.5) * 2.6;
      }
    }
    const sg = new THREE.BufferGeometry();
    const sp = new Float32Array(stars.length * 3);
    stars.forEach((s, i) => {
      sp[i * 3] = s.x;
      sp[i * 3 + 1] = heightFn(s.x, s.z) + 0.08;
      sp[i * 3 + 2] = s.z;
    });
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    // Trazos: cada constelación une sus 4 estrellas en cadena.
    const lp: number[] = [];
    for (let i = 0; i < stars.length - 1; i++) {
      if (i % 4 === 3) continue; // no unir constelaciones entre sí
      const a = stars[i];
      const b = stars[i + 1];
      lp.push(a.x, heightFn(a.x, a.z) + 0.07, a.z, b.x, heightFn(b.x, b.z) + 0.07, b.z);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3));
    return { starGeo: sg, lineGeo: lg };
  }, [cx, cz]);
  return (
    <group>
      <points geometry={starGeo}>
        <pointsMaterial
          map={glowTex}
          color="#c7d2fe"
          size={0.55}
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial color="#818cf8" transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Entorno raíz de las Plataformas astrales. Debe montarse DENTRO de <Physics>.
// ---------------------------------------------------------------------------
export default function ObservatorioEnvironment() {
  return (
    <group>
      {/* Noche estrellada: luna fría y cúpula llena de estrellas. */}
      <KitSky
        zenith="#05060f"
        mid="#131735"
        horizon="#2a2e5e"
        sunColor="#cdd6ff"
        sunDir={OBSERVATORIO_SUN}
        sunPow={170}
        halo={0.12}
        stars={950}
        starColor="#eaf6ff"
        starSeed={SEED + 1}
      />
      <AnillosOrbitales />
      {/* Agujas astrales lejanas, apenas plateadas. */}
      <KitSkyline
        seed={SEED + 2}
        rings={[
          { count: 12, radius: 52, spread: 14, hMin: 9, hMax: 18, rMin: 2, rMax: 3.6, color: "#20244a", kind: "crystal", emissive: "#818cf8", emissiveIntensity: 0.3, sink: 5 },
          { count: 9, radius: 74, spread: 18, hMin: 12, hMax: 24, rMin: 3, rMax: 5, color: "#171a38", kind: "box", emissive: "#4a54a8", emissiveIntensity: 0.2, sink: 6 },
        ]}
      />
      <KitGround half={HALF} heightFn={heightFn} colorFn={groundColor} />
      <KitPath
        curve={curve}
        heightFn={heightFn}
        colorA="#3c4278"
        colorB="#4a5292"
        emissive="#818cf8"
        emissiveIntensity={0.6}
        seed={SEED + 3}
      />
      {/* El vacío estelar: un río de estrellas bajo el hueco y los bordes. */}
      <FlowPlane
        width={160}
        length={160}
        position={[0, -1.5, 0]}
        deep="#0b0d22"
        light="#4a54a8"
        speed={0.18}
        alpha={0.95}
      />
      <KitWalkway
        crossing={CROSS}
        colorA="#c7d2fe"
        colorB="#818cf8"
        emissive="#a5b4fc"
        emissiveIntensity={1.35}
        railColor="#2a2e52"
        railGem="#e0e7ff"
        seed={SEED + 4}
      />
      <KitBankRocks
        crossing={CROSS}
        half={HALF}
        heightFn={heightFn}
        color="#343a66"
        emissive="#818cf8"
        emissiveIntensity={0.45}
        seed={SEED + 5}
      />
      <GranTelescopio x={11.5} z={0.5} />
      <SueloConstelaciones cx={LAYOUT.missionSpots[2][0]} cz={LAYOUT.missionSpots[2][1]} />
      {LAYOUT.missionSpots.slice(0, 4).map(([sx, sz], i) => (
        <KitPedestal key={i} x={sx} z={sz} stone="#3c4278" stoneDark="#2a2e52" ringColor="#a5b4fc" ringIntensity={1.4} />
      ))}
      <KitVoidAltar x={LAYOUT.missionSpots[4][0]} z={LAYOUT.missionSpots[4][1]} seed={SEED + 9} />
      <KitSealedZone x={LAYOUT.decorSpots.blocked[0]} z={LAYOUT.decorSpots.blocked[1]} seed={SEED + 10} />
      <KitPortalFrame x={LAYOUT.decorSpots.portal[0]} z={LAYOUT.decorSpots.portal[1]} stone="#3c4278" stoneDark="#2a2e52" gemColor="#a5b4fc" />
      <ObstacleShells obstacles={LAYOUT.obstacles} color="#31366a" capColor="#434a88" emissive="#4a54a8" emissiveIntensity={0.3} kind="block" />
      {/* Astrolabios rotos: aros y fragmentos plateados fuera de la ruta. */}
      <KitScatter
        seed={SEED + 11}
        count={38}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<torusGeometry args={[0.65, 0.12, 5, 14]} />}
        color="#7880c8"
        colorB="#aab2e8"
        emissive="#818cf8"
        emissiveIntensity={0.4}
        sMin={0.4}
        sMax={1}
        avoidDist={1.9}
      />
      {/* Fragmentos de losa flotados en el borde. */}
      <KitScatter
        seed={SEED + 12}
        count={30}
        half={HALF}
        heightFn={heightFn}
        avoid={avoidSpots}
        crossZ={CROSS.z}
        crossHalf={CROSS.half + 1.6}
        geometry={<dodecahedronGeometry args={[0.8, 0]} />}
        color="#2a2e52"
        colorB="#3c4278"
        sMin={0.4}
        sMax={1.1}
        avoidDist={2}
      />
      {/* Bruma del Vacío en el altar y la plataforma sellada. */}
      <KitGroundFog
        seed={SEED + 13}
        patches={[
          { count: 5, cx: LAYOUT.missionSpots[4][0], cz: LAYOUT.missionSpots[4][1], rx: 5, rz: 4, color: "#8d78d8", opacity: 0.32 },
          { count: 4, cx: LAYOUT.decorSpots.blocked[0], cz: LAYOUT.decorSpots.blocked[1], rx: 4, rz: 4, color: "#8d78d8", opacity: 0.34 },
          { count: 5, cx: 0, cz: CROSS.z, rx: HALF - 4, rz: 2.5, color: "#6a74c8", opacity: 0.16 },
        ]}
      />
      {/* Polvo de estrellas en suspensión por toda la plataforma. */}
      <KitParticles
        seed={SEED + 14}
        count={130}
        rx={HALF - 2}
        rz={HALF - 2}
        yMin={0.4}
        yMax={7}
        colors={["#c7d2fe", "#eaf6ff", "#818cf8"]}
        size={0.24}
        opacity={0.8}
        mode="drift"
        speed={0.45}
      />
      {/* Estrellas fugaces: motas que caen en bucle lejos del centro. */}
      <KitParticles
        seed={SEED + 15}
        count={24}
        rx={HALF + 8}
        rz={HALF + 8}
        yMin={8}
        yMax={20}
        colors={["#eaf6ff"]}
        size={0.4}
        opacity={0.7}
        mode="fall"
        speed={1.6}
      />
    </group>
  );
}
