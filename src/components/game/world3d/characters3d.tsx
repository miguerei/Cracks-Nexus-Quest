// Fase 6 — Personajes 3D estilizados de verdad: KayKit Adventurers (CC0),
// modelos GLB con esqueleto y clips de animación reales, optimizados con
// meshopt+webp y podados a los clips que usa el juego (~760 KB por modelo).
//
// Contrato (lo consumen otros módulos: World3DScene y la oleada de batalla):
//   import { Adventurer } from "./characters3d"
//   - mode "world": locomoción Idle↔Walking_A↔Running_A por speedRef, ciclo de
//     salto por airborneRef, giro por facingRef (como el HeroModel clásico).
//   - mode "stage": clip por pose (cast/hit/cheer/defeat/idle); poseN re-dispara
//     aunque se repita la pose; los one-shot vuelven a Idle al terminar
//     (excepto defeat, que se queda clavado en el último frame de Death_A).
//   - Si la carga FALLA devuelve el `fallback` (por defecto null): el consumidor
//     decide qué enseñar. La carga en curso se maneja con <Suspense> fuera.
//
// Reglas de casa: animación por refs + AnimationMixer en useFrame (cero estado
// React por frame), SkeletonUtils.clone por instancia (nunca compartir
// esqueleto), materiales clonados con tinte por clase y dispose al desmontar.

