// battle3d/enemies.tsx — los adversarios del encuentro.
//
// RivalEnemy (reto.duelo): humanoide de silueta oscura con acentos rosa
// #f472b6 sobre una plataforma de piedra.
// VoidColossus (reto.boss): Coloso del Vacío (Art Bible §6) — obsidiana
// angulosa negro-violeta, cuernos, hombreras de púas, NÚCLEO octaédrico
// violeta pulsante en el pecho y RETÍCULA cian de fijado sobre el núcleo.
//
// Ambos leen un ref compartido (EnemyFx) que escribe el director de VFX:
// nada de setState por frame; todo por refs en useFrame.

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HeroModel } from "./heroLink";
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
// Rival del duelo: HeroModel oscuro con acentos rosa, plantado en plataforma.
// ---------------------------------------------------------------------------
export function RivalEnemy({ fxRef }: { fxRef: MutableRefObject<EnemyFx> }) {
  const root = useRef<THREE.Group>(null);
  const speedRef = useRef(0);
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
        <HeroModel
          bodyColor="#241b2e"
          accent={ROSA_RIVAL}
          look={RIVAL_BATTLE_LOOK}
          variant="rival"
          speedRef={speedRef}
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
