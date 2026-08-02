// render/toon.ts — Fase 10 "Anime Pass": cel-shading global.
//
// POR QUÉ: el vídeo canon (docs/ref/canon-video-mundo.png) es ILUSTRACIÓN
// anime, no 3D realista. La diferencia no es la densidad ni el bloom: es el
// MODELO DE SOMBREADO. El PBR reparte la luz en un degradado continuo y lee
// como "plástico"; el cel-shading la reparte en BANDAS DURAS y lee como
// dibujo. Es la técnica de Genshin Impact / Zelda BOTW.
//
// CÓMO: <ToonizarEscena/> recorre el grafo y sustituye cada
// MeshStandardMaterial por un MeshToonMaterial equivalente con una rampa de
// 3 escalones (DataTexture + NearestFilter = corte duro real), preservando
// todo lo que define al material original (map, alfa, lados, instancing…).
//
// VALORES CALIBRADOS EN NAVEGADOR (no teóricos — ver memoria del proyecto):
//   · Cara en sombra a 0.44, NO a 0.26: por debajo aparecen negros que el
//     vídeo canon no tiene (sus caras a contraluz son azul medio).
//   · Sombra fría fuerte (0.85) y de rango ancho (0.02–0.62): la sombra
//     PROYECTADA también se vuelve banda dura, y sin este levantamiento se
//     convierte en una mancha sólida negra sobre el suelo.
//
// EXENCIONES (importantes): emisivos (cristales, Nova, hechizos: deben seguir
// entrando en Bloom), shaders propios (agua, cielo, god rays) y —decisión de
// diseño conservadora— los materiales con RECORTE ALFA (follaje, hierba):
// convertirlos aporta poco y arriesga romper su silueta, que es justo lo que
// da frondosidad. Se pueden excluir a mano con userData.sinToon = true.

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/** Tinte de la banda en sombra: azul-violeta frío, jamás negro. */
export const TOON_SOMBRA = "#6f63b8";
/** Luz de borde fría que recorta la silueta contra el fondo (ANEXO §3). */
export const TOON_RIM = "#8fd0ff";

// ---------------------------------------------------------------------------
// Rampa de bandas. Se usan 64 téxeles con NearestFilter para poder COLOCAR los
// cortes donde los pide el look (y no donde caigan con 3 téxeles).
// ---------------------------------------------------------------------------
const ESCALONES = [
  { hasta: 0.5, valor: 0.44 }, // N·L < 0     → cara en sombra (azulada, no negra)
  { hasta: 0.63, valor: 0.72 }, // N·L < 0.26  → banda intermedia estrecha
  { hasta: 1.01, valor: 1.0 }, //  resto       → luz plena
];

let rampaCache: THREE.DataTexture | null = null;

