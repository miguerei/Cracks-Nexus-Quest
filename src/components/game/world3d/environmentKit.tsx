// Fase 5 — Kit de entorno compartido para los mundos de Nexus Quest.
//
// Extrae la gramática visual del Bosque (Fase 4-B) en piezas parametrizables:
// cielo con sol/estrellas, skyline lejano, suelo esculpido con vertex colors,
// cinta de senda, láminas de flujo (agua/energía), niebla baja, partículas de
// vida ambiental, pedestales, portal, altar del Vacío y paso elevado del cruce.
//
// Todo es determinista (mulberry32) y sin luces nuevas: los acentos brillan
// con emisivos (≥1.2 para el bloom; el Vacío emite ~0.6, amenaza sorda).

import { useMemo, useRef } from "react";
import type { ReactElement } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

import {
  makeFogTexture,
  makeGlowTexture,
  mulberry32,
  smoothstep,
  vnoise,
} from "./BosqueEnvironment";
import type { CrossingSpec } from "./worldConfig";

export { mulberry32, smoothstep, vnoise, makeGlowTexture, makeFogTexture };

// ---------------------------------------------------------------------------
// Terreno: fábrica de funciones de altura con la forma canónica del Bosque —
// interior casi plano (la física es un plano, relieve ≤0.1), berma en el
// borde y cauce hundido en la línea del cruce.
// ---------------------------------------------------------------------------
export type GroundHeightOpts = {
  /** Medio ancho jugable del mundo. */
  half: number;
  /** Línea z del cruce (cauce hundido). */
  crossZ: number;
  /** Profundidad del cauce (por defecto 1.2, como el río del Bosque). */
  carveDepth?: number;
  /** Semiancho del hundimiento del cauce. */
  carveWidth?: number;
  /** Altura de la berma del borde. */
  rimHeight?: number;
  /** Amplitud del ruido de la berma. */
  rimNoise?: number;
  /** Amplitud del ruido interior (SIEMPRE ≤0.1: la física es un plano). */
  innerNoise?: number;
};

export function makeGroundHeightFn(opts: GroundHeightOpts) {
  const {
    half,
    crossZ,
    carveDepth = 1.2,
    carveWidth = 2.6,
    rimHeight = 3.4,
    rimNoise = 1.5,
    innerNoise = 0.08,
  } = opts;
  return (x: number, z: number): number => {
    const r = Math.max(Math.abs(x), Math.abs(z));
    const rim = smoothstep(half - 5, half + 14, r);
    let h = rim * rim * (rimHeight + vnoise(x * 0.6, z * 0.6) * rimNoise);
    h += (1 - rim) * vnoise(x, z) * innerNoise;
    const dCross = Math.abs(z - crossZ);
    const carve = 1 - smoothstep(0.2, carveWidth, dCross);
    h -= carve * carve * carveDepth * (1 - rim * 0.9);
    return h;
  };
}

/** Curva CatmullRom de la senda a partir de puntos [x, z]. */
export function buildCurve(points: [number, number][]) {
  const pts = points.map(([x, z]) => new THREE.Vector3(x, 0, z));
  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.4);
}

// ---------------------------------------------------------------------------
// Cielo: cúpula con gradiente + sol + estrellas opcionales. Ignora la niebla.
// ---------------------------------------------------------------------------
export type KitSkyProps = {
  zenith: string;
  mid: string;
  horizon: string;
  sunColor: string;
  sunDir: [number, number, number];
  /** Exponente del disco solar (menor = disco más grande). */
  sunPow?: number;
  /** Intensidad del halo amplio del sol. */
  halo?: number;
  /** Estrellas en la cúpula (0 = ninguna). */
  stars?: number;
  starColor?: string;
  starSeed?: number;
};

