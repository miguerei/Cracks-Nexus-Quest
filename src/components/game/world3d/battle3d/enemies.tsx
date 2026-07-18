// battle3d/enemies.tsx — los adversarios del encuentro.
//
// RivalEnemy (duelo/cartas): humanoide de silueta oscura con acentos rosa
// #f472b6 sobre una plataforma de piedra (StageActor: rig animado si existe).
// VoidColossus (boss): Coloso del Vacío (Art Bible §6) — obsidiana angulosa
// negro-violeta, cuernos, hombreras de púas, NÚCLEO octaédrico violeta
// pulsante en el pecho y RETÍCULA cian de fijado sobre el núcleo.
// RuneWard (puzzle): Guardián Rúnico — monolito sellado, tono sereno.
// HordeShades (arena): Sombras del Vacío — 1 principal + 2 menores al fondo.
//
// Todos leen un ref compartido (EnemyFx) que escribe el director de VFX:
// nada de setState por frame; todo por refs en useFrame.

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { StageActor, type StagePose } from "./stageActors";
import { mulberry32 } from "./battleUtils";
import type { HeroLook } from "../worldConfig";

/** Canal de efectos que el director de VFX escribe y el enemigo interpreta. */
export type EnemyFx = {
  /** Impulso de retroceso al recibir un impacto (1 → decae a 0). */
  recoil: number;
  /** Parpadeo blanco/violeta del impacto (1 → decae a 0). */
  flash: number;
  /** Encendido extra del núcleo al preparar el pulso del Vacío (fallo). */
  coreBoost: number;
  /** Victoria: 0..1, el enemigo se disuelve en partículas ascendentes. */
  dissolve: number;
  /** Derrota serena: 0..1, el enemigo se desvanece en niebla. */
  fade: number;
};

export function createEnemyFx(): EnemyFx {
  return { recoil: 0, flash: 0, coreBoost: 0, dissolve: 0, fade: 0 };
}

const ROSA_RIVAL = "#f472b6";
const OBSIDIANA = "#1a1028";
const OBSIDIANA_CLARA = "#241535";
const VIOLETA = "#a855f7";
const VIOLETA_PROFUNDO = "#7c3aed";
const CIAN_HOLO = "#7dd3fc";

const RIVAL_BATTLE_LOOK: HeroLook = { accent: ROSA_RIVAL, detail: "capa", emblem: "🤺", label: "Rival" };

// ---------------------------------------------------------------------------
// Rival del duelo: humanoide oscuro con acentos rosa, plantado en plataforma.
// StageActor: usa el rig animado (Adventurer) si characters3d ya existe y
// encaja la pose "hit" al recibir hechizos; si no, HeroModel procedural.
// ---------------------------------------------------------------------------
export function RivalEnemy({
  fxRef,
  pose = "idle",
  poseN = 0,
}: {
  fxRef: MutableRefObject<EnemyFx>;
  /** Pose animada del rival (la sincroniza el director de poses del stage). */
  pose?: StagePose;
  poseN?: number;
}) {
  const root = useRef<THREE.Group>(null);
  // Mira hacia el héroe (sur-oeste desde su posición).
  const facingRef = useRef(-0.25);
  const ALTURA_CADERA = 0.5 + 0.86 * 1.05; // plataforma + cadera del modelo escalado

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const fx = fxRef.current;
    // Retrocede y se encoge al encajar el hechizo; se disuelve en la victoria.
    g.position.z = -fx.recoil * 0.55;
    g.position.y = ALTURA_CADERA + fx.dissolve * 0.9 - fx.fade * 0.4;
    g.rotation.x = -fx.recoil * 0.12;
    g.rotation.y = fx.dissolve * 1.6;
    const s = Math.max(0.001, (1 - fx.dissolve) * (1 - fx.fade));
    g.scale.setScalar(1.05 * s);
  });

  return (
    <group>
      {/* Plataforma de piedra del retador */}
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[1.85, 2.2, 0.52, 8]} />
        <meshStandardMaterial color="#565b4e" flatShading roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.54, 0]}>
        <ringGeometry args={[1.15, 1.45, 28]} />
        <meshStandardMaterial
          color="#2b1220"
          emissive={ROSA_RIVAL}
          emissiveIntensity={1.3}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* El rival (silueta oscura, acentos rosa) */}
      <group ref={root} position={[0, ALTURA_CADERA, 0]}>
        <StageActor
          variant="rival"
          bodyColor="#241b2e"
          accent={ROSA_RIVAL}
          look={RIVAL_BATTLE_LOOK}
          pose={pose}
          poseN={poseN}
          facingRef={facingRef}
        />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Coloso del Vacío (§6). Flota y late lentamente; su núcleo pulsa al ritmo