function rampaBandas(): THREE.DataTexture {
  if (rampaCache) return rampaCache;
  const N = 64;
  const datos = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const coord = (i + 0.5) / N;
    const escalon = ESCALONES.find((e) => coord < e.hasta) ?? ESCALONES[ESCALONES.length - 1];
    const v = Math.round(escalon.valor * 255);
    datos[i * 4] = v;
    datos[i * 4 + 1] = v;
    datos[i * 4 + 2] = v;
    datos[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(datos, N, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter; // sin interpolar: el corte debe ser duro
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  rampaCache = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// Inyección GLSL: sombra fría + rim. Va SOLO en el fragment, tras
// lights_fragment_end (donde ya existen reflectedLight, diffuseColor, normal
// y vViewPosition), así el vertex —y con él el skinning y el instancing—
// queda intacto.
// ---------------------------------------------------------------------------
const UNIFORMES_TOON = /* glsl */ `
uniform vec3 uToonSombraColor;
uniform float uToonSombraFuerza;
uniform vec3 uToonRimColor;
uniform float uToonRimFuerza;
`;

const CUERPO_TOON = /* glsl */ `
{
	// Sombra fría: la zona oscura es el color base desaturado y desplazado a
	// azul-violeta. Cubre también la sombra proyectada (rango ancho), que con
	// cel-shading se volvería una mancha negra sólida.
	vec3 luzRecibida = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	float lumRecibida = dot( luzRecibida, vec3( 0.2126, 0.7152, 0.0722 ) );
	float enSombra = 1.0 - smoothstep( 0.02, 0.62, lumRecibida );
	float lumBase = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	vec3 baseDesat = mix( diffuseColor.rgb, vec3( lumBase ), 0.42 );
	reflectedLight.indirectDiffuse += baseDesat * uToonSombraColor * ( uToonSombraFuerza * enSombra );

	// Rim frío: recorta la silueta contra el fondo. Es dependiente de la vista,
	// cosa que ninguna luz fija puede dar.
	float rimNdotV = saturate( dot( normalize( vViewPosition ), normal ) );
	totalEmissiveRadiance += uToonRimColor * ( pow( 1.0 - rimNdotV, 2.8 ) * uToonRimFuerza );
}
`;

export type OpcionesToon = {
  rimFuerza?: number;
  sombraFuerza?: number;
};

/** Marca un objeto (y su subárbol) para que el toon no lo toque. */
export function sinToon<T extends THREE.Object3D>(obj: T): T {
  obj.userData.sinToon = true;
  return obj;
}

// ---------------------------------------------------------------------------
// Conversión Standard → Toon, preservando TODO lo que define al material.
// ---------------------------------------------------------------------------
const cache = new WeakMap<THREE.Material, THREE.MeshToonMaterial>();

function aToon(origen: THREE.MeshStandardMaterial, opts: Required<OpcionesToon>): THREE.MeshToonMaterial {
  const existente = cache.get(origen);
  if (existente) return existente;

  const toon = new THREE.MeshToonMaterial();
  toon.gradientMap = rampaBandas();

  // Color y texturas
  toon.color.copy(origen.color);
  toon.map = origen.map;
  toon.alphaMap = origen.alphaMap;
  toon.aoMap = origen.aoMap;
  toon.lightMap = origen.lightMap;
  toon.lightMapIntensity = origen.lightMapIntensity;
  toon.normalMap = origen.normalMap;
  if (origen.normalScale) toon.normalScale.copy(origen.normalScale);
  toon.emissive.copy(origen.emissive);
  toon.emissiveMap = origen.emissiveMap;
  toon.emissiveIntensity = origen.emissiveIntensity;

  // Transparencia y recorte (CRÍTICO: sin alphaTest, una carta de follaje se
  // convierte en un rectángulo sólido).
  toon.transparent = origen.transparent;
  toon.opacity = origen.opacity;
  toon.alphaTest = origen.alphaTest;
  toon.depthWrite = origen.depthWrite;
  toon.depthTest = origen.depthTest;
  toon.blending = origen.blending;

  // Geometría / render
  toon.side = origen.side;
  toon.vertexColors = origen.vertexColors;
  toon.wireframe = origen.wireframe;
  toon.fog = origen.fog;
  toon.toneMapped = origen.toneMapped;
  toon.name = `${origen.name || "mat"}__toon`;

  // Sombra fría + rim
  toon.onBeforeCompile = (shader) => {
    shader.uniforms.uToonSombraColor = { value: new THREE.Color(TOON_SOMBRA) };
    shader.uniforms.uToonSombraFuerza = { value: opts.sombraFuerza };
    shader.uniforms.uToonRimColor = { value: new THREE.Color(TOON_RIM) };
    shader.uniforms.uToonRimFuerza = { value: opts.rimFuerza };
    shader.fragmentShader = UNIFORMES_TOON + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_end>",
      `#include <lights_fragment_end>\n${CUERPO_TOON}`,
    );
  };
  // Un solo programa GLSL compartido por todos los materiales toon.
  toon.customProgramCacheKey = () => "nexus-toon-v1";

  // Si el dueño libera el original, liberamos la copia.
  origen.addEventListener("dispose", () => {
    toon.dispose();
    cache.delete(origen);
  });

  cache.set(origen, toon);
  return toon;
}

/** ¿Este material debe quedarse como está? */
function exento(mat: THREE.Material): boolean {
  if (mat.userData?.sinToon) return true;
  if (!(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return true;
  if ((mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) return true;
  const std = mat as THREE.MeshStandardMaterial;
  // Emisivos: cristales, Nova, hechizos. Deben seguir brillando y entrando en Bloom.
  if (std.emissiveIntensity >= 1 && std.emissive && std.emissive.getHex() !== 0) return true;
  // Recorte alfa: follaje y hierba. Su valor está en la silueta, no en el sombreado.
  if (std.alphaTest > 0) return true;
  // Aditivos / transparentes sin depth: FX, niebla, halos.
  if (std.blending !== THREE.NormalBlending) return true;
  if (std.transparent && std.depthWrite === false) return true;
  // Shaders con inyección propia ajena (romperíamos sus chunks).
  const inyeccionAjena = std.onBeforeCompile.toString().replace(/\s/g, "").length > 30;
  if (inyeccionAjena && !std.userData?.toonOk) return true;
  return false;
}

// ---------------------------------------------------------------------------
// ToonizarEscena: recorre el grafo y aplica la conversión. Se remuestrea cada
// cierto tiempo porque R3F re-adjunta materiales JSX al re-renderizar y porque
// el entorno y los GLB se pueblan de forma diferida (Suspense).
// ---------------------------------------------------------------------------
export function ToonizarEscena({
  clave,
  rimFuerza = 0.24,
  sombraFuerza = 0.85,
}: {
  /** Cambia al cambiar de mundo: fuerza un barrido inmediato. */
  clave?: string;
  rimFuerza?: number;
  sombraFuerza?: number;
}) {
  const scene = useThree((s) => s.scene);
  const desde = useRef(0);
  const siguiente = useRef(0);
  const opts = { rimFuerza, sombraFuerza };

  const barrer = () => {
    scene.traverse((obj) => {
      if (obj.userData?.sinToon) return;
      const malla = obj as THREE.Mesh;
      if (!malla.isMesh && !(malla as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
      const mat = malla.material;
      if (Array.isArray(mat)) {
        let cambiado = false;
        const nuevos = mat.map((m) => {
          if (exento(m)) return m;
          cambiado = true;
          return aToon(m as THREE.MeshStandardMaterial, opts);
        });
        if (cambiado) malla.material = nuevos;
      } else if (mat && !exento(mat)) {
        malla.material = aToon(mat as THREE.MeshStandardMaterial, opts);
      }
    });
  };

  useEffect(() => {
    desde.current = 0;
    siguiente.current = 0;
    barrer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, scene]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (desde.current === 0) desde.current = t;
    if (t < siguiente.current) return;
    // Denso los primeros segundos (la escena se puebla), luego espaciado.
    siguiente.current = t + (t - desde.current < 10 ? 0.25 : 0.6);
    barrer();
  });

  return null;
}
