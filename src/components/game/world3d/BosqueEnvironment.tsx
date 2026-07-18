// Fase 4-B — Art pass AAA del Bosque del Descubrimiento.
//
// Todo el entorno es PROCEDURAL (cero assets externos): árboles, río, cascada,
// puente, ruinas, estatuas, raíces, montañas, cielo, niebla y fauna se generan
// con primitivas low-poly instanciadas y shaders pequeños. Es 100% visual:
// las únicas físicas que añade son decorado sólido (columnas, estatuas,
// troncos, raíces saltables, tarimas) — el gating sigue fuera.
//
// Dirección de arte: "fantasía luminosa" — tarde dorada, verdes saturados,
// niebla suave, y el Vacío tiñendo de violeta el norte del mapa.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

import { BOSQUE_BRIDGE, BOSQUE_RIVER, getWorldLayout, scaleCount } from "./worldConfig";

const HALF = getWorldLayout("bosque").groundHalf;

// Sol de tarde: entra desde el noroeste para que el jugador (que avanza hacia
// el norte) camine siempre hacia la luz.
export const SUN_DIR = new THREE.Vector3(-0.5, 0.72, -0.42).normalize();

// ---------------------------------------------------------------------------
// Utilidades deterministas (nada de Math.random: el bosque es el mismo siempre)
// ---------------------------------------------------------------------------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Ruido de valor barato y suave (suficiente para relieve estilizado). */
export function vnoise(x: number, z: number) {
  return (
    Math.sin(x * 0.35 + 1.3) * Math.cos(z * 0.41) * 0.6 +
    Math.sin(x * 0.13 + z * 0.21 + 4.1) * 0.4
  );
}

/**
 * Altura del terreno del Bosque. El área jugable interior es prácticamente
 * plana (la física usa un plano), y el relieve real crece hacia el borde
 * (bermas/acantilados) y se hunde en el cauce del río.
 */
export function bosqueGroundHeight(x: number, z: number): number {
  const r = Math.max(Math.abs(x), Math.abs(z));
  const rim = smoothstep(HALF - 5, HALF + 14, r);
  let h = rim * rim * (3.4 + vnoise(x * 0.6, z * 0.6) * 1.5);
  h += (1 - rim) * vnoise(x, z) * 0.08;
  const dRiver = Math.abs(z - BOSQUE_RIVER.z);
  const carve = 1 - smoothstep(0.2, 2.6, dRiver);
  h -= carve * carve * 1.2 * (1 - rim * 0.9);
  return h;
}

