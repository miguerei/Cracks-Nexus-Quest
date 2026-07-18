// battle3d/RuinsArena.tsx — plaza de ruinas del combate.
//
// Decorado 100% procedural y determinista (mulberry32, Art Bible §9):
// suelo de losas de piedra antigua, arcos con musgo y runas azules,
// cristales emisivos, niebla en capas y siluetas lejanas. Sin sombras ni
// luces propias: este canvas es un FONDO del reto, no el mundo jugable.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mulberry32 } from "./battleUtils";
import { STAGE_CFG } from "./stageConfig";
import type { StageVariant } from "./types";

const RUNA_AZUL = "#38bdf8";
const PIEDRA = "#5f6455";
const MUSGO = "#3f6d46";

/** Arco de piedra en ruinas: dos pilares + dintel, musgo y runas azules. */
function ArcoRuina({
  position,
  rotY = 0,
  h = 4.6,
  w = 3.4,
  caido = false,
}: {
  position: [number, number, number];
  rotY?: number;
  h?: number;
  w?: number;
  caido?: boolean;
}) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Pilares */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2), 0, 0]}>
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[0.85, h, 0.95]} />
            <meshStandardMaterial color={PIEDRA} flatShading roughness={0.95} />
          </mesh>
          {/* Capitel */}
          <mesh position={[0, h + 0.12, 0]}>
            <boxGeometry args={[1.1, 0.3, 1.15]} />
            <meshStandardMaterial color="#6b7060" flatShading roughness={0.95} />
          </mesh>
          {/* Musgo en la cara superior */}
          <mesh position={[0, h + 0.3, 0]}>
            <boxGeometry args={[0.9, 0.14, 0.9]} />
            <meshStandardMaterial color={MUSGO} flatShading roughness={1} />
          </mesh>
          {/* Runas azules grabadas (cara frontal) */}
          {[1.1, 2, 2.9].map((ry) => (
            <mesh key={ry} position={[0, ry, 0.49]}>
              <planeGeometry args={[0.3, 0.42]} />
              <meshStandardMaterial
                color="#0b2038"
                emissive={RUNA_AZUL}
                emissiveIntensity={1.35}
                transparent
                opacity={0.9}
              />
            </mesh>
          ))}
        </group>
      ))}
      {/* Dintel (entero o roto) */}
      {caido ? (
        <mesh position={[w * 0.22, h + 0.65, 0]} rotation={[0, 0, 0.28]}>
          <boxGeometry args={[w * 0.7, 0.7, 1]} />
          <meshStandardMaterial color={PIEDRA} flatShading roughness={0.95} />
        </mesh>
      ) : (
        <>
          <mesh position={[0, h + 0.75, 0]}>
            <boxGeometry args={[w + 1.3, 0.75, 1.05]} />
            <meshStandardMaterial color={PIEDRA} flatShading roughness={0.95} />
          </mesh>
          <mesh position={[0, h + 1.2, 0]}>
            <boxGeometry args={[w * 0.7, 0.2, 0.9]} />
            <meshStandardMaterial color={MUSGO} flatShading roughness={1} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** Cristal luminoso clavado en el suelo. */
function Cristal({ position, tilt, scale }: { position: [number, number, number]; tilt: number; scale: number }) {
  return (
    <mesh position={position} rotation={[tilt, tilt * 2.3, tilt * 0.6]} scale={scale}>
      <octahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial
        color="#123a5e"
        emissive={RUNA_AZUL}
        emissiveIntensity={1.5}
        roughness={0.15}
        metalness={0.2}
        flatShading
      />
    </mesh>
  );
}

export default function RuinsArena({ variant }: { variant: StageVariant }) {
  const cfg = STAGE_CFG[variant];
  const esBoss = variant === "boss";

  // ---- Losas del suelo (instanciadas, jitter determinista) ----
  const losas = useMemo(() => {
    const rnd = mulberry32(20260717);
    const out: THREE.Matrix4[] = [];
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    for (let x = -9; x <= 9; x += 1.8) {
      for (let z = -13; z <= 7; z += 1.8) {
        if (rnd() < 0.16) continue; // losas arrancadas: plaza en ruinas
        p.set(x + (rnd() - 0.5) * 0.3, -0.03 + rnd() * 0.06, z + (rnd() - 0.5) * 0.3);
        e.set((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.14, (rnd() - 0.5) * 0.05);
        s.set(0.9 + rnd() * 0.18, 1, 0.9 + rnd() * 0.18);
        out.push(new THREE.Matrix4().compose(p, q.setFromEuler(e), s));
      }
    }
    return out;
  }, []);
  const losasRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = losasRef.current;
    if (!m) return;
    losas.forEach((mat, i) => m.setMatrixAt(i, mat));
    m.instanceMatrix.needsUpdate = true;
  }, [losas]);

  // ---- Runas sueltas en el suelo (camino de energía hacia el enemigo) ----
  const runas = useMemo(() => {
    const rnd = mulberry32(777001);
    return Array.from({ length: 9 }, (_, i) => ({
      x: (rnd() - 0.5) * 9 + (i % 2 ? 1.4 : -1),
      z: 4.5 - i * 1.9 + (rnd() - 0.5) * 1.2,
      r: rnd() * Math.PI,
      s: 0.5 + rnd() * 0.45,
    }));
  }, []);

  // ---- Siluetas lejanas (torres rotas tras la niebla) ----
  const siluetas = useMemo(() => {
    const rnd = mulberry32(31415);
    return Array.from({ length: 7 }, (_, i) => ({
      x: -24 + i * 8 + (rnd() - 0.5) * 5,
      z: -22 - rnd() * 9,
      h: 6 + rnd() * 9,
      w: 2 + rnd() * 2.4,
    }));
  }, []);

  const ez = cfg.enemyPos[2];

  return (
    <group>
      {/* Suelo base bajo las losas */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, -4]}>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color={esBoss ? "#332c3e" : "#3d4238"} roughness={1} />
      </mesh>

      {/* Losas de piedra */}
      <instancedMesh ref={losasRef} args={[undefined, undefined, losas.length]}>
        <boxGeometry args={[1.7, 0.14, 1.7]} />
        <meshStandardMaterial color="#575c4f" flatShading roughness={0.95} />
      </instancedMesh>

      {/* Runas de energía en el suelo */}
      {runas.map((r, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, r.r]} position={[r.x, 0.06, r.z]} scale={r.s}>
          <ringGeometry args={[0.32, 0.44, 6]} />
          <meshStandardMaterial
            color="#0b2038"
            emissive={RUNA_AZUL}
            emissiveIntensity={1.3}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Círculo rúnico bajo el enemigo (el altar del encuentro) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cfg.enemyPos[0], 0.05, ez]}>
        <ringGeometry args={[2.5, 3, 40]} />
        <meshStandardMaterial
          color="#160b24"
          emissive={cfg.rim}
          emissiveIntensity={esBoss ? 0.6 : 1.25}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Arcos de piedra (2-3, enmarcan al enemigo) */}
      <ArcoRuina position={[-6.4, 0, -3.2]} rotY={0.35} />
      <ArcoRuina position={[6.6, 0, -5]} rotY={-0.4} h={4.1} caido />
      <ArcoRuina position={[0.4, 0, ez - 3.4]} rotY={0.05} h={5.4} w={4.6} />

      {/* Columna caída (medio enterrada) */}
      <mesh position={[4.6, 0.28, 2.6]} rotation={[0, 0.5, Math.PI / 2 - 0.12]}>
        <cylinderGeometry args={[0.42, 0.46, 4.6, 8]} />
        <meshStandardMaterial color={PIEDRA} flatShading roughness={0.95} />
      </mesh>

      {/* Cristales luminosos en los márgenes */}
      <Cristal position={[-7.8, 0.4, 0.8]} tilt={0.35} scale={1.1} />
      <Cristal position={[8.6, 0.3, -1.6]} tilt={-0.5} scale={0.8} />
      <Cristal position={[-5.2, 0.35, -9]} tilt={0.2} scale={0.9} />
      <Cristal position={[7.4, 0.3, 3.4]} tilt={-0.25} scale={0.7} />

      {/* Contraluz de la escena: halo tras el enemigo (recorta la silueta) */}
      <mesh position={[cfg.enemyPos[0], esBoss ? 5 : 3.4, ez - 8]}>
        <circleGeometry args={[esBoss ? 8 : 6, 40]} />
        <meshBasicMaterial color={cfg.rim} transparent opacity={esBoss ? 0.14 : 0.11} depthWrite={false} />
      </mesh>

      {/* Niebla en capas (billboards translúcidos) */}
      {[
        { z: -2.5, y: 1.6, o: 0.07, w: 34, h: 4.5 },
        { z: -6.5, y: 2.2, o: 0.11, w: 36, h: 6 },
        { z: -12.5, y: 3, o: 0.17, w: 44, h: 9 },
      ].map((f, i) => (
        <mesh key={i} position={[0, f.y, f.z]}>
          <planeGeometry args={[f.w, f.h]} />
          <meshBasicMaterial
            color={esBoss ? "#2a1440" : "#1c2340"}
            transparent
            opacity={f.o}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Siluetas de torres rotas al fondo */}
      {siluetas.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]}>
          <mesh position={[0, s.h / 2, 0]}>
            <boxGeometry args={[s.w, s.h, s.w]} />
            <meshStandardMaterial color={esBoss ? "#170f26" : "#121628"} flatShading roughness={1} />
          </mesh>
          <mesh position={[0, s.h + 0.6, 0]} rotation={[0, 0.7, 0.2]}>
            <coneGeometry args={[s.w * 0.55, 1.6, 4]} />
            <meshStandardMaterial color={esBoss ? "#170f26" : "#121628"} flatShading roughness={1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