import { Component, type ReactNode, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";

import { getHeroLook } from "./worldConfig";

// ---------------------------------------------------------------------------
// Catálogo de modelos y mapeo clase→modelo (identidad §4 del Art Bible).
// ---------------------------------------------------------------------------
const MODEL_BASE = "/models/characters";

type ModelKey = "Barbarian" | "Knight" | "Mage" | "Rogue" | "Rogue_Hooded";

/** Clase canónica → aventurero KayKit que mejor encarna su silueta.
 * Map (y no objeto) a propósito: la clase "constructor" colisionaría con
 * Object.prototype.constructor en un literal tipado. */
const CLASS_MODEL = new Map<string, ModelKey>([
  ["explorador", "Rogue_Hooded"], // capucha + cuero: aventurero ligero
  ["estratega", "Knight"], //        armadura noble azul/dorada
  ["sabio", "Mage"], //              túnica + bastón + sombrero
  ["velocista", "Rogue"], //         silueta ágil sin capucha
  ["constructor", "Barbarian"], //   corpulento, martillo/hacha
]);

/** Altura del cuerpo (pies→coronilla) medida en cada GLB, para normalizar. */
const MODEL_HEIGHT: Record<ModelKey, number> = {
  Barbarian: 2.186,
  Knight: 2.315,
  Mage: 2.203,
  Rogue: 2.187,
  Rogue_Hooded: 2.251,
};

/** Altura objetivo: la del HeroModel procedural (pies→coronilla ≈ 2.2 u). */
const TARGET_HEIGHT = 2.2;

/** Acentos por defecto cuando no llega `accent` (canon de World3DScene). */
const NPC_ACCENT = "#7dd3fc";
const RIVAL_ACCENT = "#f472b6";

function modelUrl(key: ModelKey): string {
  return `${MODEL_BASE}/${key}.glb`;
}

/** Desfase de fase del Idle por variante: que NPC y rival no respiren a la vez. */
const IDLE_PHASE: Record<string, number> = { hero: 0, npc: 0.45, rival: 0.9 };

/** Clip por pose del modo "stage". */
const POSE_CLIP: Record<string, string> = {
  idle: "Idle",
  cast: "Spellcast_Shoot",
  hit: "Hit_A",
  cheer: "Cheer",
  defeat: "Death_A",
};

// ---------------------------------------------------------------------------
// Props públicas (contrato — solo cambios ADITIVOS a partir de aquí).
// ---------------------------------------------------------------------------
export type AdventurerPose = "idle" | "cast" | "hit" | "cheer" | "defeat";

export type AdventurerProps = {
  /** Clase canónica del póster (elige modelo y acento). */
  classId?: string;
  /** Papel del personaje; npc→Mage (guía sabia), rival→Rogue tintado rosa. */
  variant?: "hero" | "npc" | "rival";
  /** "world": locomoción por refs. "stage": clip declarativo por pose. */
  mode: "world" | "stage";
  /** ref con la magnitud de velocidad horizontal (0..1). */
  speedRef?: React.MutableRefObject<number>;
  /** ref con true mientras el personaje está en el aire (salto/caída). */
  airborneRef?: React.MutableRefObject<boolean>;
  /** ref con el ángulo de rotación Y objetivo (se suaviza por frame). */
  facingRef?: React.MutableRefObject<number>;
  /** Pose del modo "stage". */
  pose?: AdventurerPose;
  /** Contador que re-dispara la pose aunque se repita (p.ej. 2º cast seguido). */
  poseN?: number;
  /** Tinte de acento; si falta se deriva de la clase/variante. */
  accent?: string;
  /** Escala extra sobre la normalización de altura (1 = altura del héroe). */
  scale?: number;
  // --- Extras aditivos (no forman parte del contrato mínimo) ---
  /**
   * ref con el tiempo restante (s) de la pose de lanzamiento en modo "world";
   * el rig lo decrementa y reproduce Spellcast_Shoot (§7) mientras dure.
   */
  castTimeRef?: React.MutableRefObject<number>;
  /** Qué renderizar si el GLB falla al cargar (por defecto, nada). */
  fallback?: ReactNode;
};

// ---------------------------------------------------------------------------
// Límite de error interno: si el loader revienta (404, GLB corrupto, WebGL…),
// el personaje se degrada al fallback del consumidor en vez de tirar el Canvas.
// ---------------------------------------------------------------------------
class LimiteCargaModelo extends Component<
  { fallback: ReactNode; children: ReactNode },
  { roto: boolean }
> {
  state = { roto: false };
  static getDerivedStateFromError() {
    return { roto: true };
  }
  render() {
    return this.state.roto ? this.props.fallback : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Rig interno: clona el GLB, tinta materiales y gobierna el AnimationMixer.
// ---------------------------------------------------------------------------
function AdventurerRig({
  classId,
  variant = "hero",
  mode,
  speedRef,
  airborneRef,
  facingRef,
  pose = "idle",
  poseN = 0,
  accent,
  scale = 1,
  castTimeRef,
}: AdventurerProps) {
  const modelKey: ModelKey =
    variant === "npc" ? "Mage" : variant === "rival" ? "Rogue" : (CLASS_MODEL.get(classId ?? "") ?? "Rogue_Hooded");
  // Sin draco (nuestros GLB usan meshopt) para no depender de decoders CDN.
  const gltf = useGLTF(modelUrl(modelKey), false, true);

  const root = useRef<THREE.Group>(null);

  // Clon por instancia: SkeletonUtils re-liga los SkinnedMesh a huesos propios
  // (compartir esqueleto entre dos monturas corrompe ambas animaciones).
  const escena = useMemo(() => SkeletonUtils.clone(gltf.scene) as THREE.Group, [gltf.scene]);

  // Acento final: prop > canon de variante > acento de la clase (§4).
  const acento = accent ?? (variant === "rival" ? RIVAL_ACCENT : variant === "npc" ? NPC_ACCENT : getHeroLook(classId).accent);

  // Tinte por clase: los KayKit comparten paleta base, así que cada instancia
  // clona sus materiales y mezcla el acento (color sutil + emissive < 1: da
  // identidad de clase sin entrar en Bloom, que queda para props que brillan).
  const materialesClonados = useMemo(() => {
    const tinte = new THREE.Color(acento);
    const fuerza = variant === "rival" ? 0.32 : 0.16;
    const clones: THREE.Material[] = [];
    const vistos = new Map<THREE.Material, THREE.Material>();
    escena.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
      mesh.castShadow = true;
      // El bbox del bind pose no cubre las poses animadas: sin esto el
      // personaje desaparece al agacharse/saltar cerca del borde del frustum.
      if ((mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) mesh.frustumCulled = false;
      const lista = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const nuevos = lista.map((mat) => {
        let clon = vistos.get(mat);
        if (!clon) {
          clon = mat.clone();
          const std = clon as THREE.MeshStandardMaterial;
          if (std.color) std.color.lerp(tinte, fuerza);
          if (std.emissive) {
            std.emissive.copy(tinte);
            std.emissiveIntensity = variant === "hero" ? 0.26 : 0.18;
          }
          vistos.set(mat, clon);
          clones.push(clon);
        }
        return clon;
      });
      mesh.material = Array.isArray(mesh.material) ? nuevos : nuevos[0];
    });
    return clones;
  }, [escena, acento, variant]);

  // Los materiales clonados son nuestros: se liberan al desmontar. La geometría
  // y las texturas pertenecen al GLTF cacheado (useGLTF) y NO se tocan.
  useEffect(() => {
    return () => {
      for (const m of materialesClonados) m.dispose();
    };
  }, [materialesClonados]);

  // Mixer + acciones por nombre de clip.
  const mixer = useMemo(() => new THREE.AnimationMixer(escena), [escena]);
  const acciones = useMemo(() => {
    const out = new Map<string, THREE.AnimationAction>();
    for (const clip of gltf.animations) out.set(clip.name, mixer.clipAction(clip));
    return out;
  }, [gltf.animations, mixer]);
  useEffect(() => {
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(escena);
    };
  }, [mixer, escena]);

  // Estado de reproducción (refs: nunca estado React por frame).
  const actual = useRef<{ nombre: string; accion: THREE.AnimationAction } | null>(null);
  const finalizado = useRef<string | null>(null); // último clip one-shot terminado
  const faseSalto = useRef<"no" | "start" | "aire" | "aterriza">("no");
  const casteando = useRef(false);

  /** Reproduce un clip con crossfade; `otraVez` fuerza re-disparo del mismo. */
  const reproducir = (
    nombre: string,
    opts: { unaVez?: boolean; fundido?: number; velocidad?: number; desfase?: number; otraVez?: boolean } = {},
  ) => {
    const accion = acciones.get(nombre);
    if (!accion) return;
    const { unaVez = false, fundido = 0.2, velocidad = 1, desfase = 0, otraVez = false } = opts;
    if (actual.current?.nombre === nombre && !otraVez) return;
    const previa = actual.current?.accion;
    accion.reset();
    accion.enabled = true;
    accion.setLoop(unaVez ? THREE.LoopOnce : THREE.LoopRepeat, unaVez ? 1 : Infinity);
    accion.clampWhenFinished = unaVez;
    accion.timeScale = velocidad;
    if (desfase > 0) accion.time = desfase % accion.getClip().duration;
    if (previa && previa !== accion) accion.crossFadeFrom(previa, fundido, false);
    accion.play();
    actual.current = { nombre, accion };
  };
  const reproducirRef = useRef(reproducir);
  reproducirRef.current = reproducir;

  // Aviso de fin de clip one-shot (anota el nombre; los modos lo consumen).
  useEffect(() => {
    const alTerminar = (e: { action: THREE.AnimationAction }) => {
      finalizado.current = e.action.getClip().name;
      if (mode === "stage") {
        // Recuperación §7: todo one-shot vuelve a Idle… salvo la derrota,
        // que se queda clavada en el último frame (clampWhenFinished).
        if (finalizado.current !== "Death_A") {
          reproducirRef.current("Idle", { fundido: 0.25, desfase: IDLE_PHASE[variant] ?? 0 });
        }
      }
    };
    mixer.addEventListener("finished", alTerminar as never);
    return () => mixer.removeEventListener("finished", alTerminar as never);
  }, [mixer, mode, variant]);

  // Modo "stage": clip declarativo por pose; poseN re-dispara la misma pose.
  useEffect(() => {
    if (mode !== "stage") return;
    const nombre = POSE_CLIP[pose] ?? "Idle";
    if (nombre === "Idle") {
      reproducirRef.current("Idle", { fundido: 0.25, desfase: IDLE_PHASE[variant] ?? 0 });
    } else {
      // Anticipación corta (fundido rápido) → acción; la recuperación la trae
      // el aviso de fin (vuelta a Idle) salvo en la derrota.
      reproducirRef.current(nombre, { unaVez: true, fundido: 0.12, otraVez: true, velocidad: pose === "cast" ? 1.35 : 1 });
    }
    // poseN forma parte de las deps a propósito: mismo `pose`, nuevo disparo.
  }, [mode, pose, poseN, variant, acciones]);

  // Arranque en "world": Idle desde el primer frame (con desfase por variante).
  useEffect(() => {
    if (mode !== "world") return;
    reproducirRef.current("Idle", { fundido: 0, desfase: IDLE_PHASE[variant] ?? 0 });
  }, [mode, variant, acciones]);

  useFrame((_, dt) => {
    // Giro suave hacia la dirección deseada (idéntico al HeroModel clásico).
    if (root.current && facingRef) {
      const objetivo = facingRef.current;
      const actualY = root.current.rotation.y;
      let delta = objetivo - actualY;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      root.current.rotation.y = actualY + delta * Math.min(1, dt * 12);
    }

    if (mode === "world") {
      const spd = speedRef?.current ?? 0;
      const enAire = airborneRef?.current ?? false;
      const fin = finalizado.current;

      // --- Ciclo de salto: Jump_Start → Jump_Idle → Jump_Land ---
      if (enAire) {
        if (faseSalto.current === "no" || faseSalto.current === "aterriza") {
          faseSalto.current = "start";
          casteando.current = false;
          reproducir("Jump_Start", { unaVez: true, fundido: 0.08, velocidad: 1.4 });
        } else if (faseSalto.current === "start" && fin === "Jump_Start") {
          finalizado.current = null;
          faseSalto.current = "aire";
          reproducir("Jump_Idle", { fundido: 0.12 });
        }
      } else if (faseSalto.current === "start" || faseSalto.current === "aire") {
        faseSalto.current = "aterriza";
        reproducir("Jump_Land", { unaVez: true, fundido: 0.08, velocidad: 1.5 });
      } else if (faseSalto.current === "aterriza") {
        if (fin === "Jump_Land" || spd > 0.15) {
          // Recuperación §7: al tocar suelo (o si el jugador ya corre) se
          // reincorpora a la locomoción.
          finalizado.current = null;
          faseSalto.current = "no";
        }
      }

      if (faseSalto.current === "no") {
        // --- Cast transitorio (§7): Spellcast_Shoot mientras dure el ref ---
        if (castTimeRef && castTimeRef.current > 0) {
          castTimeRef.current = Math.max(0, castTimeRef.current - dt);
          if (!casteando.current) {
            casteando.current = true;
            reproducir("Spellcast_Shoot", { unaVez: true, fundido: 0.07, velocidad: 1.6, otraVez: true });
          }
        }
        if (casteando.current) {
          // Suelta la pose cuando el clip termina, o antes si ya está corriendo.
          const termino = fin === "Spellcast_Shoot";
          if (termino || (castTimeRef && castTimeRef.current === 0 && spd > 0.15)) {
            if (termino) finalizado.current = null;
            casteando.current = false;
          }
        }
        if (!casteando.current) {
          // --- Locomoción: Idle ↔ Walking_A ↔ Running_A con crossfade ---
          if (spd < 0.1) {
            reproducir("Idle", { fundido: 0.22, desfase: IDLE_PHASE[variant] ?? 0 });
          } else if (spd < 0.6) {
            reproducir("Walking_A", { fundido: 0.2 });
            if (actual.current) actual.current.accion.timeScale = 0.85 + spd * 0.6;
          } else {
            reproducir("Running_A", { fundido: 0.2 });
            if (actual.current) actual.current.accion.timeScale = 0.9 + spd * 0.35;
          }
        }
      }
    }

    mixer.update(dt);
  });

  const escalaFinal = (TARGET_HEIGHT / MODEL_HEIGHT[modelKey]) * scale;

  return (
    <group ref={root} scale={escalaFinal}>
      <primitive object={escena} />
      {/* Luz de presencia (paridad con el HeroModel clásico) solo en el mundo:
          en el stage la iluminación la gobierna la escena de batalla. */}
      {mode === "world" && (
        <pointLight
          color={acento}
          intensity={variant === "hero" ? 3.5 : 1.8}
          distance={variant === "hero" ? 5 : 3.5}
          position={[0, 1.3, 0]}
        />
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Adventurer: envoltorio público con límite de error interno.
// Suspense-safe: mientras el GLB carga, suspende (el consumidor pone el
// fallback de carga); si la carga FALLA, renderiza `fallback` (null por defecto).
// ---------------------------------------------------------------------------
export function Adventurer(props: AdventurerProps) {
  return (
    <LimiteCargaModelo fallback={props.fallback ?? null}>
      <AdventurerRig {...props} />
    </LimiteCargaModelo>
  );
}

// Precarga de los 5 aventureros: en cuanto este módulo entra al bundle del
// Canvas, los GLB se piden en paralelo (sin draco, con meshopt).
for (const key of Object.keys(MODEL_HEIGHT) as ModelKey[]) {
  useGLTF.preload(modelUrl(key), false, true);
}