// de amenaza (emisivos del Vacío ~0.6: brillo sordo, no alegre).
// ---------------------------------------------------------------------------
export function VoidColossus({ fxRef }: { fxRef: MutableRefObject<EnemyFx> }) {
  const root = useRef<THREE.Group>(null);
  const coreMesh = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const reticle = useRef<THREE.Group>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);

  // Materiales compartidos (mutados por refs en useFrame, jamás por estado).
  const mats = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({
      color: OBSIDIANA,
      emissive: VIOLETA_PROFUNDO,
      emissiveIntensity: 0.1,
      flatShading: true,
      roughness: 0.85,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: OBSIDIANA_CLARA,
      emissive: VIOLETA_PROFUNDO,
      emissiveIntensity: 0.06,
      flatShading: true,
      roughness: 0.9,
    });
    const core = new THREE.MeshStandardMaterial({
      color: "#3b1d5e",
      emissive: VIOLETA,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      flatShading: true,
    });
    const eye = new THREE.MeshStandardMaterial({ color: "#12081f", emissive: VIOLETA, emissiveIntensity: 0.85 });
    const fog = new THREE.MeshBasicMaterial({
      color: "#2a1440",
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const reticleMat = new THREE.MeshStandardMaterial({
      color: "#062033",
      emissive: CIAN_HOLO,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return { body, dark, core, eye, fog, reticleMat };
  }, []);
  useEffect(() => {
    return () => {
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [mats]);

  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const fx = fxRef.current;
    const t = state.clock.elapsedTime;

    // Flota y late lentamente (§7); sube al disolverse, se hunde al desvanecerse.
    g.position.y = 0.45 + Math.sin(t * 0.7) * 0.3 + fx.dissolve * 1.7 - fx.fade * 1.1;
    g.position.z = -fx.recoil * 0.8;
    g.rotation.x = -fx.recoil * 0.08 + Math.sin(t * 0.5) * 0.015;
    g.rotation.y = Math.sin(t * 0.21) * 0.06 + fx.dissolve * 1.4;
    const s = Math.max(0.001, (1 - fx.dissolve) * (1 - fx.fade * 0.35));
    g.scale.setScalar(s);

    // Núcleo: latido de amenaza + sobrecarga en el fallo + fogonazo al impacto.
    mats.core.emissiveIntensity = 0.55 + Math.sin(t * 2.1) * 0.15 + fx.coreBoost * 0.7 + fx.flash * 0.9;
    mats.eye.emissiveIntensity = 0.8 + fx.coreBoost * 0.6 + fx.flash * 1;
    mats.body.emissiveIntensity = 0.1 + fx.flash * 0.5;
    // La niebla lo envuelve en la derrota (tono sereno, sin castigo).
    mats.fog.opacity = Math.max(0, 0.16 + fx.fade * 0.55 - fx.dissolve * 0.16);

    if (coreMesh.current) {
      const cs = 1 + Math.sin(t * 2.1) * 0.07 + fx.coreBoost * 0.3;
      coreMesh.current.scale.setScalar(cs);
      coreMesh.current.rotation.y = t * 0.6;
    }
    // Brazos colgantes con vaivén pesado.
    if (armL.current) armL.current.rotation.x = Math.sin(t * 0.8) * 0.06;
    if (armR.current) armR.current.rotation.x = Math.sin(t * 0.8 + 1.4) * 0.06;

    // Retícula de fijado: gira despacio, late, y se apaga con el enemigo.
    if (reticle.current) {
      const alive = Math.max(0.001, Math.min(1, 1 - Math.max(fx.dissolve, fx.fade) * 2.2));
      reticle.current.scale.setScalar(alive * (1 + Math.sin(t * 2) * 0.05));
    }
    if (ringA.current) ringA.current.rotation.z = t * 0.4;
    if (ringB.current) ringB.current.rotation.z = -t * 0.55;
  });

  return (
    <group ref={root}>
      {/* Torso masivo de obsidiana angulosa */}
      <mesh position={[0, 3.3, 0]} material={mats.body}>
        <boxGeometry args={[3.6, 3.2, 2]} />
      </mesh>
      {/* Placas pectorales anguladas */}
      <mesh position={[-1, 4.3, 0.85]} rotation={[0.15, 0, 0.3]} material={mats.dark}>
        <boxGeometry args={[1.9, 1.5, 0.5]} />
      </mesh>
      <mesh position={[1, 4.3, 0.85]} rotation={[0.15, 0, -0.3]} material={mats.dark}>
        <boxGeometry args={[1.9, 1.5, 0.5]} />
      </mesh>
      {/* Falda flotante (cono invertido: el coloso no toca el suelo) */}
      <mesh position={[0, 1.35, 0]} rotation={[Math.PI, 0, 0]} material={mats.dark}>
        <coneGeometry args={[2, 2.3, 6]} />
      </mesh>

      {/* Hombreras de púas */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 2.35, 4.75, 0]}>
          <mesh material={mats.dark}>
            <boxGeometry args={[1.55, 1.05, 1.5]} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh
              key={k}
              position={[sd * (0.25 + k * 0.28), 0.75 + k * 0.18, (k - 1) * 0.45]}
              rotation={[0, 0, sd * -(0.35 + k * 0.22)]}
              material={mats.body}
            >
              <coneGeometry args={[0.2, 1 + k * 0.25, 5]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Brazos colgantes con puños de obsidiana */}
      <group ref={armL} position={[-2.55, 4.35, 0]}>
        <mesh position={[0, -1.4, 0]} material={mats.body}>
          <boxGeometry args={[0.95, 2.7, 0.95]} />
        </mesh>
        <mesh position={[0, -3, 0]} material={mats.dark}>
          <boxGeometry args={[1.15, 0.9, 1.15]} />
        </mesh>
      </group>
      <group ref={armR} position={[2.55, 4.35, 0]}>
        <mesh position={[0, -1.4, 0]} material={mats.body}>
          <boxGeometry args={[0.95, 2.7, 0.95]} />
        </mesh>
        <mesh position={[0, -3, 0]} material={mats.dark}>
          <boxGeometry args={[1.15, 0.9, 1.15]} />
        </mesh>
      </group>

      {/* Cabeza con cuernos y ojos violeta */}
      <group position={[0, 5.75, 0]}>
        <mesh material={mats.body}>
          <boxGeometry args={[1.35, 1.2, 1.25]} />
        </mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * 0.62, 0.85, 0]} rotation={[0, 0, sd * -0.5]} material={mats.dark}>
            <coneGeometry args={[0.26, 1.5, 5]} />
          </mesh>
        ))}
        {[-1, 1].map((sd) => (
          <mesh key={`ojo${sd}`} position={[sd * 0.33, 0.08, 0.65]} material={mats.eye}>
            <boxGeometry args={[0.3, 0.11, 0.06]} />
          </mesh>
        ))}
      </group>

      {/* NÚCLEO violeta pulsante en el pecho (su punto débil) */}
      <mesh ref={coreMesh} position={[0, 3.3, 1.1]} material={mats.core}>
        <octahedronGeometry args={[0.6, 0]} />
      </mesh>
      <mesh position={[0, 3.3, 1.05]} rotation={[Math.PI / 2, 0, 0]} material={mats.dark}>
        <torusGeometry args={[0.78, 0.1, 6, 18]} />
      </mesh>

      {/* Aura de humo negro-violeta */}
      <mesh position={[0, 3.2, -0.6]} material={mats.fog}>
        <planeGeometry args={[8.5, 6.5]} />
      </mesh>
      <mesh position={[0.6, 4.4, -1.2]} rotation={[0, 0.3, 0]} material={mats.fog}>
        <planeGeometry args={[7, 5]} />
      </mesh>

      {/* RETÍCULA cian de fijado sobre el núcleo (anillos + cruz, §7) */}
      <group ref={reticle} position={[0, 3.3, 2.15]}>
        <mesh ref={ringA} material={mats.reticleMat}>
          <ringGeometry args={[0.95, 1.06, 40]} />
        </mesh>
        <mesh ref={ringB} material={mats.reticleMat}>
          <ringGeometry args={[0.55, 0.62, 32]} />
        </mesh>
        {/* Cruz de puntería */}
        {[0, 1, 2, 3].map((k) => {
          const a = (k * Math.PI) / 2;
          return (
            <mesh key={k} position={[Math.cos(a) * 1.24, Math.sin(a) * 1.24, 0]} rotation={[0, 0, a]} material={mats.reticleMat}>
              <planeGeometry args={[0.3, 0.05]} />
            </mesh>
          );
        })}
        <mesh material={mats.reticleMat}>
          <octahedronGeometry args={[0.07, 0]} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Retícula cian de fijado compacta (anillos + cruz, §7) para los enemigos