// ---------------------------------------------------------------------------
// Texturas procedurales (canvas) — brillo, niebla, nube, brizna de hierba.
// ---------------------------------------------------------------------------
export function makeGlowTexture(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner.replace(",1)", ",0.6)"));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeFogTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const rnd = mulberry32(7);
  for (let i = 0; i < 26; i++) {
    const x = 20 + rnd() * 88;
    const y = 30 + rnd() * 68;
    const r = 14 + rnd() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.10)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeCloudTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  const rnd = mulberry32(21);
  for (let i = 0; i < 18; i++) {
    const x = 40 + rnd() * 176;
    const y = 50 + rnd() * 40;
    const r = 18 + rnd() * 34;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.6, "rgba(255,250,240,0.25)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Fase 7 (Cine Pass) — Textura de racimo de hojas para copas de "cartas".
// Se pinta en LUMINANCIA (gris claro→oscuro con degradado vertical): el verde
// lo pone el instanceColor al multiplicar, así una sola textura sirve para
// cualquier paleta de copa. Bordes irregulares con alpha.
// ---------------------------------------------------------------------------
export function makeFoliageTexture(seed = 205) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const rnd = mulberry32(seed);
  g.clearRect(0, 0, 256, 256);
  // Racimo: hojas lágrima superpuestas alrededor del centro, más luz arriba.
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.pow(rnd(), 0.6) * 88;
    const x = 128 + Math.cos(a) * r;
    const y = 134 + Math.sin(a) * r * 0.82;
    const len = 20 + rnd() * 26;
    const wid = len * (0.42 + rnd() * 0.2);
    const rot = rnd() * Math.PI * 2;
    // Luminancia: más clara cuanto más arriba (falso subsurface).
    const upness = 1 - Math.min(1, Math.max(0, (y - 30) / 200));
    const lum = Math.round(105 + upness * 125 + (rnd() - 0.5) * 34);
    const lumDark = Math.round(lum * 0.55);
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    const grad = g.createLinearGradient(0, -len / 2, 0, len / 2);
    grad.addColorStop(0, `rgb(${lum},${lum},${lum})`);
    grad.addColorStop(1, `rgb(${lumDark},${lumDark},${lumDark})`);
    g.fillStyle = grad;
    g.beginPath();
    // Hoja lágrima: punta arriba, base redonda.
    g.moveTo(0, -len / 2);
    g.quadraticCurveTo(wid / 2, -len * 0.1, wid * 0.34, len / 2);
    g.quadraticCurveTo(0, len * 0.62, -wid * 0.34, len / 2);
    g.quadraticCurveTo(-wid / 2, -len * 0.1, 0, -len / 2);
    g.closePath();
    g.fill();
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Fronda de helecho (canvas 128², luminancia + alpha; el tinte va por instancia). */
export function makeFernTexture(seed = 207) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const rnd = mulberry32(seed);
  g.clearRect(0, 0, 128, 128);
  // Tallo central curvado.
  g.strokeStyle = "rgb(96,96,96)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(64, 126);
  g.quadraticCurveTo(60, 66, 70, 12);
  g.stroke();
  // Foliolos a ambos lados, más cortos hacia la punta.
  for (let k = 0; k < 13; k++) {
    const t = k / 13;
    const y = 120 - t * 104;
    const x = 64 + (t * t * 6 - 2);
    const len = (1 - t * 0.75) * 26 + rnd() * 4;
    const lum = Math.round(120 + (1 - t) * 20 + rnd() * 70);
    g.strokeStyle = `rgb(${lum},${lum},${lum})`;
    g.lineWidth = 4.5 - t * 2.6;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + side * len * 0.6, y - 4, x + side * len, y - 10 - t * 5);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Fase 7 — Textura de detalle del suelo (canvas 256², tileable). Se multiplica
// con los vertex colors del terreno: base casi blanca con moteado sutil para
// que los primeros planos dejen de ser color plano. Sirve también de bumpMap.
// ---------------------------------------------------------------------------
export type GroundDetailStyle = "hierba" | "arena" | "roca" | "placa" | "losa";

export function makeGroundDetailTexture(style: GroundDetailStyle, seed = 301, repeat = 26) {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const rnd = mulberry32(seed);
  g.fillStyle = "rgb(235,235,235)";
  g.fillRect(0, 0, S, S);
  // Todo se dibuja con réplicas ±S para que el tile no tenga costuras.
  const wrapped = (draw: (dx: number, dy: number) => void) => {
    for (let dx = -S; dx <= S; dx += S) for (let dy = -S; dy <= S; dy += S) draw(dx, dy);
  };
  const dot = (x: number, y: number, r: number, lum: number, alpha: number) => {
    const ry = r * (0.6 + rnd() * 0.5);
    const rot = rnd() * Math.PI;
    wrapped((dx, dy) => {
      g.fillStyle = `rgba(${lum},${lum},${lum},${alpha})`;
      g.beginPath();
      g.ellipse(x + dx, y + dy, r, ry, rot, 0, Math.PI * 2);
      g.fill();
    });
  };
  const stroke = (x: number, y: number, len: number, ang: number, w: number, lum: number, alpha: number) => {
    wrapped((dx, dy) => {
      g.strokeStyle = `rgba(${lum},${lum},${lum},${alpha})`;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x + dx, y + dy);
      g.lineTo(x + dx + Math.cos(ang) * len, y + dy + Math.sin(ang) * len);
      g.stroke();
    });
  };
  if (style === "hierba") {
    // Moteado de matas: manchas difusas + briznas cortas + flecos de luz.
    for (let i = 0; i < 60; i++) dot(rnd() * S, rnd() * S, 5 + rnd() * 12, 185 + Math.floor(rnd() * 30), 0.35);
    for (let i = 0; i < 110; i++) stroke(rnd() * S, rnd() * S, 5 + rnd() * 8, -Math.PI / 2 + (rnd() - 0.5) * 1, 1.4, 165 + Math.floor(rnd() * 40), 0.5);
    for (let i = 0; i < 46; i++) dot(rnd() * S, rnd() * S, 1 + rnd() * 2.4, 250, 0.55);
  } else if (style === "arena") {
    // Grano fino + ondas de viento diagonales claras.
    for (let i = 0; i < 320; i++) dot(rnd() * S, rnd() * S, 0.7 + rnd() * 1.6, 190 + Math.floor(rnd() * 55), 0.5);
    for (let i = 0; i < 22; i++) stroke(rnd() * S, rnd() * S, 34 + rnd() * 60, 0.35 + (rnd() - 0.5) * 0.2, 2.2, 252, 0.3);
    for (let i = 0; i < 16; i++) stroke(rnd() * S, rnd() * S, 26 + rnd() * 44, 0.35 + (rnd() - 0.5) * 0.2, 1.6, 200, 0.3);
  } else if (style === "roca") {
    // Manchas minerales + grietas finas.
    for (let i = 0; i < 70; i++) dot(rnd() * S, rnd() * S, 4 + rnd() * 14, 175 + Math.floor(rnd() * 55), 0.4);
    for (let i = 0; i < 26; i++) {
      let x = rnd() * S;
      let y = rnd() * S;
      let a = rnd() * Math.PI * 2;
      for (let k = 0; k < 4; k++) {
        const len = 8 + rnd() * 14;
        stroke(x, y, len, a, 1.1, 150 + Math.floor(rnd() * 30), 0.5);
        x += Math.cos(a) * len;
        y += Math.sin(a) * len;
        a += (rnd() - 0.5) * 1.2;
      }
    }
    for (let i = 0; i < 40; i++) dot(rnd() * S, rnd() * S, 1 + rnd() * 2, 250, 0.4);
  } else if (style === "placa") {
    // Placa tecnológica: junta de losetas + microtaladros.
    g.strokeStyle = "rgba(196,196,196,0.55)";
    g.lineWidth = 2;
    for (let k = 0; k <= 4; k++) {
      const p = (k * S) / 4;
      wrapped((dx, dy) => {
        g.beginPath();
        g.moveTo(0 + dx, p + dy);
        g.lineTo(S + dx, p + dy);
        g.moveTo(p + dx, 0 + dy);
        g.lineTo(p + dx, S + dy);
        g.stroke();
      });
    }
    for (let i = 0; i < 90; i++) dot(rnd() * S, rnd() * S, 0.9 + rnd() * 1.6, 200 + Math.floor(rnd() * 40), 0.5);
    for (let i = 0; i < 12; i++) stroke(rnd() * S, rnd() * S, 18 + rnd() * 30, rnd() > 0.5 ? 0 : Math.PI / 2, 1.4, 252, 0.4);
  } else {
    // "losa": piedra pulida con vetas suaves y motas de plata.
    for (let i = 0; i < 55; i++) dot(rnd() * S, rnd() * S, 5 + rnd() * 13, 190 + Math.floor(rnd() * 40), 0.35);
    for (let i = 0; i < 18; i++) stroke(rnd() * S, rnd() * S, 30 + rnd() * 50, rnd() * Math.PI, 1.8, 208, 0.35);
    for (let i = 0; i < 60; i++) dot(rnd() * S, rnd() * S, 0.8 + rnd() * 1.4, 252, 0.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

/** Banda de nubes lejanas pintada (canvas 512×128, alpha suave). */
export function makeCloudBandTexture(seed = 311) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  const rnd = mulberry32(seed);
  for (let i = 0; i < 30; i++) {
    const x = 30 + rnd() * 452;
    const y = 46 + rnd() * 40;
    const rx = 30 + rnd() * 64;
    const ry = rx * (0.22 + rnd() * 0.16);
    const grad = g.createRadialGradient(x, y, 0, x, y, rx);
    grad.addColorStop(0, "rgba(255,255,255,0.4)");
    grad.addColorStop(0.55, "rgba(255,252,244,0.18)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    g.translate(-x, -y);
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 128);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGrassTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const rnd = mulberry32(33);
  for (let i = 0; i < 15; i++) {
    const bx = 12 + rnd() * 104;
    const lean = (rnd() - 0.5) * 46;
    const h = 62 + rnd() * 58;
    const w = 5 + rnd() * 6;
    const hue = 96 + rnd() * 34;
    const light = 30 + rnd() * 22;
    g.fillStyle = `hsl(${hue} 45% ${light}%)`;
    g.beginPath();
    g.moveTo(bx - w / 2, 128);
    g.quadraticCurveTo(bx - w / 2 + lean * 0.4, 128 - h * 0.6, bx + lean, 128 - h);
    g.quadraticCurveTo(bx + w / 2 + lean * 0.4, 128 - h * 0.6, bx + w / 2, 128);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Sendero: curva central compartida por la cinta de tierra, piedras y hierba.
// ---------------------------------------------------------------------------
const PATH_POINTS: [number, number][] = [
  [0, 23.5], [-2, 18.5], [-7, 15], [-11, 12], [-10, 9], [-7, 7.6],
  [-4, 7.6], [-4, 5.8], [-4, 3.8], [-1, 2.2], [3, 1], [8, -1],
  [5, -3.5], [-1, -4.5], [-6, -6], [-5, -9], [-2, -11], [0, -13],
  [4, -13.5], [8, -13], [12, -12], [9, -15], [4, -17], [1, -19], [0, -21],
];

function buildPathCurve() {
  const pts = PATH_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.4);
}

/** Muestras del sendero para tests de distancia (colocación de decorado). */
export function samplePath(curve: THREE.CatmullRomCurve3, n = 240) {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPoint(i / n);
    out.push([p.x, p.z]);
  }
  return out;
}

export function distToPath(samples: [number, number][], x: number, z: number) {
  let best = Infinity;
  for (const [px, pz] of samples) {
    const d = (px - x) * (px - x) + (pz - z) * (pz - z);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// ---------------------------------------------------------------------------
// Cielo: cúpula con gradiente + sol + nubes. Ignora la niebla de la escena.
// ---------------------------------------------------------------------------
function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color("#4585ad") },
          uMid: { value: new THREE.Color("#bfe0c6") },
          uHorizon: { value: new THREE.Color("#f6dfae") },
          uSun: { value: SUN_DIR.clone() },
          uSunColor: { value: new THREE.Color("#fff0c9") },
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
          void main() {
            float h = clamp(vDir.y, -0.12, 1.0);
            vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
            col = mix(col, uZenith, smoothstep(0.18, 0.72, h));
            float s = clamp(dot(normalize(vDir), normalize(uSun)), 0.0, 1.0);
            col += uSunColor * pow(s, 90.0) * 1.1;   // disco
            col += uSunColor * pow(s, 6.0) * 0.42;   // halo amplio (Fase 7: más presente)
            col += uSunColor * pow(s, 2.2) * 0.12;   // resplandor dorado de tarde
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [],
  );
  const cloudTex = useMemo(() => makeCloudTexture(), []);
  const bandTex = useMemo(() => makeCloudBandTexture(311), []);
  const clouds = useMemo(() => {
    const rnd = mulberry32(91);
    return Array.from({ length: 8 }, () => ({
      angle: rnd() * Math.PI * 2,
      radius: 110 + rnd() * 90,
      y: 42 + rnd() * 36,
      scale: 34 + rnd() * 40,
      speed: 0.004 + rnd() * 0.006,
      opacity: 0.4 + rnd() * 0.35,
    }));
  }, []);
  // Fase 7: bandas de nubes lejanas pintadas, doradas por la tarde, con
  // parallax lentísimo a distintas alturas.
  const bands = useMemo(() => {
    const rnd = mulberry32(93);
    const defs = [
      { y: 26, radius: 190, scale: 150, color: "#ffe2b8", opacity: 0.34 },
      { y: 46, radius: 220, scale: 190, color: "#fff2da", opacity: 0.26 },
      { y: 68, radius: 205, scale: 170, color: "#f2e2ce", opacity: 0.2 },
    ];
    return defs.flatMap((d) =>
      Array.from({ length: 3 }, () => ({
        ...d,
        angle: rnd() * Math.PI * 2,
        radius: d.radius + rnd() * 30,
        scale: d.scale * (0.8 + rnd() * 0.5),
        speed: 0.0016 + rnd() * 0.0022,
        opacity: d.opacity * (0.75 + rnd() * 0.4),
      })),
    );
  }, []);
  const cloudRefs = useRef<(THREE.Sprite | null)[]>([]);
  const bandRefs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    clouds.forEach((c, i) => {
      const s = cloudRefs.current[i];
      if (!s) return;
      const a = c.angle + t * c.speed;
      s.position.set(Math.cos(a) * c.radius, c.y, Math.sin(a) * c.radius);
    });
    bands.forEach((b, i) => {
      const s = bandRefs.current[i];
      if (!s) return;
      const a = b.angle + t * b.speed;
      s.position.set(Math.cos(a) * b.radius, b.y, Math.sin(a) * b.radius);
    });
  });
  return (
    <group>
      <mesh material={mat} renderOrder={-10}>
        <sphereGeometry args={[300, 32, 18]} />
      </mesh>
      {clouds.map((c, i) => (
        <sprite
          key={i}
          ref={(el) => (cloudRefs.current[i] = el)}
          position={[Math.cos(c.angle) * c.radius, c.y, Math.sin(c.angle) * c.radius]}
          scale={[c.scale, c.scale * 0.45, 1]}
        >
          <spriteMaterial map={cloudTex} transparent opacity={c.opacity} depthWrite={false} fog={false} />
        </sprite>
      ))}
      {bands.map((b, i) => (
        <sprite
          key={`b${i}`}
          ref={(el) => (bandRefs.current[i] = el)}
          position={[Math.cos(b.angle) * b.radius, b.y, Math.sin(b.angle) * b.radius]}
          scale={[b.scale, b.scale * 0.26, 1]}
          renderOrder={-9}
        >
          <spriteMaterial map={bandTex} color={b.color} transparent opacity={b.opacity} depthWrite={false} fog={false} />
        </sprite>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Montañas lejanas: dos anillos de conos low-poly difuminados por la niebla.
// ---------------------------------------------------------------------------
function Mountains() {
  const data = useMemo(() => {
    const rnd = mulberry32(5);
    const far: { pos: [number, number, number]; s: [number, number, number]; rot: number }[] = [];
    const near: typeof far = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rnd() * 0.35;
      const r = 125 + rnd() * 45;
      const h = 34 + rnd() * 30;
      far.push({ pos: [Math.cos(a) * r, h * 0.32 - 6, Math.sin(a) * r], s: [26 + rnd() * 16, h, 26 + rnd() * 16], rot: rnd() * Math.PI });
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3 + rnd() * 0.4;
      const r = 82 + rnd() * 22;
      const h = 17 + rnd() * 13;
      near.push({ pos: [Math.cos(a) * r, h * 0.3 - 3, Math.sin(a) * r], s: [15 + rnd() * 9, h, 15 + rnd() * 9], rot: rnd() * Math.PI });
    }
    return { far, near };
  }, []);
  return (
    <group>
      {data.far.map((m, i) => (
        <mesh key={`f${i}`} position={m.pos} rotation={[0, m.rot, 0]} scale={m.s}>
          <coneGeometry args={[1, 1, 5]} />
          <meshStandardMaterial color="#7f9c8e" flatShading roughness={1} />
        </mesh>
      ))}
      {data.near.map((m, i) => (
        <mesh key={`n${i}`} position={m.pos} rotation={[0, m.rot, 0]} scale={m.s}>
          <coneGeometry args={[1, 1, 6]} />
          <meshStandardMaterial color="#55755f" flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Suelo esculpido con vertex colors: musgo, claro, orillas, Vacío, acantilados.
// ---------------------------------------------------------------------------
function Ground() {
  const geo = useMemo(() => {
    const size = (HALF + 40) * 2;
    const seg = 110;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const moss = new THREE.Color("#2f5b3b");
    const mossLight = new THREE.Color("#48804a");
    const clearing = new THREE.Color("#63a05c");
    const bank = new THREE.Color("#274a3e");
    const rock = new THREE.Color("#5a6a58");
    const voidCol = new THREE.Color("#33204a");
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = bosqueGroundHeight(x, z);
      pos.setY(i, y);
      const n = vnoise(x * 1.7, z * 1.7) * 0.5 + 0.5;
      tmp.copy(moss).lerp(mossLight, n * 0.75);
      // Claro del bosque: hierba más luminosa.
      const dClaro = Math.hypot(x, z + 13);
      tmp.lerp(clearing, (1 - smoothstep(3, 8.5, dClaro)) * 0.8);
      // Orillas húmedas del río.
      const dRiver = Math.abs(z - BOSQUE_RIVER.z);
      tmp.lerp(bank, (1 - smoothstep(0.6, 3, dRiver)) * 0.85);
      // Acantilados del borde.
      tmp.lerp(rock, smoothstep(1.6, 3.6, y) * 0.9);
      // El Vacío tiñe de violeta el altar del jefe y el sendero sellado.
      const dBoss = Math.hypot(x, z + 21);
      const dSeal = Math.hypot(x - 17, z + 18);
      const voidMask = Math.max(1 - smoothstep(2.5, 9, dBoss), 1 - smoothstep(2, 7, dSeal));
      tmp.lerp(voidCol, voidMask * 0.85);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  // Fase 7: moteado de hierba tileable multiplicado con los vertex colors,
  // con bump barato para que el primer plano deje de ser color plano.
  const detailTex = useMemo(() => makeGroundDetailTexture("hierba", 301, 30), []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial
        vertexColors
        flatShading
        roughness={0.95}
        metalness={0}
        map={detailTex}
        bumpMap={detailTex}
        bumpScale={0.05}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Cinta del sendero + guijarros en los bordes.
// ---------------------------------------------------------------------------
function Path({ curve, samples }: { curve: THREE.CatmullRomCurve3; samples: [number, number][] }) {
  const { geo, pebbles } = useMemo(() => {
    const N = 220;
    const w = 1.55;
    const verts: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];
    const dirt = new THREE.Color("#8a6f47");
    const dirtDark = new THREE.Color("#6b5335");
    const tmp = new THREE.Color();
    const rnd = mulberry32(64);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const nrm = new THREE.Vector3().crossVectors(tan, up).normalize();
      const y = bosqueGroundHeight(p.x, p.z) + 0.05;
      const wobble = w / 2 + Math.sin(t * 40) * 0.12;
      tmp.copy(dirt).lerp(dirtDark, rnd() * 0.7);
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

    const peb: { pos: [number, number, number]; s: number }[] = [];
    for (let i = 0; i < 40; i++) {
      const t = rnd();
      const p = curve.getPoint(t);
      const tan = curve.getTangent(t);
      const nrm = new THREE.Vector3().crossVectors(tan, up).normalize();
      const side = rnd() > 0.5 ? 1 : -1;
      const off = w / 2 + 0.35 + rnd() * 0.5;
      const x = p.x + nrm.x * off * side;
      const z = p.z + nrm.z * off * side;
      peb.push({ pos: [x, bosqueGroundHeight(x, z) + 0.05, z], s: 0.1 + rnd() * 0.18 });
    }
    return { geo: g, pebbles: peb };
  }, [curve]);
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {pebbles.map((p, i) => (
        <mesh key={i} position={p.pos} scale={p.s}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#77806e" flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bosque: árboles instanciados en el perímetro + dos árboles colosales.
// ---------------------------------------------------------------------------
function Trees() {
  const { trunks, blobs, cards } = useMemo(() => {
    const rnd = mulberry32(11);
    const trunks: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const blobs: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const cards: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const trunkCol = new THREE.Color("#5d4a34");
    const canA = new THREE.Color("#2e6b3c");
    const canB = new THREE.Color("#7fae4c");
    // Falso subsurface: las cartas orientadas hacia arriba tiran a este verde-luz.
    const canLight = new THREE.Color("#a8d060");
    const tmpM = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const Z_AXIS = new THREE.Vector3(0, 0, 1);
    const dir = new THREE.Vector3();
    const qAlign = new THREE.Quaternion();
    const qRoll = new THREE.Quaternion();

    const place = (x: number, z: number, s: number) => {
      const y = bosqueGroundHeight(x, z) - 0.25;
      pos.set(x, y, z);
      quat.setFromEuler(new THREE.Euler(0, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.06));
      scl.set(s * (0.85 + rnd() * 0.3), s, s * (0.85 + rnd() * 0.3));
      tmpM.compose(pos, quat, scl);
      trunks.push({ m: tmpM.clone(), c: trunkCol.clone().multiplyScalar(0.85 + rnd() * 0.3) });
      // Núcleo de la copa: los blobs siguen debajo (masa oscura interior que
      // evita ver a través de las cartas).
      const nBlobs = 3;
      for (let b = 0; b < nBlobs; b++) {
        const bx = x + (rnd() - 0.5) * 2.6 * s;
        const bz = z + (rnd() - 0.5) * 2.6 * s;
        const by = y + (7.4 + rnd() * 1.6) * s;
        pos.set(bx, by, bz);
        const bs = s * (0.55 + rnd() * 0.6);
        scl.set(bs, bs * (0.8 + rnd() * 0.3), bs);
        quat.setFromEuler(new THREE.Euler(rnd(), rnd() * Math.PI, rnd() * 0.4));
        tmpM.compose(pos, quat, scl);
        blobs.push({ m: tmpM.clone(), c: canA.clone().lerp(canB, rnd() * 0.8).multiplyScalar(0.88) });
      }
      // Fase 7: racimo de CARTAS de follaje alrededor del núcleo. Orientadas
      // hacia fuera al montar (billboarding parcial, nunca por frame).
      const cy = y + 8.2 * s;
      const nCards = 8 + Math.floor(rnd() * 6); // 8-13 por copa
      for (let k = 0; k < nCards; k++) {
        const yv = Math.min(1, -0.35 + rnd() * 1.35); // sesgo hacia arriba
        const hr = Math.sqrt(Math.max(0.05, 1 - yv * yv));
        const aa = rnd() * Math.PI * 2;
        dir.set(Math.cos(aa) * hr, yv, Math.sin(aa) * hr).normalize();
        const rad = (1.3 + rnd() * 1.3) * s;
        pos.set(x + dir.x * rad, cy + dir.y * rad * 0.85, z + dir.z * rad);
        qAlign.setFromUnitVectors(Z_AXIS, dir);
        qRoll.setFromAxisAngle(dir, rnd() * Math.PI * 2);
        quat.copy(qRoll).multiply(qAlign);
        const sc = (2 + rnd() * 1.3) * s;
        scl.set(sc, sc, 1);
        tmpM.compose(pos, quat, scl);
        const c = canA.clone().lerp(canB, rnd());
        c.lerp(canLight, Math.max(0, dir.y) * 0.55);
        cards.push({ m: tmpM.clone(), c });
      }
    };

    // Anillo perimetral (evitando el corredor del río y la entrada sur,
    // donde vive la cámara cuando el héroe está en el spawn).
    for (let i = 0; i < 52; i++) {
      const a = (i / 52) * Math.PI * 2 + rnd() * 0.1;
      const r = HALF - 2.5 + rnd() * 11;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(z - BOSQUE_RIVER.z) < 3.2) continue;
      if (z > HALF - 6 && Math.abs(x) < 10) continue;
      place(x, z, 0.9 + rnd() * 0.7);
    }
    // Bosquecillos interiores (lejos del sendero: colocación fija revisada).
    const interior: [number, number, number][] = [
      [-19, 14, 1.1], [17, 12, 1.2], [20, -4, 1], [-20, -6, 1.15],
      [18, -14, 0.95], [-18, -14, 1], [-9, 18, 0.85], [12, 6, 0.8],
      [14, -6, 0.75], [-13, 2, 0.8],
    ];
    for (const [x, z, s] of interior) place(x, z, s);
    return { trunks, blobs, cards };
  }, []);

  const foliageTex = useMemo(() => makeFoliageTexture(), []);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const blobRef = useRef<THREE.InstancedMesh>(null);
  const cardRef = useRef<THREE.InstancedMesh>(null);
  const canopySway = useRef(0);

  useFrame((state) => {
    // Vaivén sutil de las copas (todo el instanced a la vez: gratis y creíble
    // combinado con hojas cayendo y luciérnagas).
    const t = state.clock.elapsedTime;
    const target = Math.sin(t * 0.5) * 0.01;
    if (blobRef.current && Math.abs(target - canopySway.current) > 0.0004) {
      canopySway.current = target;
      blobRef.current.rotation.z = target;
      if (cardRef.current) cardRef.current.rotation.z = target;
    }
  });

  const setup = (mesh: THREE.InstancedMesh | null, list: { m: THREE.Matrix4; c: THREE.Color }[]) => {
    if (!mesh) return;
    list.forEach((it, i) => {
      mesh.setMatrixAt(i, it.m);
      mesh.setColorAt(i, it.c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  return (
    <group>
      <instancedMesh
        ref={(m) => {
          trunkRef.current = m;
          setup(m, trunks);
        }}
        args={[undefined, undefined, trunks.length]}
        castShadow
      >
        <cylinderGeometry args={[0.42, 0.9, 8, 7]} />
        <meshStandardMaterial flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={(m) => {
          blobRef.current = m;
          setup(m, blobs);
        }}
        args={[undefined, undefined, blobs.length]}
        castShadow
      >
        <icosahedronGeometry args={[2.6, 1]} />
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
      {/* Cartas de follaje: la copa densa con luz atravesando (Fase 7). */}
      <instancedMesh
        ref={(m) => {
          cardRef.current = m;
          setup(m, cards);
        }}
        args={[undefined, undefined, cards.length]}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          map={foliageTex}
          alphaTest={0.45}
          side={THREE.DoubleSide}
          roughness={0.9}
        />
      </instancedMesh>
    </group>
  );
}

/** Árbol colosal con colisión: el jugador debe sentirse diminuto a su lado. */
function GiantTree({ x, z }: { x: number; z: number }) {
  const y = bosqueGroundHeight(x, z) - 0.3;
  const rnd = useMemo(() => mulberry32(Math.floor(x * 13 + z * 7 + 100)), [x, z]);
  const foliageTex = useMemo(() => makeFoliageTexture(), []);
  const { blobs, cards } = useMemo(() => {
    const blobs = Array.from({ length: 5 }, () => ({
      p: [(rnd() - 0.5) * 7, 15 + rnd() * 4, (rnd() - 0.5) * 7] as [number, number, number],
      s: 3.2 + rnd() * 2.4,
      c: new THREE.Color("#2e6b3c").lerp(new THREE.Color("#8fbe52"), rnd() * 0.8).multiplyScalar(0.9),
    }));
    // Fase 7: cartas de follaje en corona alrededor de cada blob de la copa.
    const cards: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const canA = new THREE.Color("#2e6b3c");
    const canB = new THREE.Color("#8fbe52");
    const canLight = new THREE.Color("#b2d868");
    const M = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const qRoll = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const Z_AXIS = new THREE.Vector3(0, 0, 1);
    for (const b of blobs) {
      const n = 9 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const yv = Math.min(1, -0.3 + rnd() * 1.3);
        const hr = Math.sqrt(Math.max(0.05, 1 - yv * yv));
        const aa = rnd() * Math.PI * 2;
        dir.set(Math.cos(aa) * hr, yv, Math.sin(aa) * hr).normalize();
        const rad = b.s * (0.65 + rnd() * 0.5);
        p.set(b.p[0] + dir.x * rad, b.p[1] + dir.y * rad * 0.85, b.p[2] + dir.z * rad);
        q.setFromUnitVectors(Z_AXIS, dir);
        qRoll.setFromAxisAngle(dir, rnd() * Math.PI * 2);
        q.premultiply(qRoll);
        const sc = b.s * (0.85 + rnd() * 0.5);
        s.set(sc, sc, 1);
        M.compose(p, q, s);
        const c = canA.clone().lerp(canB, rnd());
        c.lerp(canLight, Math.max(0, dir.y) * 0.55);
        cards.push({ m: M.clone(), c });
      }
    }
    return { blobs, cards };
  }, [rnd]);
  return (
    <group position={[x, y, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.5, 8, 1.5]} position={[0, 8, 0]} />
      </RigidBody>
      <mesh castShadow>
        <cylinderGeometry args={[1.1, 2.6, 17, 9]} />
        <meshStandardMaterial color="#55432e" flatShading roughness={1} />
      </mesh>
      {/* Raíces de apoyo en la base */}
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        return (
          <mesh key={i} position={[Math.cos(a) * 2.2, 0.5, Math.sin(a) * 2.2]} rotation={[0.5, -a, 0]} castShadow>
            <coneGeometry args={[0.7, 3.2, 5]} />
            <meshStandardMaterial color="#4c3b28" flatShading roughness={1} />
          </mesh>
        );
      })}
      {blobs.map((b, i) => (
        <mesh key={i} position={b.p} scale={b.s} castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={b.c} flatShading roughness={0.9} />
        </mesh>
      ))}
      {/* Corona de cartas de follaje del coloso (una sola malla instanciada). */}
      <instancedMesh
        ref={(m) => {
          if (!m) return;
          cards.forEach((it, i) => {
            m.setMatrixAt(i, it.m);
            m.setColorAt(i, it.c);
          });
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }}
        args={[undefined, undefined, cards.length]}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial map={foliageTex} alphaTest={0.45} side={THREE.DoubleSide} roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Río + cascada + puente.
// ---------------------------------------------------------------------------
const WATER_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function useWaterMaterial(vertical: boolean) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(vertical ? "#7fd4e8" : "#1d6a63") },
          uLight: { value: new THREE.Color(vertical ? "#eafcff" : "#7fe8d8") },
          uSpeed: { value: vertical ? 3.2 : 0.7 },
        },
        vertexShader: WATER_VERT,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uTime; uniform float uSpeed;
          uniform vec3 uDeep; uniform vec3 uLight;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
          void main() {
            float flow = vUv.x * 26.0 - uTime * uSpeed;
            float band = sin(flow + sin(vUv.y * 9.0 + uTime * 0.8) * 0.9) * 0.5 + 0.5;
            vec3 col = mix(uDeep, uLight, band * 0.45 + 0.12);
            // Destellos
            vec2 cell = floor(vec2(flow * 2.2, vUv.y * 12.0));
            float tw = step(0.94, hash(cell) * (0.75 + 0.25 * sin(uTime * 3.0 + hash(cell.yx) * 6.28)));
            col += tw * 0.55;
            float edge = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
            gl_FragColor = vec4(col, ${vertical ? "0.85" : "0.93"} * (0.35 + 0.65 * edge));
          }
        `,
      }),
    [vertical],
  );
}

function RiverAndFalls() {
  const riverMat = useWaterMaterial(false);
  const fallsMat = useWaterMaterial(true);
  const mistTex = useMemo(() => makeGlowTexture(), []);
  const mistRefs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame((state, dt) => {
    riverMat.uniforms.uTime.value += dt;
    fallsMat.uniforms.uTime.value += dt;
    const t = state.clock.elapsedTime;
    mistRefs.current.forEach((s, i) => {
      if (!s) return;
      const k = (t * 0.5 + i * 0.37) % 1;
      s.position.y = -0.2 + k * 2.2;
      const sc = 1.6 + k * 2.4;
      s.scale.set(sc, sc * 0.7, 1);
      (s.material as THREE.SpriteMaterial).opacity = 0.3 * (1 - k);
    });
  });
  const cliffX = -HALF + 0.6;
  return (
    <group>
      {/* Lámina de agua del río (hundida en el cauce esculpido). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, BOSQUE_RIVER.z]} material={riverMat}>
        <planeGeometry args={[HALF * 2 + 10, BOSQUE_RIVER.half * 2 + 0.6, 1, 1]} />
      </mesh>
      {/* Rocas de las orillas (justifican la barrera invisible). */}
      <BankRocks />
      {/* Acantilado + cascada al oeste. */}
      <group position={[cliffX, 0, BOSQUE_RIVER.z]}>
        <mesh position={[-1.4, 2.6, -3.4]} rotation={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[3.4, 7, 3.6]} />
          <meshStandardMaterial color="#5f6f5d" flatShading roughness={1} />
        </mesh>
        <mesh position={[-1.4, 2.6, 3.4]} rotation={[0, -0.25, 0]} castShadow>
          <boxGeometry args={[3.4, 7, 3.6]} />
          <meshStandardMaterial color="#57685a" flatShading roughness={1} />
        </mesh>
        <mesh position={[-1.8, 4.6, 0]} rotation={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[3, 4.4, 4.4]} />
          <meshStandardMaterial color="#66765f" flatShading roughness={1} />
        </mesh>
        {/* Cortina de agua */}
        <mesh rotation={[0, Math.PI / 2, 0]} position={[0.2, 1.15, 0]} material={fallsMat}>
          <planeGeometry args={[3.2, 7.4, 1, 1]} />
        </mesh>
        {/* Niebla de la base */}
        {Array.from({ length: 5 }, (_, i) => (
          <sprite key={i} ref={(el) => (mistRefs.current[i] = el)} position={[0.9, 0, (i - 2) * 0.7]}>
            <spriteMaterial map={mistTex} transparent opacity={0.25} depthWrite={false} color="#eafcff" fog={false} />
          </sprite>
        ))}
      </group>
      <Bridge />
    </group>
  );
}

function BankRocks() {
  const rocks = useMemo(() => {
    const rnd = mulberry32(17);
    const out: { pos: [number, number, number]; s: [number, number, number]; rot: number }[] = [];
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 26; i++) {
        const x = -HALF + 1 + (i / 26) * (HALF * 2 - 2) + (rnd() - 0.5) * 1.2;
        // Hueco del puente: sin rocas.
        if (Math.abs(x - BOSQUE_BRIDGE.x) < BOSQUE_BRIDGE.halfW + 0.9) continue;
        const z = BOSQUE_RIVER.z + side * (BOSQUE_RIVER.half + 0.55 + rnd() * 0.5);
        const s = 0.5 + rnd() * 0.75;
        out.push({
          pos: [x, bosqueGroundHeight(x, z) + s * 0.25, z],
          s: [s * (0.8 + rnd() * 0.6), s * 0.8, s * (0.8 + rnd() * 0.6)],
          rot: rnd() * Math.PI,
        });
      }
    }
    return out;
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  return (
    <instancedMesh
      ref={(m) => {
        ref.current = m;
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
      <meshStandardMaterial color="#6a7a64" flatShading roughness={1} />
    </instancedMesh>
  );
}

function Bridge() {
  const planks = useMemo(() => {
    const rnd = mulberry32(3);
    return Array.from({ length: 11 }, (_, i) => {
      const t = i / 10;
      const z = BOSQUE_RIVER.z - BOSQUE_BRIDGE.halfL - 0.5 + t * (BOSQUE_BRIDGE.halfL * 2 + 1);
      return { z, y: 0.1 + Math.sin(t * Math.PI) * 0.1, tilt: (rnd() - 0.5) * 0.05 };
    });
  }, []);
  const postZ = [-BOSQUE_BRIDGE.halfL, 0, BOSQUE_BRIDGE.halfL];
  return (
    <group position={[BOSQUE_BRIDGE.x, 0, 0]}>
      {/* Tarima con colisión suave para caminar POR el puente, no dentro. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[BOSQUE_BRIDGE.halfW - 0.1, 0.06, BOSQUE_BRIDGE.halfL + 0.5]}
          position={[0, 0.06, BOSQUE_RIVER.z]}
        />
      </RigidBody>
      {planks.map((p, i) => (
        <mesh key={i} position={[0, p.y, p.z]} rotation={[0, 0, p.tilt]} castShadow>
          <boxGeometry args={[BOSQUE_BRIDGE.halfW * 2 - 0.1, 0.09, 0.42]} />
          <meshStandardMaterial color={i % 2 ? "#7c5d3b" : "#8a6a44"} flatShading roughness={1} />
        </mesh>
      ))}
      {/* Vigas laterales + postes + runas */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (BOSQUE_BRIDGE.halfW - 0.12), 0, BOSQUE_RIVER.z]}>
          <mesh position={[0, 0.95, 0]} castShadow>
            <boxGeometry args={[0.12, 0.1, BOSQUE_BRIDGE.halfL * 2 + 1]} />
            <meshStandardMaterial color="#6b4f31" flatShading roughness={1} />
          </mesh>
          {postZ.map((pz, i) => (
            <group key={i} position={[0, 0, pz]}>
              <mesh position={[0, 0.5, 0]} castShadow>
                <cylinderGeometry args={[0.07, 0.09, 1, 6]} />
                <meshStandardMaterial color="#5f462c" flatShading roughness={1} />
              </mesh>
              <mesh position={[0, 0.72, side * 0.09]}>
                <boxGeometry args={[0.05, 0.14, 0.05]} />
                <meshStandardMaterial color="#3ee08f" emissive="#3ee08f" emissiveIntensity={1.8} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ruinas del saber: dais, columnas (algunas rotas), arco y estatuas antiguas.
// ---------------------------------------------------------------------------
const STONE = "#8d927e";
const STONE_DARK = "#6f7462";

function Ruins({ x, z }: { x: number; z: number }) {
  const rnd = useMemo(() => mulberry32(47), []);
  const columns = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.35;
        const broken = i === 1 || i === 4;
        return {
          p: [Math.cos(a) * 4.2, Math.sin(a) * 4.2] as [number, number],
          h: broken ? 1.2 + rnd() * 0.8 : 2.8 + rnd() * 0.7,
          broken,
          tilt: (rnd() - 0.5) * 0.08,
        };
      }),
    [rnd],
  );
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ringRef.current) ringRef.current.rotation.z = state.clock.elapsedTime * 0.15;
  });
  return (
    <group position={[x, 0, z]}>
      {/* Dais de dos alturas (con colisión de escalón bajo). */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.07, 2.7]} position={[0, 0.07, 0]} />
        <CylinderCollider args={[0.07, 2.05]} position={[0, 0.21, 0]} />
      </RigidBody>
      <mesh position={[0, 0.07, 0]} receiveShadow>
        <cylinderGeometry args={[2.7, 2.85, 0.14, 9]} />
        <meshStandardMaterial color={STONE} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.21, 0]} receiveShadow>
        <cylinderGeometry args={[2.05, 2.2, 0.14, 9]} />
        <meshStandardMaterial color={STONE_DARK} flatShading roughness={1} />
      </mesh>
      {/* Anillo rúnico que gira lentamente sobre el dais. */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.32, 0]}>
        <torusGeometry args={[1.55, 0.045, 8, 48]} />
        <meshStandardMaterial color="#3ee08f" emissive="#3ee08f" emissiveIntensity={1.7} transparent opacity={0.9} />
      </mesh>
      {/* Columnas */}
      {columns.map((c, i) => (
        <group key={i} position={[c.p[0], 0, c.p[1]]} rotation={[c.tilt, 0, c.tilt * 1.4]}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[0.45, c.h / 2 + 0.2, 0.45]} position={[0, c.h / 2, 0]} />
          </RigidBody>
          <mesh position={[0, 0.12, 0]} castShadow>
            <boxGeometry args={[0.95, 0.24, 0.95]} />
            <meshStandardMaterial color={STONE_DARK} flatShading roughness={1} />
          </mesh>
          <mesh position={[0, c.h / 2 + 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.4, c.h, 8]} />
            <meshStandardMaterial color={STONE} flatShading roughness={1} />
          </mesh>
          {!c.broken && (
            <mesh position={[0, c.h + 0.32, 0]} castShadow>
              <boxGeometry args={[0.9, 0.22, 0.9]} />
              <meshStandardMaterial color={STONE_DARK} flatShading roughness={1} />
            </mesh>
          )}
          {c.broken && (
            <mesh position={[0, c.h + 0.22, 0]} rotation={[0.3, 0.5, 0.25]} castShadow>
              <cylinderGeometry args={[0.33, 0.36, 0.5, 8]} />
              <meshStandardMaterial color={STONE} flatShading roughness={1} />
            </mesh>
          )}
          {/* Musgo en la base */}
          <mesh position={[0.25, 0.28, 0.25]} scale={[0.5, 0.2, 0.5]}>
            <sphereGeometry args={[0.6, 8, 6]} />
            <meshStandardMaterial color="#3f7a3f" flatShading roughness={1} />
          </mesh>
        </group>
      ))}
      {/* Columna caída atravesada en el suelo. */}
      <group position={[3.2, 0.42, 3.4]} rotation={[0, 0.7, Math.PI / 2 - 0.06]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.42, 1.5, 0.42]} />
        </RigidBody>
        <mesh castShadow>
          <cylinderGeometry args={[0.34, 0.38, 3, 8]} />
          <meshStandardMaterial color={STONE} flatShading roughness={1} />
        </mesh>
      </group>
      {/* Arco de entrada mirando al sendero (oeste). */}
      <group position={[-4.6, 0, -1.2]} rotation={[0, Math.PI / 2 + 0.35, 0]}>
        {[-1.5, 1.5].map((sx) => (
          <group key={sx} position={[sx, 0, 0]}>
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[0.4, 1.9, 0.4]} position={[0, 1.9, 0]} />
            </RigidBody>
            <mesh position={[0, 1.9, 0]} castShadow>
              <cylinderGeometry args={[0.32, 0.42, 3.8, 8]} />
              <meshStandardMaterial color={STONE} flatShading roughness={1} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 3.95, 0]} castShadow>
          <boxGeometry args={[4.1, 0.5, 0.7]} />
          <meshStandardMaterial color={STONE_DARK} flatShading roughness={1} />
        </mesh>
        <mesh position={[0, 4.35, 0]}>
          <boxGeometry args={[0.6, 0.34, 0.5]} />
          <meshStandardMaterial color="#3ee08f" emissive="#3ee08f" emissiveIntensity={1.6} />
        </mesh>
      </group>
    </group>
  );
}

/** Estatua guardiana antigua (par en la entrada del nivel). */
function GuardianStatue({ x, z, face = 0 }: { x: number; z: number; face?: number }) {
  const y = bosqueGroundHeight(x, z);
  return (
    <group position={[x, y, z]} rotation={[0, face, -0.02]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.75, 1.7, 0.75]} position={[0, 1.7, 0]} />
      </RigidBody>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1.7, 0.6, 1.7]} />
        <meshStandardMaterial color={STONE_DARK} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <coneGeometry args={[0.85, 2.4, 7]} />
        <meshStandardMaterial color={STONE} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 3.15, 0]} castShadow>
        <sphereGeometry args={[0.48, 10, 8]} />
        <meshStandardMaterial color={STONE} flatShading roughness={1} />
      </mesh>
      {/* Ojos con un rescoldo de energía del Nexus. */}
      {[-0.17, 0.17].map((ex) => (
        <mesh key={ex} position={[ex, 3.2, 0.42]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshStandardMaterial color="#ffd98a" emissive="#ffc45e" emissiveIntensity={1.6} />
        </mesh>
      ))}
      <mesh position={[0, 3.75, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[0.62, 0.05, 8, 24]} />
        <meshStandardMaterial color="#f4c542" emissive="#f4c542" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.6, 0.62, 0.6]} scale={[0.55, 0.25, 0.55]}>
        <sphereGeometry args={[0.7, 8, 6]} />
        <meshStandardMaterial color="#3f7a3f" flatShading roughness={1} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Raíces gigantes: arcos de madera; las que cruzan el sendero se saltan.
// ---------------------------------------------------------------------------
function Root({
  x,
  z,
  rotY,
  radius = 1.5,
  jumpable = false,
}: {
  x: number;
  z: number;
  rotY: number;
  radius?: number;
  jumpable?: boolean;
}) {
  const sink = radius * 0.42;
  return (
    <group position={[x, -sink, z]} rotation={[0, rotY, 0]}>
      {jumpable && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[radius * 0.95, 0.42, 0.32]} position={[0, sink + radius - 0.6, 0]} />
        </RigidBody>
      )}
      <mesh castShadow>
        <torusGeometry args={[radius, 0.32, 7, 20, Math.PI]} />
        <meshStandardMaterial color="#5a452e" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, radius * 0.55, 0]} scale={[1, 0.5, 1]}>
        <torusGeometry args={[radius * 0.7, 0.1, 5, 14, Math.PI]} />
        <meshStandardMaterial color="#4a7a3f" flatShading roughness={1} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Altar del Vacío (jefe) y sendero sellado: violeta, sombrío, amenazante.
// ---------------------------------------------------------------------------
function VoidAltar({ x, z }: { x: number; z: number }) {
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
    const rnd = mulberry32(53);
    return Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + rnd() * 0.4;
      const r = 3 + rnd() * 1.4;
      return { p: [Math.cos(a) * r, Math.sin(a) * r] as [number, number], h: 1.3 + rnd() * 2.1, tilt: (rnd() - 0.5) * 0.5 };
    });
  }, []);
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.08, 2.9]} position={[0, 0.08, 0]} />
        <CylinderCollider args={[0.08, 2.1]} position={[0, 0.24, 0]} />
      </RigidBody>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[2.9, 3.1, 0.16, 8]} />
        <meshStandardMaterial color="#2c2338" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 0.24, 0]} receiveShadow>
        <cylinderGeometry args={[2.1, 2.3, 0.16, 8]} />
        <meshStandardMaterial color="#221a2e" flatShading roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.34, 0]}>
        <ringGeometry args={[1.7, 2, 40]} />
        <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={1.5} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      {spikes.map((s, i) => (
        <mesh key={i} position={[s.p[0], s.h * 0.35, s.p[1]]} rotation={[s.tilt, 0, s.tilt]} castShadow>
          <coneGeometry args={[0.4, s.h, 5]} />
          <meshStandardMaterial color="#3a2a52" emissive="#7c3aed" emissiveIntensity={0.5} flatShading roughness={0.7} />
        </mesh>
      ))}
      <group ref={shards}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 2.6, 1.6, Math.sin(a) * 2.6]} rotation={[a, a * 2, 0]}>
              <tetrahedronGeometry args={[0.3, 0]} />
              <meshStandardMaterial color="#1c1428" emissive="#a855f7" emissiveIntensity={1.2} flatShading />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function SealedPath({ x, z }: { x: number; z: number }) {
  const y = bosqueGroundHeight(x, z);
  const thorns = useMemo(() => {
    const rnd = mulberry32(29);
    return Array.from({ length: 9 }, () => ({
      p: [(rnd() - 0.5) * 5, (rnd() - 0.5) * 5] as [number, number],
      h: 1 + rnd() * 2.4,
      tilt: (rnd() - 0.5) * 0.8,
    }));
  }, []);
  return (
    <group position={[x, y, z]}>
      {thorns.map((t, i) => (
        <mesh key={i} position={[t.p[0], t.h * 0.35, t.p[1]]} rotation={[t.tilt, i, t.tilt]} castShadow>
          <coneGeometry args={[0.3, t.h, 5]} />
          <meshStandardMaterial color="#2c2140" emissive="#7c3aed" emissiveIntensity={0.6} flatShading roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** Pedestal de piedra bajo un cristal de misión: ancla el nodo al mundo. */
function CrystalPedestal({ x, z }: { x: number; z: number }) {
  const y = bosqueGroundHeight(x, z);
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[1.15, 1.32, 0.12, 8]} />
        <meshStandardMaterial color={STONE_DARK} flatShading roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.13, 0]}>
        <ringGeometry args={[0.72, 0.92, 24]} />
        <meshStandardMaterial color="#3ee08f" emissive="#3ee08f" emissiveIntensity={1.1} transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
      {[0.9, 2.4, 4].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 1.5, 0.12, Math.sin(a) * 1.5]} scale={0.2 + i * 0.05}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={STONE} flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Marco de piedra para el portal de vuelta al mapa. */
function PortalFrame({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.09, 0]} receiveShadow>
        <cylinderGeometry args={[2, 2.15, 0.18, 8]} />
        <meshStandardMaterial color={STONE_DARK} flatShading roughness={1} />
      </mesh>
      {[-1.4, 1.4].map((sx) => (
        <mesh key={sx} position={[sx, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.3, 2.6, 7]} />
          <meshStandardMaterial color={STONE} flatShading roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 2.85, 0]} castShadow>
        <boxGeometry args={[3.4, 0.4, 0.5]} />
        <meshStandardMaterial color={STONE_DARK} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, 3.15, 0]}>
        <boxGeometry args={[0.5, 0.26, 0.4]} />
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={1.8} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Vegetación menuda: hierba, flores, setas.
// ---------------------------------------------------------------------------
function Vegetation({ samples }: { samples: [number, number][] }) {
  const grassTex = useMemo(() => makeGrassTexture(), []);
  const { grass, flowers, magic } = useMemo(() => {
    const rnd = mulberry32(77);
    const grass: THREE.Matrix4[] = [];
    const flowers: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const magic: [number, number, number][] = [];
    const M = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const palette = ["#ff8fb3", "#ffd166", "#c084fc", "#8fd3ff", "#ff8562"].map((c) => new THREE.Color(c));

    let guard = 0;
    while (grass.length < 340 && guard++ < 4000) {
      const x = (rnd() - 0.5) * (HALF * 2 - 3);
      const z = (rnd() - 0.5) * (HALF * 2 - 3);
      if (Math.abs(z - BOSQUE_RIVER.z) < 2.8) continue;
      if (distToPath(samples, x, z) < 1.3) continue;
      const sc = 0.6 + rnd() * 0.7;
      p.set(x, bosqueGroundHeight(x, z) + 0.3 * sc, z);
      q.setFromEuler(new THREE.Euler(0, rnd() * Math.PI, 0));
      s.set(sc, sc, sc);
      M.compose(p, q, s);
      grass.push(M.clone());
    }
    // Flores: pradera densa en el claro + salpicadas por el mapa.
    guard = 0;
    while (flowers.length < 240 && guard++ < 4000) {
      const inClaro = flowers.length < 150;
      const x = inClaro ? (rnd() - 0.5) * 14 : (rnd() - 0.5) * (HALF * 2 - 4);
      const z = inClaro ? -13 + (rnd() - 0.5) * 11 : (rnd() - 0.5) * (HALF * 2 - 4);
      if (Math.abs(z - BOSQUE_RIVER.z) < 2.6) continue;
      if (distToPath(samples, x, z) < 1.1) continue;
      const sc = 0.06 + rnd() * 0.07;
      p.set(x, bosqueGroundHeight(x, z) + 0.1, z);
      q.identity();
      s.set(sc, sc, sc);
      M.compose(p, q, s);
      flowers.push({ m: M.clone(), c: palette[Math.floor(rnd() * palette.length)] });
    }
    // Flores de luz cerca del claro (bloom).
    for (let i = 0; i < 12; i++) {
      const x = -4 + (rnd() - 0.5) * 10;
      const z = -12 + (rnd() - 0.5) * 8;
      if (distToPath(samples, x, z) < 1.2) continue;
      magic.push([x, bosqueGroundHeight(x, z) + 0.28, z]);
    }
    return { grass, flowers, magic };
  }, [samples]);

  const setupPlain = (m: THREE.InstancedMesh | null, list: THREE.Matrix4[]) => {
    if (!m) return;
    list.forEach((mat, i) => m.setMatrixAt(i, mat));
    m.instanceMatrix.needsUpdate = true;
  };

  return (
    <group>
      {[0, Math.PI / 2].map((rot, k) => (
        <instancedMesh
          key={k}
          ref={(m) => {
            if (!m) return;
            const M = new THREE.Matrix4();
            const R = new THREE.Matrix4().makeRotationY(rot);
            grass.forEach((mat, i) => {
              M.copy(mat).multiply(R);
              m.setMatrixAt(i, M);
            });
            m.instanceMatrix.needsUpdate = true;
          }}
          args={[undefined, undefined, grass.length]}
        >
          <planeGeometry args={[0.9, 0.6]} />
          <meshStandardMaterial map={grassTex} transparent alphaTest={0.45} side={THREE.DoubleSide} roughness={1} />
        </instancedMesh>
      ))}
      <instancedMesh
        ref={(m) => {
          if (!m) return;
          flowers.forEach((f, i) => {
            m.setMatrixAt(i, f.m);
            m.setColorAt(i, f.c);
          });
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }}
        args={[undefined, undefined, flowers.length]}
      >
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={0.12} roughness={0.8} flatShading />
      </instancedMesh>
      {magic.map((p, i) => (
        <group key={i} position={p}>
          <mesh>
            <icosahedronGeometry args={[0.09, 0]} />
            <meshStandardMaterial color="#9fffdc" emissive="#3ee08f" emissiveIntensity={2.2} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.015, 0.02, 0.26, 4]} />
            <meshStandardMaterial color="#2f5b3b" roughness={1} />
          </mesh>
        </group>
      ))}
      {/* Setas al pie del árbol colosal oeste. */}
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        const x = -16 + Math.cos(a) * (3.1 + (i % 3) * 0.4);
        const z = -1 + Math.sin(a) * (3.1 + (i % 2) * 0.5);
        const s = 0.14 + (i % 3) * 0.07;
        return (
          <group key={i} position={[x, bosqueGroundHeight(x, z), z]} scale={s}>
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.28, 0.36, 1, 6]} />
              <meshStandardMaterial color="#e8dcc8" flatShading roughness={1} />
            </mesh>
            <mesh position={[0, 1.05, 0]}>
              <coneGeometry args={[0.85, 0.7, 8]} />
              <meshStandardMaterial color={i % 2 ? "#d0543a" : "#e8a04c"} flatShading roughness={0.9} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Atmósfera: god rays, niebla baja (y violeta en el Vacío), polvo en la luz.
// ---------------------------------------------------------------------------
function GodRays() {
  const spots: [number, number][] = [
    [-6, 9], [2, -2], [-2, -12], [9, -6], [-12, 13],
  ];
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    // El eje del cono apunta a lo largo de la dirección de la luz solar.
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), SUN_DIR.clone());
    return q;
  }, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      (m.material as THREE.MeshBasicMaterial).opacity = 0.07 + Math.sin(t * 0.6 + i * 1.7) * 0.025;
    });
  });
  return (
    <group>
      {spots.map(([x, z], i) => (
        <mesh
          key={i}
          ref={(el) => (refs.current[i] = el)}
          position={[x, 6.5, z]}
          quaternion={quat}
          renderOrder={5}
        >
          <coneGeometry args={[3.1, 15, 12, 1, true]} />
          <meshBasicMaterial
            color="#ffeebb"
            transparent
            opacity={0.08}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function GroundFog() {
  const tex = useMemo(() => makeFogTexture(), []);
  const banks = useMemo(() => {
    const rnd = mulberry32(37);
    const mk = (n: number, area: () => [number, number], color: string, opacity: number) =>
      Array.from({ length: n }, () => {
        const [x, z] = area();
        return {
          x, z,
          y: 0.7 + rnd() * 1.1,
          s: 8 + rnd() * 9,
          speed: 0.12 + rnd() * 0.2,
          phase: rnd() * Math.PI * 2,
          color, opacity,
        };
      });
    return [
      ...mk(7, () => [(rnd() - 0.5) * 44, (rnd() - 0.5) * 44], "#dff0dc", 0.13),
      ...mk(3, () => [(rnd() - 0.5) * 8, -20 + (rnd() - 0.5) * 6], "#a878f0", 0.2),
      ...mk(2, () => [17 + (rnd() - 0.5) * 5, -18 + (rnd() - 0.5) * 4], "#a878f0", 0.2),
    ];
  }, []);
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
// Vida: luciérnagas, motas de polvo, hojas cayendo, mariposas y pájaros.
// ---------------------------------------------------------------------------
function Fireflies() {
  const tex = useMemo(() => makeGlowTexture(), []);
  const COUNT = 130;
  const seeds = useMemo(() => {
    const rnd = mulberry32(41);
    return Array.from({ length: COUNT }, () => {
      // Más densas en el claro y junto al río.
      const zone = rnd();
      const cx = zone < 0.5 ? (rnd() - 0.5) * 16 : (rnd() - 0.5) * 44;
      const cz = zone < 0.5 ? -13 + (rnd() - 0.5) * 12 : (rnd() - 0.5) * 44;
      return {
        cx, cz,
        cy: 0.6 + rnd() * 2.2,
        r: 0.6 + rnd() * 2,
        sp: 0.3 + rnd() * 0.7,
        ph: rnd() * Math.PI * 2,
        warm: rnd() > 0.45,
      };
    });
  }, []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const warm = new THREE.Color("#ffe08a");
    const green = new THREE.Color("#a8ffc9");
    seeds.forEach((s, i) => {
      pos[i * 3] = s.cx;
      pos[i * 3 + 1] = s.cy;
      pos[i * 3 + 2] = s.cz;
      const c = s.warm ? warm : green;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    });
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [seeds]);
  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const attr = geom.attributes.position as THREE.BufferAttribute;
    seeds.forEach((s, i) => {
      attr.setXYZ(
        i,
        s.cx + Math.sin(t * s.sp + s.ph) * s.r,
        s.cy + Math.sin(t * s.sp * 1.7 + s.ph * 2) * 0.5,
        s.cz + Math.cos(t * s.sp * 0.8 + s.ph) * s.r,
      );
    });
    attr.needsUpdate = true;
    if (ref.current) {
      const m = ref.current.material as THREE.PointsMaterial;
      m.opacity = 0.75 + Math.sin(t * 2.3) * 0.2;
    }
  });
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        map={tex}
        size={0.38}
        vertexColors
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

function DustMotes() {
  const tex = useMemo(() => makeGlowTexture(), []);
  const COUNT = 70;
  const seeds = useMemo(() => {
    const rnd = mulberry32(59);
    return Array.from({ length: COUNT }, () => ({
      x: (rnd() - 0.5) * 40,
      y: 0.8 + rnd() * 5,
      z: (rnd() - 0.5) * 40,
      sp: 0.05 + rnd() * 0.12,
      ph: rnd() * Math.PI * 2,
    }));
  }, []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    seeds.forEach((s, i) => {
      pos[i * 3] = s.x;
      pos[i * 3 + 1] = s.y;
      pos[i * 3 + 2] = s.z;
    });
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [seeds]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const attr = geom.attributes.position as THREE.BufferAttribute;
    seeds.forEach((s, i) => {
      attr.setXYZ(i, s.x + Math.sin(t * s.sp + s.ph) * 1.4, s.y + Math.sin(t * s.sp * 2 + s.ph) * 0.6, s.z + Math.cos(t * s.sp + s.ph) * 1.4);
    });
    attr.needsUpdate = true;
  });
  return (
    <points geometry={geom}>
      <pointsMaterial map={tex} size={0.12} color="#fff3d0" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

function FallingLeaves() {
  const COUNT = 54;
  const seeds = useMemo(() => {
    const rnd = mulberry32(23);
    return Array.from({ length: COUNT }, () => ({
      x: (rnd() - 0.5) * 46,
      z: (rnd() - 0.5) * 46,
      ph: rnd() * 9,
      sp: 0.55 + rnd() * 0.6,
      drift: 0.6 + rnd() * 1.2,
      spin: rnd() * Math.PI * 2,
    }));
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const M = useMemo(() => new THREE.Matrix4(), []);
  const P = useMemo(() => new THREE.Vector3(), []);
  const Q = useMemo(() => new THREE.Quaternion(), []);
  const E = useMemo(() => new THREE.Euler(), []);
  const S = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    seeds.forEach((s, i) => {
      const k = (t * s.sp + s.ph) % 10;
      const y = 8.5 - k * 0.9;
      P.set(s.x + Math.sin(k * 2 + s.ph) * s.drift, y, s.z + Math.cos(k * 1.6 + s.ph) * s.drift);
      E.set(k * 2 + s.spin, k * 3, Math.sin(k * 4) * 0.8);
      Q.setFromEuler(E);
      M.compose(P, Q, S);
      m.setMatrixAt(i, M);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <planeGeometry args={[0.16, 0.24]} />
      <meshStandardMaterial color="#b7c94a" side={THREE.DoubleSide} roughness={1} />
    </instancedMesh>
  );
}

function Butterflies() {
  const seeds = useMemo(() => {
    const rnd = mulberry32(13);
    const colors = ["#8fd3ff", "#ffb3d9", "#ffe08a", "#c8f79b"];
    return Array.from({ length: 6 }, (_, i) => ({
      cx: i < 4 ? (rnd() - 0.5) * 12 : (rnd() - 0.5) * 30,
      cz: i < 4 ? -12 + (rnd() - 0.5) * 8 : (rnd() - 0.5) * 30,
      cy: 0.9 + rnd() * 1,
      rx: 1.5 + rnd() * 2.5,
      rz: 1.5 + rnd() * 2.5,
      sp: 0.3 + rnd() * 0.4,
      flap: 8 + rnd() * 5,
      ph: rnd() * Math.PI * 2,
      color: colors[i % colors.length],
    }));
  }, []);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const wingsL = useRef<(THREE.Mesh | null)[]>([]);
  const wingsR = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    seeds.forEach((s, i) => {
      const g = groups.current[i];
      if (!g) return;
      const a = t * s.sp + s.ph;
      const x = s.cx + Math.sin(a) * s.rx;
      const z = s.cz + Math.cos(a * 1.3) * s.rz;
      g.position.set(x, s.cy + Math.sin(t * 1.7 + s.ph) * 0.3, z);
      g.rotation.y = Math.atan2(Math.cos(a) * s.rx, -Math.sin(a * 1.3) * s.rz * 1.3);
      const f = Math.sin(t * s.flap) * 0.9;
      const wl = wingsL.current[i];
      const wr = wingsR.current[i];
      if (wl) wl.rotation.z = f;
      if (wr) wr.rotation.z = -f;
    });
  });
  return (
    <group>
      {seeds.map((s, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)}>
          <mesh ref={(el) => (wingsL.current[i] = el)} position={[-0.02, 0, 0]}>
            <planeGeometry args={[0.2, 0.14]} />
            <meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={0.4} side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={(el) => (wingsR.current[i] = el)} position={[0.02, 0, 0]}>
            <planeGeometry args={[0.2, 0.14]} />
            <meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={0.4} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Birds() {
  const flock = useRef<THREE.Group>(null);
  const wings = useRef<(THREE.Mesh | null)[]>([]);
  const offsets = useMemo(
    () => [
      [0, 0, 0], [-2.2, 0.4, 1.6], [2.2, 0.3, 1.7], [-4.2, 0.8, 3.4], [4.4, 0.6, 3.5],
    ],
    [],
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (flock.current) {
      const a = t * 0.055;
      flock.current.position.set(Math.cos(a) * 58, 24 + Math.sin(t * 0.3) * 2.5, Math.sin(a) * 58);
      flock.current.rotation.y = -a - Math.PI / 2;
    }
    wings.current.forEach((w, i) => {
      if (w) w.rotation.x = Math.sin(t * 7 + i) * 0.7;
    });
  });
  return (
    <group ref={flock}>
      {offsets.map((o, i) => (
        <mesh key={i} ref={(el) => (wings.current[i] = el)} position={o as [number, number, number]}>
          <planeGeometry args={[1.5, 0.34]} />
          <meshBasicMaterial color="#2b3438" side={THREE.DoubleSide} fog={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Entorno raíz del Bosque. Debe montarse DENTRO de <Physics>.
// ---------------------------------------------------------------------------
export default function BosqueEnvironment() {
  const curve = useMemo(() => buildPathCurve(), []);
  const samples = useMemo(() => samplePath(curve), [curve]);
  const layout = getWorldLayout("bosque");
  return (
    <group>
      <Sky />
      <Mountains />
      <Ground />
      <Path curve={curve} samples={samples} />
      <Trees />
      <GiantTree x={-16} z={-1} />
      <GiantTree x={15} z={4} />
      <RiverAndFalls />
      <Ruins x={8} z={-1} />
      <GuardianStatue x={-2.9} z={23.6} face={0.5} />
      <GuardianStatue x={2.9} z={23.6} face={-0.5} />
      {/* Raíces: dos cruzan el sendero (se saltan), el resto decoran. */}
      <Root x={-8.6} z={9.6} rotY={0.55} radius={1.5} jumpable />
      <Root x={1.5} z={-6.2} rotY={-0.5} radius={1.4} jumpable />
      <Root x={-14.5} z={-4.5} rotY={1.2} radius={2.2} />
      <Root x={13} z={1} rotY={-0.9} radius={1.8} />
      <Root x={-11} z={-15} rotY={0.3} radius={1.6} />
      {layout.missionSpots.slice(0, 4).map(([sx, sz], i) => (
        <CrystalPedestal key={i} x={sx} z={sz} />
      ))}
      <VoidAltar x={layout.missionSpots[4][0]} z={layout.missionSpots[4][1]} />
      <SealedPath x={layout.decorSpots.blocked[0]} z={layout.decorSpots.blocked[1]} />
      <PortalFrame x={layout.decorSpots.portal[0]} z={layout.decorSpots.portal[1]} />
      <Vegetation samples={samples} />
      <GodRays />
      <GroundFog />
      <Fireflies />
      <DustMotes />
      <FallingLeaves />
      <Butterflies />
      <Birds />
    </group>
  );
}