export function KitSky({
  zenith,
  mid,
  horizon,
  sunColor,
  sunDir,
  sunPow = 90,
  halo = 0.28,
  stars = 0,
  starColor = "#eaf6ff",
  starSeed = 9,
}: KitSkyProps) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color(zenith) },
          uMid: { value: new THREE.Color(mid) },
          uHorizon: { value: new THREE.Color(horizon) },
          uSun: { value: new THREE.Vector3(...sunDir).normalize() },
          uSunColor: { value: new THREE.Color(sunColor) },
          uSunPow: { value: sunPow },
          uHalo: { value: halo },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon;
          uniform vec3 uSun; uniform vec3 uSunColor;
          uniform float uSunPow; uniform float uHalo;
          void main() {
            float h = clamp(vDir.y, -0.12, 1.0);
            vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
            col = mix(col, uZenith, smoothstep(0.18, 0.72, h));
            float s = clamp(dot(normalize(vDir), normalize(uSun)), 0.0, 1.0);
            col += uSunColor * pow(s, uSunPow) * 1.1;   // disco
            col += uSunColor * pow(s, 6.0) * uHalo;     // halo amplio
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [zenith, mid, horizon, sunColor, sunDir, sunPow, halo],
  );

  const starGeo = useMemo(() => {
    if (stars <= 0) return null;
    const rnd = mulberry32(starSeed);
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(stars * 3);
    for (let i = 0; i < stars; i++) {
      // Hemisferio superior de la cúpula (nunca bajo el horizonte).
      const a = rnd() * Math.PI * 2;
      const y = 0.08 + rnd() * 0.9;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      pos[i * 3] = Math.cos(a) * r * 290;
      pos[i * 3 + 1] = y * 290;
      pos[i * 3 + 2] = Math.sin(a) * r * 290;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [stars, starSeed]);
  const glowTex = useMemo(() => (stars > 0 ? makeGlowTexture() : null), [stars]);

  return (
    <group>
      <mesh material={mat} renderOrder={-10}>
        <sphereGeometry args={[300, 32, 18]} />
      </mesh>
      {starGeo && (
        <points geometry={starGeo} renderOrder={-9}>
          <pointsMaterial
            map={glowTex!}
            color={starColor}
            size={2.4}
            transparent
            opacity={0.9}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            sizeAttenuation
            fog={false}
          />
        </points>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Skyline lejano: anillos de siluetas low-poly difuminadas por la niebla.
// ---------------------------------------------------------------------------
export type SkylineRing = {
  count: number;
  radius: number;
  /** Variación radial. */
  spread: number;
  hMin: number;
  hMax: number;
  rMin: number;
  rMax: number;
  color: string;
  /** "cone" (montaña/duna/púa), "box" (torre) o "crystal" (aguja bipiramidal). */
  kind?: "cone" | "box" | "crystal";
  /** Lados del cono (5-6 montaña, 4 púa afilada). */
  sides?: number;
  /** Hundimiento vertical extra (para asomar solo la cima). */
  sink?: number;
  emissive?: string;
  emissiveIntensity?: number;
};

export function KitSkyline({ seed, rings }: { seed: number; rings: SkylineRing[] }) {
  const data = useMemo(() => {
    const rnd = mulberry32(seed);
    return rings.map((ring) =>
      Array.from({ length: ring.count }, (_, i) => {
        const a = (i / ring.count) * Math.PI * 2 + rnd() * (Math.PI / ring.count);
        const r = ring.radius + rnd() * ring.spread;
        const h = ring.hMin + rnd() * (ring.hMax - ring.hMin);
        const s = ring.rMin + rnd() * (ring.rMax - ring.rMin);
        return {
          pos: [Math.cos(a) * r, h * 0.32 - (ring.sink ?? 6), Math.sin(a) * r] as [number, number, number],
          s: [s, h, s * (0.85 + rnd() * 0.3)] as [number, number, number],
          rot: rnd() * Math.PI,
        };
      }),
    );
  }, [seed, rings]);
  return (
    <group>
      {rings.map((ring, k) =>
        data[k].map((m, i) => (
          <mesh key={`${k}-${i}`} position={m.pos} rotation={[0, m.rot, 0]} scale={m.s}>
            {ring.kind === "box" ? (
              <boxGeometry args={[1, 1, 1]} />
            ) : ring.kind === "crystal" ? (
              <octahedronGeometry args={[0.62, 0]} />
            ) : (
              <coneGeometry args={[1, 1, ring.sides ?? 5]} />
            )}
            <meshStandardMaterial
              color={ring.color}
              flatShading
              roughness={1}
              emissive={ring.emissive ?? "#000000"}
              emissiveIntensity={ring.emissiveIntensity ?? 0}
            />
          </mesh>
        )),
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Suelo esculpido con vertex colors. colorFn escribe el color en `out`.
// ---------------------------------------------------------------------------
export function KitGround({
  half,
  heightFn,
  colorFn,
  seg = 110,
  pad = 40,
}: {
  half: number;
  heightFn: (x: number, z: number) => number;
  colorFn: (x: number, z: number, y: number, out: THREE.Color) => void;
  seg?: number;
  pad?: number;
}) {
  const geo = useMemo(() => {
    const size = (half + pad) * 2;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = heightFn(x, z);
      pos.setY(i, y);
      colorFn(x, z, y, tmp);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [half, heightFn, colorFn, seg, pad]);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Cinta de senda sobre el terreno (con emisivo opcional: sendas de energía).
// ---------------------------------------------------------------------------
export function KitPath({
  curve,
  heightFn,
  colorA,
  colorB,
  width = 1.55,
  emissive,
  emissiveIntensity = 1.2,
  seed = 64,
}: {
  curve: THREE.CatmullRomCurve3;
  heightFn: (x: number, z: number) => number;
  colorA: string;
  colorB: string;
  width?: number;
  emissive?: string;
  emissiveIntensity?: number;
  seed?: number;
}) {
  const geo = useMemo(() => {
    const N = 220;
    const verts: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];
    const ca = new THREE.Color(colorA);
    const cb = new THREE.Color(colorB);
    const tmp = new THREE.Color();
    const rnd = mulberry32(seed);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const nrm = new THREE.Vector3().crossVectors(tan, up).normalize();
      const y = heightFn(p.x, p.z) + 0.05;
      const wobble = width / 2 + Math.sin(t * 40) * 0.12;
      tmp.copy(ca).lerp(cb, rnd() * 0.7);
      verts.push(p.x - nrm.x * wobble, y, p.z - nrm.z * wobble);
      verts.push(p.x + nrm.x * wobble, y, p.z + nrm.z * wobble);
      cols.push(tmp.r, tmp.g, tmp.b, tmp.r * 0.92, tmp.g * 0.92, tmp.b * 0.92);
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [curve, heightFn, colorA, colorB, width, seed]);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={1}
        polygonOffset
        polygonOffsetFactor={-2}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissive ? emissiveIntensity : 0}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Lámina de flujo: el shader de agua del Bosque parametrizado (agua, datos,
// arena que fluye, estrellas líquidas…). Horizontal por defecto.
// ---------------------------------------------------------------------------
export function FlowPlane({
  width,
  length,
  position,
  deep,
  light,
  speed = 0.7,
  alpha = 0.93,
}: {
  /** Ancho (x). */
  width: number;
  /** Largo (z). */
  length: number;
  position: [number, number, number];
  deep: string;
  light: string;
  speed?: number;
  alpha?: number;
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(deep) },
          uLight: { value: new THREE.Color(light) },
          uSpeed: { value: speed },
          uAlpha: { value: alpha },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uTime; uniform float uSpeed; uniform float uAlpha;
          uniform vec3 uDeep; uniform vec3 uLight;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
          void main() {
            float flow = vUv.x * 26.0 - uTime * uSpeed;
            float band = sin(flow + sin(vUv.y * 9.0 + uTime * 0.8) * 0.9) * 0.5 + 0.5;
            vec3 col = mix(uDeep, uLight, band * 0.45 + 0.12);
            vec2 cell = floor(vec2(flow * 2.2, vUv.y * 12.0));
            float tw = step(0.94, hash(cell) * (0.75 + 0.25 * sin(uTime * 3.0 + hash(cell.yx) * 6.28)));
            col += tw * 0.55;
            float edge = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
            gl_FragColor = vec4(col, uAlpha * (0.35 + 0.65 * edge));
          }
        `,
      }),
    [deep, light, speed, alpha],
  );
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} material={mat}>
      <planeGeometry args={[width, length, 1, 1]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Niebla baja por parches (con parches del Vacío en altar y zona sellada).
// ---------------------------------------------------------------------------
export type FogPatch = {
  count: number;
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  color: string;
  opacity: number;
};

export function KitGroundFog({ seed, patches }: { seed: number; patches: FogPatch[] }) {
  const tex = useMemo(() => makeFogTexture(), []);
  const banks = useMemo(() => {
    const rnd = mulberry32(seed);
    return patches.flatMap((p) =>
      Array.from({ length: p.count }, () => ({
        x: p.cx + (rnd() - 0.5) * 2 * p.rx,
        z: p.cz + (rnd() - 0.5) * 2 * p.rz,
        y: 0.7 + rnd() * 1.1,
        s: 8 + rnd() * 9,
        speed: 0.12 + rnd() * 0.2,
        phase: rnd() * Math.PI * 2,
        color: p.color,
        opacity: p.opacity,
      })),
    );
  }, [seed, patches]);
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    banks.forEach((b, i) => {
      const s = refs.current[i];
      if (!s) return;
      s.position.x = b.x + Math.sin(t * b.speed + b.phase) * 2.2;
      s.position.z = b.z + Math.cos(t * b.speed * 0.8 + b.phase) * 1.8;
    });
  });
  return (
    <group>
      {banks.map((b, i) => (
        <sprite key={i} ref={(el) => (refs.current[i] = el)} position={[b.x, b.y, b.z]} scale={[b.s, b.s * 0.5, 1]}>
          <spriteMaterial map={tex} color={b.color} transparent opacity={b.opacity} depthWrite={false} fog={false} />
        </sprite>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Partículas de vida ambiental: puntos aditivos con tres modos de movimiento.
// ---------------------------------------------------------------------------
export function KitParticles({
  seed,
  count,
  cx = 0,
  cz = 0,
  rx,
  rz,
  yMin,
  yMax,
  colors,
  size = 0.3,
  opacity = 0.85,
  mode = "drift",
  speed = 1,
}: {
  seed: number;
  count: number;
  cx?: number;
  cz?: number;
  rx: number;
  rz: number;
  yMin: number;
  yMax: number;
  colors: string[];
  size?: number;
  opacity?: number;
  /** "drift" = merodeo (luciérnagas), "rise" = ascenso en bucle, "fall" = caída en bucle. */
  mode?: "drift" | "rise" | "fall";
  speed?: number;
}) {
  const tex = useMemo(() => makeGlowTexture(), []);
  const seeds = useMemo(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      cx: cx + (rnd() - 0.5) * 2 * rx,
      cz: cz + (rnd() - 0.5) * 2 * rz,
      cy: yMin + rnd() * (yMax - yMin),
      r: 0.6 + rnd() * 2,
      sp: (0.3 + rnd() * 0.7) * speed,
      ph: rnd() * Math.PI * 2,
      ci: Math.floor(rnd() * colors.length),
    }));
  }, [seed, count, cx, cz, rx, rz, yMin, yMax, colors.length, speed]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = colors.map((c) => new THREE.Color(c));
    seeds.forEach((s, i) => {
      pos[i * 3] = s.cx;
      pos[i * 3 + 1] = s.cy;
      pos[i * 3 + 2] = s.cz;
      const c = palette[s.ci];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    });
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [seeds, count, colors]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const attr = geom.attributes.position as THREE.BufferAttribute;
    const span = Math.max(0.001, yMax - yMin);
    seeds.forEach((s, i) => {
      const wx = s.cx + Math.sin(t * s.sp + s.ph) * s.r;
      const wz = s.cz + Math.cos(t * s.sp * 0.8 + s.ph) * s.r;
      let y = s.cy;
      if (mode === "drift") {
        y = s.cy + Math.sin(t * s.sp * 1.7 + s.ph * 2) * 0.5;
      } else {
        const k = (t * s.sp * 0.6 + s.ph) % 1;
        y = mode === "rise" ? yMin + k * span : yMax - k * span;
      }
      attr.setXYZ(i, wx, y, wz);
    });
    attr.needsUpdate = true;
  });
  return (
    <points geometry={geom}>
      <pointsMaterial
        map={tex}
        size={size}
        vertexColors
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Pedestal bajo un cristal de misión: ancla el nodo al mundo.
// ---------------------------------------------------------------------------
export function KitPedestal({
  x,
  z,
  y = 0,
  stone,
  stoneDark,
  ringColor,
  ringIntensity = 1.2,
}: {
  x: number;
  z: number;
  y?: number;
  stone: string;
  stoneDark: string;
  ringColor: string;
  ringIntensity?: number;
}) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[1.15, 1.32, 0.12, 8]} />
        <meshStandardMaterial color={stoneDark} flatShading roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.13, 0]}>
        <ringGeometry args={[0.72, 0.92, 24]} />
        <meshStandardMaterial
          color={ringColor}
          emissive={ringColor}
          emissiveIntensity={ringIntensity}
          transparent
          opacity={0.65}
          side={THREE.DoubleSide}
        />
      </mesh>
      {[0.9, 2.4, 4].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 1.5, 0.12, Math.sin(a) * 1.5]} scale={0.2 + i * 0.05}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={stone} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Marco del portal de vuelta al mapa.
// ---------------------------------------------------------------------------
export function KitPortalFrame({
  x,
  z,
  stone,
  stoneDark,
  gemColor = "#a78bfa",
}: {
  x: number;
  z: number;
  stone: string;
  stoneDark: string;
  gemColor?: string;
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.09, 0]} receiveShadow>
        <cylinderGeometry args={[2, 2.15, 0.18, 8]} />
        <meshStandardMaterial color={stoneDark} flatShading roughness={1} />
      </mesh>
      {[-1.4, 1.4].map((sx) => (
        <mesh key={sx} position={[sx, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.3, 2.6, 7]} />
          <meshStandardMaterial color={stone} flatShading roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 2.85, 0]} castShadow>
        <boxGeometry args={[3.4, 0.4, 0.5]} />
        <meshStandardMaterial color={stoneDark} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 3.15, 0]}>
        <boxGeometry args={[0.5, 0.26, 0.4]} />
        <meshStandardMaterial color={gemColor} emissive={gemColor} emissiveIntensity={1.8} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Altar del Vacío (jefe): dais oscuro, anillo violeta, púas y fragmentos que
// orbitan. El Vacío emite ~0.6 (amenaza sorda), solo el anillo sube a 1.5.
// ---------------------------------------------------------------------------
export function KitVoidAltar({
  x,
  z,
  base = "#2c2338",
  baseDark = "#221a2e",
  ring = "#a855f7",
  spike = "#3a2a52",
  spikeEmissive = "#7c3aed",
  seed = 53,
}: {
  x: number;
  z: number;
  base?: string;
  baseDark?: string;
  ring?: string;
  spike?: string;
  spikeEmissive?: string;
  seed?: number;
}) {
  const shards = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!shards.current) return;
    const t = state.clock.elapsedTime;
    shards.current.rotation.y = t * 0.4;
    shards.current.children.forEach((c, i) => {
      c.position.y = 1.6 + Math.sin(t * 1.4 + i * 1.3) * 0.35;
    });
  });
  const spikes = useMemo(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + rnd() * 0.4;
      const r = 3 + rnd() * 1.4;
      return {
        p: [Math.cos(a) * r, Math.sin(a) * r] as [number, number],
        h: 1.3 + rnd() * 2.1,
        tilt: (rnd() - 0.5) * 0.5,
      };
    });
  }, [seed]);
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.08, 2.9]} position={[0, 0.08, 0]} />
        <CylinderCollider args={[0.08, 2.1]} position={[0, 0.24, 0]} />
      </RigidBody>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[2.9, 3.1, 0.16, 8]} />
        <meshStandardMaterial color={base} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.24, 0]} receiveShadow>
        <cylinderGeometry args={[2.1, 2.3, 0.16, 8]} />
        <meshStandardMaterial color={baseDark} flatShading roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.34, 0]}>
        <ringGeometry args={[1.7, 2, 40]} />
        <meshStandardMaterial color={ring} emissive={ring} emissiveIntensity={1.5} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      {spikes.map((s, i) => (
        <mesh key={i} position={[s.p[0], s.h * 0.35, s.p[1]]} rotation={[s.tilt, 0, s.tilt]} castShadow>
          <coneGeometry args={[0.4, s.h, 5]} />
          <meshStandardMaterial color={spike} emissive={spikeEmissive} emissiveIntensity={0.5} flatShading roughness={0.7} />
        </mesh>
      ))}
      <group ref={shards}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 2.6, 1.6, Math.sin(a) * 2.6]} rotation={[a, a * 2, 0]}>
              <tetrahedronGeometry args={[0.3, 0]} />
              <meshStandardMaterial color="#1c1428" emissive={ring} emissiveIntensity={1.2} flatShading />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Zona sellada por la Bruma: espinas del Vacío (~0.6 de emisivo).
// ---------------------------------------------------------------------------
export function KitSealedZone({
  x,
  z,
  y = 0,
  color = "#2c2140",
  emissive = "#7c3aed",
  seed = 29,
}: {
  x: number;
  z: number;
  y?: number;
  color?: string;
  emissive?: string;
  seed?: number;
}) {
  const thorns = useMemo(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: 9 }, () => ({
      p: [(rnd() - 0.5) * 5, (rnd() - 0.5) * 5] as [number, number],
      h: 1 + rnd() * 2.4,
      tilt: (rnd() - 0.5) * 0.8,
    }));
  }, [seed]);
  return (
    <group position={[x, y, z]}>
      {thorns.map((t, i) => (
        <mesh key={i} position={[t.p[0], t.h * 0.35, t.p[1]]} rotation={[t.tilt, i, t.tilt]} castShadow>
          <coneGeometry args={[0.3, t.h, 5]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.6} flatShading roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Paso elevado del cruce: collider fino (máx. 0.12 de alto — LECCIÓN del
// puente del Bosque) + tarima de tablones/losas con arco suave.
// ---------------------------------------------------------------------------
export function KitWalkway({
  crossing,
  colorA,
  colorB,
  emissive,
  emissiveIntensity = 1.3,
  railColor,
  railGem,
  seed = 3,
}: {
  crossing: CrossingSpec;
  colorA: string;
  colorB: string;
  /** Si se define, los tablones brillan (puente de luz / de anillos). */
  emissive?: string;
  emissiveIntensity?: number;
  /** Vigas laterales opcionales (madera/piedra). */
  railColor?: string;
  /** Gema emisiva de los postes de las vigas. */
  railGem?: string;
  /** Semilla del vaivén de los tablones. */
  seed?: number;
}) {
  const planks = useMemo(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: 11 }, (_, i) => {
      const t = i / 10;
      const z = crossing.z - crossing.walkHalfL - 0.5 + t * (crossing.walkHalfL * 2 + 1);
      return { z, y: 0.1 + Math.sin(t * Math.PI) * 0.1, tilt: (rnd() - 0.5) * 0.05 };
    });
  }, [crossing, seed]);
  const postZ = [-crossing.walkHalfL, 0, crossing.walkHalfL];
  return (
    <group position={[crossing.gapX, 0, 0]}>
      {/* Colisión fina: se camina POR el paso, no dentro (máx. 0.12 alto). */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[crossing.gapHalfW - 0.1, 0.06, crossing.walkHalfL + 0.5]}
          position={[0, 0.06, crossing.z]}
        />
      </RigidBody>
      {planks.map((p, i) => (
        <mesh key={i} position={[0, p.y, p.z]} rotation={[0, 0, p.tilt]} castShadow>
          <boxGeometry args={[crossing.gapHalfW * 2 - 0.1, 0.09, 0.42]} />
          <meshStandardMaterial
            color={i % 2 ? colorA : colorB}
            flatShading
            roughness={emissive ? 0.5 : 1}
            emissive={emissive ?? "#000000"}
            emissiveIntensity={emissive ? emissiveIntensity : 0}
            transparent={Boolean(emissive)}
            opacity={emissive ? 0.9 : 1}
          />
        </mesh>
      ))}
      {railColor &&
        [-1, 1].map((side) => (
          <group key={side} position={[side * (crossing.gapHalfW - 0.12), 0, crossing.z]}>
            <mesh position={[0, 0.95, 0]} castShadow>
              <boxGeometry args={[0.12, 0.1, crossing.walkHalfL * 2 + 1]} />
              <meshStandardMaterial color={railColor} flatShading roughness={1} />
            </mesh>
            {postZ.map((pz, i) => (
              <group key={i} position={[0, 0, pz]}>
                <mesh position={[0, 0.5, 0]} castShadow>
                  <cylinderGeometry args={[0.07, 0.09, 1, 6]} />
                  <meshStandardMaterial color={railColor} flatShading roughness={1} />
                </mesh>
                {railGem && (
                  <mesh position={[0, 0.72, side * 0.09]}>
                    <boxGeometry args={[0.05, 0.14, 0.05]} />
                    <meshStandardMaterial color={railGem} emissive={railGem} emissiveIntensity={1.8} />
                  </mesh>
                )}
              </group>
            ))}
          </group>
        ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rocas de orilla a ambos lados del cruce (justifican la barrera invisible),
// con hueco limpio en el vano del paso.
// ---------------------------------------------------------------------------
export function KitBankRocks({
  crossing,
  half,
  heightFn,
  color,
  seed = 17,
  emissive,
  emissiveIntensity = 0.6,
}: {
  crossing: CrossingSpec;
  half: number;
  heightFn: (x: number, z: number) => number;
  color: string;
  seed?: number;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  const rocks = useMemo(() => {
    const rnd = mulberry32(seed);
    const out: { pos: [number, number, number]; s: [number, number, number]; rot: number }[] = [];
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 26; i++) {
        const x = -half + 1 + (i / 26) * (half * 2 - 2) + (rnd() - 0.5) * 1.2;
        // Hueco del paso: sin rocas.
        if (Math.abs(x - crossing.gapX) < crossing.gapHalfW + 0.9) continue;
        const z = crossing.z + side * (crossing.half + 0.55 + rnd() * 0.5);
        const s = 0.5 + rnd() * 0.75;
        out.push({
          pos: [x, heightFn(x, z) + s * 0.25, z],
          s: [s * (0.8 + rnd() * 0.6), s * 0.8, s * (0.8 + rnd() * 0.6)],
          rot: rnd() * Math.PI,
        });
      }
    }
    return out;
  }, [crossing, half, heightFn, seed]);
  return (
    <instancedMesh
      ref={(m) => {
        if (!m) return;
        const M = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const p = new THREE.Vector3();
        const s = new THREE.Vector3();
        rocks.forEach((r, i) => {
          p.set(...r.pos);
          q.setFromEuler(new THREE.Euler(0, r.rot, 0));
          s.set(...r.s);
          M.compose(p, q, s);
          m.setMatrixAt(i, M);
        });
        m.instanceMatrix.needsUpdate = true;
      }}
      args={[undefined, undefined, rocks.length]}
      castShadow
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color={color}
        flatShading
        roughness={1}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissive ? emissiveIntensity : 0}
      />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Masa instanciada genérica: distribuye una geometría por el mapa evitando la
// senda, el cruce y un radio central. Para púas, cristales, corales, setas…
// ---------------------------------------------------------------------------
export function KitScatter({
  seed,
  count,
  half,
  heightFn,
  avoid,
  crossZ,
  crossHalf = 3,
  geometry,
  color,
  colorB,
  emissive,
  emissiveIntensity = 0,
  sMin = 0.5,
  sMax = 1.4,
  yStretchMin = 1,
  yStretchMax = 1,
  sink = 0.15,
  avoidDist = 1.6,
}: {
  seed: number;
  count: number;
  half: number;
  heightFn: (x: number, z: number) => number;
  /** Muestras de la senda a evitar. */
  avoid: [number, number][];
  crossZ: number;
  crossHalf?: number;
  geometry: ReactElement;
  color: string;
  /** Si se define, el color de cada instancia interpola entre color y colorB. */
  colorB?: string;
  emissive?: string;
  emissiveIntensity?: number;
  sMin?: number;
  sMax?: number;
  yStretchMin?: number;
  yStretchMax?: number;
  sink?: number;
  avoidDist?: number;
}) {
  const items = useMemo(() => {
    const rnd = mulberry32(seed);
    const ca = new THREE.Color(color);
    const cb = new THREE.Color(colorB ?? color);
    const out: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const M = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let guard = 0;
    while (out.length < count && guard++ < count * 14) {
      const x = (rnd() - 0.5) * (half * 2 - 3);
      const z = (rnd() - 0.5) * (half * 2 - 3);
      if (Math.abs(z - crossZ) < crossHalf) continue;
      let near = false;
      for (const [ax, az] of avoid) {
        if ((ax - x) * (ax - x) + (az - z) * (az - z) < avoidDist * avoidDist) {
          near = true;
          break;
        }
      }
      if (near) continue;
      const sc = sMin + rnd() * (sMax - sMin);
      const ys = yStretchMin + rnd() * (yStretchMax - yStretchMin);
      p.set(x, heightFn(x, z) - sink + sc * ys * 0.4, z);
      q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.14, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.14));
      s.set(sc, sc * ys, sc);
      M.compose(p, q, s);
      out.push({ m: M.clone(), c: ca.clone().lerp(cb, rnd()) });
    }
    return out;
  }, [seed, count, half, heightFn, avoid, crossZ, crossHalf, color, colorB, sMin, sMax, yStretchMin, yStretchMax, sink, avoidDist]);
  return (
    <instancedMesh
      ref={(m) => {
        if (!m) return;
        items.forEach((it, i) => {
          m.setMatrixAt(i, it.m);
          m.setColorAt(i, it.c);
        });
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }}
      args={[undefined, undefined, items.length]}
      castShadow
    >
      {geometry}
      <meshStandardMaterial
        flatShading
        roughness={emissive ? 0.6 : 1}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissiveIntensity}
      />
    </instancedMesh>
  );
}