// menores. Comparte material con el resto del enemigo que la monta.
// ---------------------------------------------------------------------------
function Reticula({
  mat,
  position,
  radio = 0.72,
  groupRef,
}: {
  mat: THREE.Material;
  position: [number, number, number];
  radio?: number;
  groupRef: MutableRefObject<THREE.Group | null>;
}) {
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringA.current) ringA.current.rotation.z = t * 0.4;
    if (ringB.current) ringB.current.rotation.z = -t * 0.55;
  });
  return (
    <group ref={groupRef} position={position}>
      <mesh ref={ringA} material={mat}>
        <ringGeometry args={[radio, radio * 1.11, 36]} />
      </mesh>
      <mesh ref={ringB} material={mat}>
        <ringGeometry args={[radio * 0.56, radio * 0.63, 28]} />
      </mesh>
      {[0, 1, 2, 3].map((k) => {
        const a = (k * Math.PI) / 2;
        return (
          <mesh
            key={k}
            position={[Math.cos(a) * radio * 1.3, Math.sin(a) * radio * 1.3, 0]}
            rotation={[0, 0, a]}
            material={mat}
          >
            <planeGeometry args={[radio * 0.3, 0.045]} />
          </mesh>
        );
      })}
      <mesh material={mat}>
        <octahedronGeometry args={[0.06, 0]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Guardián Rúnico (reto.puzzle): monolito de obsidiana sellado que flota
// sereno sobre un anillo de menhires. Sus runas violetas laten despacio; el
// NÚCLEO engastado en el frontal es el punto de impacto de cada pareja
// correcta. Tono contemplativo: aquí se restaura, no se lucha.
// ---------------------------------------------------------------------------
export function RuneWard({ fxRef }: { fxRef: MutableRefObject<EnemyFx> }) {
  const root = useRef<THREE.Group>(null);
  const coreMesh = useRef<THREE.Mesh>(null);
  const reticle = useRef<THREE.Group>(null);
  const fragA = useRef<THREE.Mesh>(null);
  const fragB = useRef<THREE.Mesh>(null);

  const mats = useMemo(() => {
    const slab = new THREE.MeshStandardMaterial({
      color: OBSIDIANA,
      emissive: VIOLETA_PROFUNDO,
      emissiveIntensity: 0.08,
      flatShading: true,
      roughness: 0.85,
    });
    const runa = new THREE.MeshStandardMaterial({
      color: "#1c0f30",
      emissive: VIOLETA,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.92,
    });
    const core = new THREE.MeshStandardMaterial({
      color: "#3b1d5e",
      emissive: VIOLETA,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      flatShading: true,
    });
    const reticleMat = new THREE.MeshStandardMaterial({
      color: "#062033",
      emissive: CIAN_HOLO,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return { slab, runa, core, reticleMat };
  }, []);
  useEffect(() => {
    return () => {
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [mats]);

  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const fx = fxRef.current;
    const t = state.clock.elapsedTime;

    // Flota sereno; asciende al restaurarse (victoria), se hunde en la niebla.
    g.position.y = 1.55 + Math.sin(t * 0.6) * 0.16 + fx.dissolve * 1.6 - fx.fade * 0.9;
    g.position.z = -fx.recoil * 0.5;
    g.rotation.x = -fx.recoil * 0.1 + Math.sin(t * 0.45) * 0.012;
    g.rotation.y = Math.sin(t * 0.19) * 0.05 + fx.dissolve * 1.2;
    const s = Math.max(0.001, (1 - fx.dissolve) * (1 - fx.fade * 0.3));
    g.scale.setScalar(s);

    // Runas y núcleo: latido sordo del Vacío + sobrecarga (fallo) + fogonazo.
    mats.runa.emissiveIntensity = 0.45 + Math.sin(t * 1.6) * 0.12 + fx.coreBoost * 0.6 + fx.flash * 0.8;
    mats.core.emissiveIntensity = 0.55 + Math.sin(t * 2.1) * 0.15 + fx.coreBoost * 0.7 + fx.flash * 0.9;
    mats.slab.emissiveIntensity = 0.08 + fx.flash * 0.4;

    if (coreMesh.current) {
      coreMesh.current.scale.setScalar(1 + Math.sin(t * 2.1) * 0.07 + fx.coreBoost * 0.3);
      coreMesh.current.rotation.y = t * 0.6;
    }
    // Fragmentos orbitantes (determinismo total, solo tiempo).
    if (fragA.current) {
      fragA.current.position.set(Math.cos(t * 0.5) * 1.5, 1.35 + Math.sin(t * 0.9) * 0.15, Math.sin(t * 0.5) * 0.7);
      fragA.current.rotation.y = t * 0.8;
    }
    if (fragB.current) {
      fragB.current.position.set(Math.cos(t * 0.5 + Math.PI) * 1.35, -0.4 + Math.sin(t * 0.7 + 2) * 0.12, Math.sin(t * 0.5 + Math.PI) * 0.6);
      fragB.current.rotation.x = t * 0.6;
    }
    if (reticle.current) {
      const alive = Math.max(0.001, Math.min(1, 1 - Math.max(fx.dissolve, fx.fade) * 2.2));
      reticle.current.scale.setScalar(alive * (1 + Math.sin(t * 2) * 0.05));
    }
  });

  // Menhires del círculo (deterministas).
  const menhires = useMemo(() => {
    const rnd = mulberry32(70707);
    return Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 + 0.5;
      return {
        x: Math.cos(a) * 2.6,
        z: Math.sin(a) * 2.2,
        h: 0.9 + rnd() * 0.7,
        r: rnd() * 0.6,
      };
    });
  }, []);

  return (
    <group>
      {/* Círculo de menhires en el suelo */}
      {menhires.map((m, i) => (
        <mesh key={i} position={[m.x, m.h / 2, m.z]} rotation={[0, m.r, 0.05]}>
          <boxGeometry args={[0.42, m.h, 0.34]} />
          <meshStandardMaterial color="#565b4e" flatShading roughness={0.95} />
        </mesh>
      ))}

      {/* El monolito flotante */}
      <group ref={root} position={[0, 1.55, 0]}>
        <mesh material={mats.slab}>
          <boxGeometry args={[1.7, 3, 0.6]} />
        </mesh>
        {/* Remate superior angulado */}
        <mesh position={[0, 1.75, 0]} rotation={[0, Math.PI / 4, 0]} material={mats.slab}>
          <coneGeometry args={[1.05, 0.9, 4]} />
        </mesh>
        {/* Runas violetas grabadas en el frontal */}
        {[1.15, -0.55, -1.15].map((ry) => (
          <mesh key={ry} position={[0, ry, 0.32]} material={mats.runa}>
            <planeGeometry args={[0.44, 0.4]} />
          </mesh>
        ))}
        {[-0.55, 0.55].map((rx) => (
          <mesh key={`l${rx}`} position={[rx, 0.35, 0.32]} material={mats.runa}>
            <planeGeometry args={[0.3, 0.34]} />
          </mesh>
        ))}
        {/* NÚCLEO violeta engastado (punto de impacto: cfg.core) */}
        <mesh ref={coreMesh} position={[0, 0.4, 0.5]} material={mats.core}>
          <octahedronGeometry args={[0.42, 0]} />
        </mesh>
        <mesh position={[0, 0.4, 0.38]} rotation={[Math.PI / 2, 0, 0]} material={mats.slab}>
          <torusGeometry args={[0.56, 0.08, 6, 16]} />
        </mesh>
        {/* Fragmentos de piedra orbitando */}
        <mesh ref={fragA} material={mats.slab}>
          <boxGeometry args={[0.26, 0.34, 0.22]} />
        </mesh>
        <mesh ref={fragB} material={mats.slab}>
          <boxGeometry args={[0.2, 0.24, 0.18]} />
        </mesh>
        {/* Retícula cian sobre el núcleo */}
        <Reticula mat={mats.reticleMat} position={[0, 0.4, 1.15]} radio={0.68} groupRef={reticle} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Sombras del Vacío (reto.arena): espectros encapuchados que flotan y laten.
// La principal lleva el núcleo (objetivo de la retícula); las dos menores
// acompañan al fondo y encajan el retroceso amortiguado de cada oleada.
// ---------------------------------------------------------------------------
function SombraVacio({
  mats,
  conNucleo,
  coreRef,
}: {
  mats: { body: THREE.MeshStandardMaterial; eye: THREE.MeshStandardMaterial; core: THREE.MeshStandardMaterial };
  conNucleo: boolean;
  coreRef?: MutableRefObject<THREE.Mesh | null>;
}) {
  return (
    <group>
      {/* Cuerpo-capucha (cono) con jirones inferiores */}
      <mesh position={[0, 1, 0]} material={mats.body}>
        <coneGeometry args={[0.72, 2.1, 7]} />
      </mesh>
      {[-0.3, 0.14, 0.42].map((dx, i) => (
        <mesh key={i} position={[dx, 0.16 - i * 0.05, 0.12 * (i - 1)]} rotation={[0.25, 0, dx]} material={mats.body}>
          <coneGeometry args={[0.16, 0.55, 5]} />
        </mesh>
      ))}
      {/* Cabeza dentro de la capucha + ojos violeta */}
      <mesh position={[0, 1.62, 0.1]} material={mats.body}>
        <sphereGeometry args={[0.34, 10, 8]} />
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * 0.14, 1.66, 0.38]} material={mats.eye}>
          <boxGeometry args={[0.11, 0.05, 0.04]} />
        </mesh>
      ))}
      {/* Brazos-jirón laterales */}
      {[-1, 1].map((sd) => (
        <mesh key={`b${sd}`} position={[sd * 0.62, 1.02, 0.1]} rotation={[0, 0, sd * 0.9]} material={mats.body}>
          <coneGeometry args={[0.14, 0.8, 5]} />
        </mesh>
      ))}
      {/* Núcleo violeta en el pecho (solo la sombra principal) */}
      {conNucleo && (
        <mesh ref={coreRef} position={[0, 1.05, 0.48]} material={mats.core}>
          <octahedronGeometry args={[0.3, 0]} />
        </mesh>
      )}
    </group>
  );
}

