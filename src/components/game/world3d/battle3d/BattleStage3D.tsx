// battle3d/BattleStage3D.tsx — escenario de combate 3D (fondo del reto).
//
// El plano canon del vídeo intro: héroe DE ESPALDAS ante el enemigo entre
// ruinas. Responder bien = hechizo (anticipación → ARCO ELÉCTRICO azul →
// proyectil cristalino con estela → impacto en el NÚCLEO: destello, anillos
// de onda, partículas ascendentes). Fallar = pulso de niebla violeta hacia el
// héroe con sacudida sutil (nunca castigo dramático). Victoria = disolución
// en partículas doradas+azules. Derrota = desvanecerse en niebla, sereno.
//
// Reglas duras: client-only (se monta lazy tras <ClientOnly>), determinista
// (mulberry32), animación por refs en useFrame (jamás setState por frame),
// pools pequeños, máx. 1 pointLight de FX activa, sin sombras, dpr [1, 1.5].

import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { CinematicEffects } from "../render/CinematicEffects";
import { getTierDpr, useQualityTier } from "../render/quality";

import { getHeroLook } from "../worldConfig";
import { StageActor, type StagePose } from "./stageActors";
import { HordeShades, RivalEnemy, RuneWard, VoidColossus, createEnemyFx, type EnemyFx } from "./enemies";
import RuinsArena from "./RuinsArena";
import { cssColorToHex, mulberry32 } from "./battleUtils";
import { HERO_HIP_Y, HERO_POS, HERO_SCALE, STAGE_CFG } from "./stageConfig";
import type { BattleEvent, BattleEventKind, BattleStage3DProps, StageVariant } from "./types";

const AZUL_HECHIZO = "#38bdf8";
const CIAN_HOLO = "#7dd3fc";
const VIOLETA_PROFUNDO = "#7c3aed";
const BLANCO_MAGICO = "#eaf6ff";
const DORADO = "#f4c542";

/** Duración de la anticipación del cast (§7: retroceso ~150 ms + carga). */
const WINDUP = 0.22;
/** Duración del vuelo del proyectil hasta el núcleo. */
const FLIGHT = 0.5;
/** Tamaño de los pools de VFX (pequeños, se reutilizan siempre). */
const PART_N = 16;
const TRAIL_N = 6;
const ARC_N = 11;

// ---------------------------------------------------------------------------
// VisibilityFrameDriver: si la pestaña está oculta, requestAnimationFrame no
// dispara y el fondo se congela. Conmutamos a frameloop manual con intervalo.
// (Patrón copiado de World3DScene; aquí no hay físicas, solo animación.)
// ---------------------------------------------------------------------------
function VisibilityFrameDriver() {
  const advance = useThree((s) => s.advance);
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    let iv: number | null = null;
    const apply = () => {
      if (document.hidden) {
        setFrameloop("never");
        // advance() en modo "never" espera un timestamp en SEGUNDOS.
        if (iv == null) iv = window.setInterval(() => advance(performance.now() / 1000), 1000 / 30);
      } else {
        if (iv != null) {
          window.clearInterval(iv);
          iv = null;
        }
        setFrameloop("always");
      }
    };
    apply();
    document.addEventListener("visibilitychange", apply);
    return () => {
      document.removeEventListener("visibilitychange", apply);
      if (iv != null) window.clearInterval(iv);
    };
  }, [advance, setFrameloop]);
  return null;
}

// ---------------------------------------------------------------------------
// Cámara fija con deriva cinematográfica y sacudida sutil (fallo/impacto).
// ---------------------------------------------------------------------------
function CameraRig({ variant, shakeRef }: { variant: StageVariant; shakeRef: MutableRefObject<number> }) {
  const { camera } = useThree();
  const cfg = STAGE_CFG[variant];
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    shakeRef.current = Math.max(0, shakeRef.current - dt * 2.2);
    const s = shakeRef.current;
    const ox = Math.sin(t * 39) * 0.09 * s + Math.sin(t * 0.4) * 0.06;
    const oy = Math.cos(t * 47) * 0.07 * s + Math.sin(t * 0.27) * 0.05;
    camera.position.set(cfg.cam[0] + ox, cfg.cam[1] + oy, cfg.cam[2]);
    camera.lookAt(cfg.look[0] + ox * 0.6, cfg.look[1] + oy * 0.6, cfg.look[2]);
  });
  return null;
}