export function HordeShades({ fxRef }: { fxRef: MutableRefObject<EnemyFx> }) {
  const main = useRef<THREE.Group>(null);
  const minorA = useRef<THREE.Group>(null);
  const minorB = useRef<THREE.Group>(null);
  const coreMesh = useRef<THREE.Mesh>(null);
  const reticle = useRef<THREE.Group>(null);

  const mats = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({
      color: OBSIDIANA,
      emissive: VIOLETA_PROFUNDO,
      emissiveIntensity: 0.1,
      flatShading: true,
      roughness: 0.9,
    });
    const eye = new THREE.MeshStandardMaterial({ color: "#12081f", emissive: VIOLETA, emissiveIntensity: 0.85 });
    const core = new THREE.MeshStandardMaterial({
      color: "#3b1d5e",
      emissive: VIOLETA,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      flatShading: true,
    });
    const reticleMat = new THREE.MeshStandardMaterial({
      color: "#062033",
      emissive: CIAN_HOLO,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return { body, eye, core, reticleMat };
  }, []);
  useEffect(() => {
    return () => {
      Object.values(mats).forEach((m) => m.dispose());
    };
  }, [mats]);

  useFrame((state) => {
    const fx = fxRef.current;
    const t = state.clock.elapsedTime;
    const s = Math.max(0.001, (1 - fx.dissolve) * (1 - fx.fade * 0.4));

    // Sombra principal: flota, retrocede al encajar la oleada, se disuelve.
    const g = main.current;
    if (g) {
      g.position.y = 0.42 + Math.sin(t * 0.9) * 0.14 + fx.dissolve * 1.4 - fx.fade * 0.7;
      g.position.z = -fx.recoil * 0.85;
      g.rotation.x = -fx.recoil * 0.14 + Math.sin(t * 0.5) * 0.02;
      g.rotation.y = Math.sin(t * 0.3) * 0.08 + fx.dissolve * 1.3;
      g.scale.setScalar(s);
    }
    // Sombras menores: bob desfasado y retroceso amortiguado (se encogen).
    const rA = minorA.current;
    if (rA) {
      rA.position.y = 0.3 + Math.sin(t * 0.8 + 1.7) * 0.12 - fx.fade * 0.5;
      rA.position.z = -1.9 - fx.recoil * 1.2;
      rA.scale.setScalar(0.62 * Math.max(0.001, s - fx.recoil * 0.12));
    }
    const rB = minorB.current;
    if (rB) {
      rB.position.y = 0.34 + Math.sin(t * 0.75 + 3.4) * 0.12 - fx.fade * 0.5;
      rB.position.z = -2.4 - fx.recoil * 1.05;
      rB.scale.setScalar(0.55 * Math.max(0.001, s - fx.recoil * 0.1));
    }

    // Latidos del Vacío: núcleo y ojos (sobrecarga al fallo, fogonazo al golpe).
    mats.core.emissiveIntensity = 0.55 + Math.sin(t * 2.1) * 0.15 + fx.coreBoost * 0.7 + fx.flash * 0.9;
    mats.eye.emissiveIntensity = 0.8 + fx.coreBoost * 0.6 + fx.flash * 1;
    mats.body.emissiveIntensity = 0.1 + fx.flash * 0.45;
    if (coreMesh.current) {
      coreMesh.current.scale.setScalar(1 + Math.sin(t * 2.1) * 0.07 + fx.coreBoost * 0.3);
      coreMesh.current.rotation.y = t * 0.6;
    }
    if (reticle.current) {
      const alive = Math.max(0.001, Math.min(1, 1 - Math.max(fx.dissolve, fx.fade) * 2.2));
      reticle.current.scale.setScalar(alive * (1 + Math.sin(t * 2) * 0.05));
    }
  });

  return (
    <group>
      {/* Sombra principal (lleva el núcleo y la retícula) */}
      <group ref={main} position={[0, 0.42, 0]}>
        <SombraVacio mats={mats} conNucleo coreRef={coreMesh} />
        <Reticula mat={mats.reticleMat} position={[0, 1.05, 1.1]} radio={0.6} groupRef={reticle} />
      </group>
      {/* Refuerzos menores al fondo, flanqueando */}
      <group ref={minorA} position={[-1.7, 0.3, -1.9]} rotation={[0, 0.35, 0]} scale={0.62}>
        <SombraVacio mats={mats} conNucleo={false} />
      </group>
      <group ref={minorB} position={[1.9, 0.34, -2.4]} rotation={[0, -0.3, 0]} scale={0.55}>
        <SombraVacio mats={mats} conNucleo={false} />
      </group>
    </group>
  );
}