// ---------------------------------------------------------------------------
// BattleVFX: director de efectos. Máquina de tiempos en un ref, avanzada en
// useFrame; posee todos los meshes de efecto (proyectil, estela, arco,
// destello, anillos, partículas, pulso del Vacío) y la ÚNICA pointLight FX.
// ---------------------------------------------------------------------------
type FxRuntime = {
  kind: BattleEventKind;
  t: number;
  fired: boolean;
  impacted: boolean;
  impactAt: number;
  projT: number;
  ghostFade: number;
  shaken: boolean;
};

function BattleVFX({
  variant,
  eventKind,
  eventN,
  enemyFx,
  shakeRef,
  heroRigRef,
}: {
  variant: StageVariant;
  eventKind: BattleEventKind;
  eventN: number;
  enemyFx: MutableRefObject<EnemyFx>;
  shakeRef: MutableRefObject<number>;
  heroRigRef: MutableRefObject<THREE.Group | null>;
}) {
  const cfg = STAGE_CFG[variant];

  const rt = useRef<FxRuntime>({
    kind: "idle",
    t: 0,
    fired: false,
    impacted: false,
    impactAt: 0,
    projT: 0,
    ghostFade: 0,
    shaken: false,
  });

  // Refs de todos los actores del pool.
  const projRef = useRef<THREE.Group>(null);
  const ghostRefs = useRef<(THREE.Mesh | null)[]>([]);
  const flashRef = useRef<THREE.Mesh>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pulseRef = useRef<THREE.Mesh>(null);
  const partMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const fxLight = useRef<THREE.PointLight>(null);

  // Vectores/datos preasignados (cero allocaciones por frame).
  const handV = useMemo(() => new THREE.Vector3(...cfg.hand), [cfg]);
  const coreV = useMemo(() => new THREE.Vector3(...cfg.core), [cfg]);
  const pulseEndV = useMemo(() => new THREE.Vector3(HERO_POS[0] + 0.7, 1.8, HERO_POS[2] - 1.4), []);
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  // Direcciones deterministas de las ráfagas de partículas (ascendentes).
  const partData = useMemo(() => {
    const rnd = mulberry32(4242);
    return Array.from({ length: PART_N }, (_, i) => {
      const a = (i / PART_N) * Math.PI * 2 + rnd() * 0.6;
      const r = 0.5 + rnd() * 0.9;
      return {
        life: 0,
        ttl: 1,
        dir: new THREE.Vector3(Math.cos(a) * r, 0.9 + rnd() * 1.7, Math.sin(a) * r),
        vel: new THREE.Vector3(),
      };
    });
  }, []);

  // Arco eléctrico: línea con jitter determinista, del guante hacia el núcleo.
  const arc = useMemo(() => {
    const rnd = mulberry32(1313);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ARC_N * 3), 3));
    const mat = new THREE.LineBasicMaterial({ color: CIAN_HOLO, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    line.frustumCulled = false;
    // Amplitudes por vértice (extremos anclados).
    const amps = Array.from({ length: ARC_N }, (_, i) => (0.05 + rnd() * 0.12) * Math.sin((i / (ARC_N - 1)) * Math.PI));
    const dir = new THREE.Vector3().subVectors(new THREE.Vector3(...cfg.core), new THREE.Vector3(...cfg.hand)).normalize();
    const perp1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();
    return { line, mat, geo, amps, dir, perp1, perp2 };
  }, [cfg]);
  useEffect(() => {
    return () => {
      arc.geo.dispose();
      arc.mat.dispose();
    };
  }, [arc]);

  // Un nuevo evento (n cambia) reinicia la máquina de tiempos.
  useEffect(() => {
    const r = rt.current;
    r.kind = eventKind;
    r.t = 0;
    r.fired = false;
    r.impacted = false;
    r.projT = 0;
    r.shaken = false;
    const fx = enemyFx.current;
    // Un nuevo asalto limpia los estados terminales previos.
    if (eventKind === "cast" || eventKind === "miss" || eventKind === "idle") {
      fx.dissolve = 0;
      fx.fade = 0;
    }
    if (eventKind !== "miss") fx.coreBoost = 0;
  }, [eventN, eventKind, enemyFx]);

  /** Ráfaga de partículas ascendentes desde el núcleo (pool reutilizado). */
  const spawnBurst = (todas: boolean) => {
    for (let i = 0; i < PART_N; i++) {
      // Impacto normal: solo las azules (pares). Victoria: doradas + azules.
      if (!todas && i % 2 === 1) continue;
      const d = partData[i];
      const m = partMeshes.current[i];
      if (!m) continue;
      d.ttl = todas ? 1.5 : 1;
      d.life = d.ttl;
      d.vel.copy(d.dir).multiplyScalar(todas ? 1.7 : 1.2);
      m.position.set(coreV.x + d.dir.x * 0.25, coreV.y + d.dir.y * 0.1, coreV.z + d.dir.z * 0.25);
      m.visible = true;
    }
  };

  useFrame((state, dt) => {
    const r = rt.current;
    const fx = enemyFx.current;
    r.t += dt;
    const t = r.t;
    const tGlobal = state.clock.elapsedTime;

    // Decaimiento de los impulsos del enemigo.
    fx.recoil = Math.max(0, fx.recoil - dt * 2.6);
    fx.flash = Math.max(0, fx.flash - dt * 4);

    const casting = r.kind === "cast" || r.kind === "victory";

    // Luz FX única: cada rama la reclama; si nadie, se apaga.
    let lightInt = 0;
    let lightColor: string | null = null;

    // --- Héroe: anticipación (retroceso) → proyección hacia delante (§7) ---
    const rig = heroRigRef.current;
    if (rig) {
      let dz = 0;
      let rx = 0;
      if (casting) {
        if (t < WINDUP) {
          const u = t / WINDUP;
          dz = 0.18 * u; // retrocede cargando el hechizo
          rx = 0.1 * u;
        } else if (t < WINDUP + 0.28) {
          const u = (t - WINDUP) / 0.28;
          dz = 0.18 - 0.44 * Math.sin(u * Math.PI * 0.5); // se proyecta
          rx = 0.1 - 0.24 * u;
        } else {
          const u = Math.min(1, (t - WINDUP - 0.28) / 0.6);
          dz = -0.26 * (1 - u); // vuelve al reposo
          rx = -0.14 * (1 - u);
        }
      }
      rig.position.z = HERO_POS[2] + dz;
      rig.rotation.x = rx;
    }

    // --- Arco eléctrico durante la carga ---
    const showArc = casting && t < WINDUP + 0.1;
    arc.line.visible = showArc;
    if (showArc) {
      const pos = arc.geo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < ARC_N; i++) {
        const u = i / (ARC_N - 1);
        const a = arc.amps[i];
        tmpV.copy(handV).addScaledVector(arc.dir, u * 1.7);
        tmpV.addScaledVector(arc.perp1, Math.sin(tGlobal * 41 + i * 5.3) * a);
        tmpV.addScaledVector(arc.perp2, Math.cos(tGlobal * 37 + i * 4.1) * a);
        pos.setXYZ(i, tmpV.x, tmpV.y, tmpV.z);
      }
      pos.needsUpdate = true;
      arc.mat.opacity = 0.55 + 0.4 * Math.abs(Math.sin(tGlobal * 57));
      lightInt = 2.5;
      lightColor = CIAN_HOLO;
      if (fxLight.current) fxLight.current.position.copy(handV);
    }

    // --- Proyectil: cristal octaédrico azul con estela ---
    const proj = projRef.current;
    if (casting && !r.fired && t >= WINDUP) {
      r.fired = true;
      r.ghostFade = 1;
      if (proj) {
        proj.visible = true;
        proj.position.copy(handV);
      }
      for (const g of ghostRefs.current) g?.position.copy(handV);
    }
    if (proj && r.fired && !r.impacted) {
      r.projT = Math.min(1, r.projT + dt / FLIGHT);
      const u = r.projT;
      const e = u * u * (3 - 2 * u);
      tmpV.lerpVectors(handV, coreV, e);
      tmpV.y += Math.sin(u * Math.PI) * 0.9; // ligera parábola
      proj.position.copy(tmpV);
      proj.rotation.x += dt * 9;
      proj.rotation.y += dt * 13;
      lightInt = 6;
      lightColor = AZUL_HECHIZO;
      if (fxLight.current) fxLight.current.position.copy(proj.position);
      if (u >= 1) {
        // ¡Impacto en el núcleo!
        r.impacted = true;
        r.impactAt = t;
        proj.visible = false;
        fx.recoil = 1;
        fx.flash = 1;
        shakeRef.current = Math.max(shakeRef.current, 0.22);
        spawnBurst(r.kind === "victory");
      }
    }

    // --- Estela del proyectil (cadena de fantasmas que persigue) ---
    if (r.fired && !r.impacted) r.ghostFade = 1;
    else r.ghostFade = Math.max(0, r.ghostFade - dt * 2.8);
    for (let i = 0; i < TRAIL_N; i++) {
      const g = ghostRefs.current[i];
      if (!g) continue;
      const target = i === 0 ? proj?.position : ghostRefs.current[i - 1]?.position;
      if (target) g.position.lerp(target, Math.min(1, dt * (15 - i * 1.6)));
      const op = (0.5 - i * 0.065) * r.ghostFade;
      g.visible = op > 0.02;
      (g.material as THREE.MeshStandardMaterial).opacity = op;
    }

    // --- Secuelas del impacto: destello + anillos de onda + luz ---
    const k = r.impacted ? t - r.impactAt : -1;
    const flash = flashRef.current;
    if (flash) {
      const u = k / 0.22;
      if (u >= 0 && u < 1) {
        flash.visible = true;
        flash.scale.setScalar(0.6 + u * 1.6);
        (flash.material as THREE.MeshStandardMaterial).opacity = 0.9 * (1 - u);
      } else flash.visible = false;
    }
    for (let ri = 0; ri < 2; ri++) {
      const ring = ringRefs.current[ri];
      if (!ring) continue;
      const u = (k - ri * 0.12) / 0.55;
      if (u >= 0 && u < 1) {
        ring.visible = true;
        ring.scale.setScalar(0.5 + u * 3.2);
        (ring.material as THREE.MeshStandardMaterial).opacity = 0.75 * (1 - u);
      } else ring.visible = false;
    }
    if (r.impacted && k < 0.45) {
      lightInt = Math.max(lightInt, 8 * (1 - k / 0.45));
      lightColor = BLANCO_MAGICO;
      if (fxLight.current) fxLight.current.position.copy(coreV);
    }

    // --- Victoria: el enemigo se disuelve (dorado+azul, ya en el aire) ---
    if (r.kind === "victory" && r.impacted) {
      fx.dissolve = Math.min(1, k / 1.3);
      if (k >= 0.45) {
        lightInt = Math.max(lightInt, 5 * (1 - fx.dissolve));
        lightColor = DORADO;
        if (fxLight.current) fxLight.current.position.copy(coreV);
      }
    }

    // --- Fallo: el núcleo se enciende → pulso de niebla violeta al héroe ---
    const pulse = pulseRef.current;
    if (r.kind === "miss") {
      fx.coreBoost = t < 0.25 ? t / 0.25 : Math.max(0, 1 - (t - 0.25) / 0.9);
      const pu = (t - 0.22) / 0.62;
      if (pulse) {
        if (pu >= 0 && pu < 1) {
          const e = pu * pu * (3 - 2 * pu);
          pulse.visible = true;
          tmpV.lerpVectors(coreV, pulseEndV, e);
          pulse.position.copy(tmpV);
          pulse.scale.setScalar(0.7 + pu * 2.6);
          (pulse.material as THREE.MeshBasicMaterial).opacity = 0.34 * (1 - pu * pu);
          lightInt = 4.5 * (1 - pu);
          lightColor = VIOLETA_PROFUNDO;
          if (fxLight.current) fxLight.current.position.copy(pulse.position);
        } else pulse.visible = false;
      }
      // Sacudida sutil del encuadre cuando la niebla alcanza al héroe.
      if (!r.shaken && t >= 0.78) {
        r.shaken = true;
        shakeRef.current = 0.8;
      }
    } else if (pulse?.visible) pulse.visible = false;

    // --- Derrota: desvanecerse en niebla, tono sereno ---
    if (r.kind === "defeat") fx.fade = Math.min(1, t / 1.8);

    // --- Partículas ascendentes (pool) ---
    for (let i = 0; i < PART_N; i++) {
      const d = partData[i];
      if (d.life <= 0) continue;
      const m = partMeshes.current[i];
      if (!m) continue;
      d.life -= dt;
      if (d.life <= 0) {
        m.visible = false;
        continue;
      }
      m.position.addScaledVector(d.vel, dt);
      d.vel.y += dt * 1.1; // ascienden, cada vez más ligeras
      d.vel.x *= 1 - dt * 0.8;
      d.vel.z *= 1 - dt * 0.8;
      m.rotation.x += dt * 5;
      m.rotation.y += dt * 7;
      const u = d.life / d.ttl;
      m.scale.setScalar(0.4 + u * 0.8);
      (m.material as THREE.MeshStandardMaterial).opacity = Math.min(1, u * 1.4);
    }

    // --- Aplicar la luz FX única ---
    const light = fxLight.current;
    if (light) {
      light.intensity = lightInt;
      if (lightColor) light.color.set(lightColor);
    }
  });

  return (
    <group>
      {/* Arco eléctrico (línea con jitter) */}
      <primitive object={arc.line} />

      {/* Proyectil: cristal octaédrico azul con corazón blanco */}
      <group ref={projRef} visible={false}>
        <mesh>
          <octahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial color={AZUL_HECHIZO} emissive={AZUL_HECHIZO} emissiveIntensity={2.4} flatShading />
        </mesh>
        <mesh>
          <octahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color={BLANCO_MAGICO} emissive={BLANCO_MAGICO} emissiveIntensity={3} />
        </mesh>
      </group>

      {/* Estela (fantasmas encadenados) */}
      {Array.from({ length: TRAIL_N }, (_, i) => (
        <mesh
          key={`ghost${i}`}
          ref={(el) => {
            ghostRefs.current[i] = el;
          }}
          visible={false}
          scale={0.17 - i * 0.02}
        >
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={AZUL_HECHIZO} emissive={AZUL_HECHIZO} emissiveIntensity={1.8} transparent opacity={0.4} />
        </mesh>
      ))}

      {/* Destello blanco del impacto */}
      <mesh ref={flashRef} position={cfg.core} visible={false}>
        <sphereGeometry args={[0.55, 14, 12]} />
        <meshStandardMaterial color={BLANCO_MAGICO} emissive={BLANCO_MAGICO} emissiveIntensity={2.6} transparent opacity={0.9} depthWrite={false} />
      </mesh>

      {/* Anillos de onda del impacto (miran a cámara) */}
      {[0, 1].map((i) => (
        <mesh
          key={`ring${i}`}
          ref={(el) => {
            ringRefs.current[i] = el;
          }}
          position={cfg.core}
          visible={false}
        >
          <ringGeometry args={[0.6, 0.72, 40]} />
          <meshStandardMaterial
            color={AZUL_HECHIZO}
            emissive={i === 0 ? BLANCO_MAGICO : AZUL_HECHIZO}
            emissiveIntensity={2}
            transparent
            opacity={0.75}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Pulso de niebla violeta del Vacío (fallo) */}
      <mesh ref={pulseRef} visible={false}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshBasicMaterial color={VIOLETA_PROFUNDO} transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {/* Pool de partículas: pares azules, impares doradas */}
      {Array.from({ length: PART_N }, (_, i) => (
        <mesh
          key={`part${i}`}
          ref={(el) => {
            partMeshes.current[i] = el;
          }}
          visible={false}
        >
          <octahedronGeometry args={[0.09, 0]} />
          <meshStandardMaterial
            color={i % 2 ? DORADO : CIAN_HOLO}
            emissive={i % 2 ? DORADO : CIAN_HOLO}
            emissiveIntensity={2.2}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}

      {/* La ÚNICA luz de efectos del escenario */}
      <pointLight ref={fxLight} intensity={0} distance={9} color={AZUL_HECHIZO} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Director de poses del rig animado (Adventurer). Traduce cada BattleEvent a
// poses de héroe y rival SINCRONIZADAS con los tiempos del VFX (el impacto
// del proyectil llega a WINDUP + FLIGHT ≈ 0.72 s; el pulso del Vacío alcanza
// al héroe a ~0.78 s). setState solo por evento, jamás por frame.
// ---------------------------------------------------------------------------
type PoseState = { pose: StagePose; n: number };

function useStagePoses(event: BattleEvent): { hero: PoseState; rival: PoseState } {
  const [hero, setHero] = useState<PoseState>({ pose: "idle", n: 0 });
  const [rival, setRival] = useState<PoseState>({ pose: "idle", n: 0 });

  useEffect(() => {
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    // n únicos por (evento, paso) para re-disparar la animación cada vez.
    const n = event.n * 2;
    switch (event.kind) {
      case "cast": // acierto: el héroe lanza; el rival encaja al llegar el proyectil
        setHero({ pose: "cast", n });
        later(720, () => setRival({ pose: "hit", n }));
        break;
      case "victory": // último hechizo + celebración; el rival cae
        setHero({ pose: "cast", n });
        later(720, () => setRival({ pose: "defeat", n }));
        later(1080, () => setHero({ pose: "cheer", n: n + 1 }));
        break;
      case "miss": // fallo: el rival conjura el pulso; el héroe lo encaja
        setRival({ pose: "cast", n });
        later(780, () => setHero({ pose: "hit", n }));
        break;
      case "defeat": // derrota serena: el héroe cae, el rival celebra
        setHero({ pose: "defeat", n });
        setRival({ pose: "cheer", n });
        break;
      default:
        break;
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [event.kind, event.n]);

  return { hero, rival };
}

// ---------------------------------------------------------------------------
// Escenario raíz (export por defecto para lazy()).
// ---------------------------------------------------------------------------
export default function BattleStage3D({ variant, classId, heroColor, event }: BattleStage3DProps) {
  const cfg = STAGE_CFG[variant];
  const look = useMemo(() => getHeroLook(classId), [classId]);
  const heroHex = useMemo(() => cssColorToHex(heroColor), [heroColor]);
  // Fase 7 (Cine Pass): tier de calidad; el fondo de batalla capa su dpr a 1.5.
  const tier = useQualityTier();
  const dpr = useMemo<[number, number]>(() => {
    const [min, max] = getTierDpr(tier);
    return [min, Math.min(max, 1.5)];
  }, [tier]);

  const enemyFx = useRef<EnemyFx>(createEnemyFx());
  const shakeRef = useRef(0);
  const heroRig = useRef<THREE.Group>(null);
  // El héroe mira SIEMPRE al enemigo (de espaldas a cámara).
  const facingRef = useRef(Math.atan2(cfg.enemyPos[0] - HERO_POS[0], cfg.enemyPos[2] - HERO_POS[2]));
  // Poses del rig animado, sincronizadas con los tiempos del VFX.
  const { hero: heroPose, rival: rivalPose } = useStagePoses(event);

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: cfg.cam, fov: 50 }}
      // El AA lo pone el composer (SMAA/FXAA): el del canvas sobraría.
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={[cfg.bg]} />
      <fog attach="fog" args={[cfg.bg, 16, 58]} />

      {/* Luz de luna fría + rebote + CONTRALUCES (Cine Pass): el rim de
          cfg.rim recorta al enemigo con fuerza y un segundo rim bajo recorta
          la espalda del héroe en primer término (canon del vídeo). */}
      <ambientLight color={variant === "boss" ? "#5a4a78" : "#56648a"} intensity={0.66} />
      <hemisphereLight color="#7a8fb8" groundColor="#2a2438" intensity={0.62} />
      <directionalLight position={[-6, 11, 9]} intensity={1.15} color="#9fc3ee" />
      <directionalLight position={[4, 7, -12]} intensity={1.25} color={cfg.rim} />
      <directionalLight position={[-5, 5, -9]} intensity={0.6} color={cfg.rim} />

      <Suspense fallback={null}>
        <RuinsArena variant={variant} />

        {/* Héroe de espaldas, primer término inferior-izquierda.
            StageActor: rig animado (Adventurer) si existe; HeroModel si no. */}
        <group ref={heroRig} position={[HERO_POS[0], HERO_HIP_Y, HERO_POS[2]]} scale={HERO_SCALE}>
          <StageActor
            variant="hero"
            classId={classId}
            bodyColor={heroHex}
            accent={look.accent}
            look={look}
            pose={heroPose.pose}
            poseN={heroPose.n}
            facingRef={facingRef}
          />
        </group>

        {/* Enemigo al fondo centro */}
        <group position={cfg.enemyPos}>
          {variant === "boss" ? (
            <VoidColossus fxRef={enemyFx} />
          ) : variant === "runas" ? (
            <RuneWard fxRef={enemyFx} />
          ) : variant === "horda" ? (
            <HordeShades fxRef={enemyFx} />
          ) : (
            <RivalEnemy fxRef={enemyFx} pose={rivalPose.pose} poseN={rivalPose.n} />
          )}
        </group>

        {/* Director de efectos (hechizo, pulso, victoria, derrota) */}
        <BattleVFX
          variant={variant}
          eventKind={event.kind}
          eventN={event.n}
          enemyFx={enemyFx}
          shakeRef={shakeRef}
          heroRigRef={heroRig}
        />

        {/* Fase 7 — composer cinematográfico compartido (variant "battle"):
            AO + DoF marcado al núcleo del enemigo + Bloom (emisivos ≥1.2; el
            Vacío ~0.6 queda sordo) + gradación al póster + viñeta fuerte. */}
        <CinematicEffects tier={tier} variant="battle" focusPoint={cfg.core} />
      </Suspense>

      <CameraRig variant={variant} shakeRef={shakeRef} />
      <VisibilityFrameDriver />
    </Canvas>
  );
}
