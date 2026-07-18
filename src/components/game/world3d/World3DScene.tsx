// Fase 4-B — Escena 3D en tercera persona con personaje elegible por clase.
//
// Este módulo importa three / R3F / rapier y SOLO debe montarse en el navegador
// (detrás de <ClientOnly> + lazy en World3DScreen). Nunca se importa en el grafo
// de SSR. Es presentacional: mueve al héroe, detecta proximidad y avisa al HUD;
// el gating y las recompensas viven fuera (service layer + guard + finish).
//
// Art pass AAA (Fase 4-B): el Bosque monta BosqueEnvironment (cielo, montañas,
// río, ruinas, fauna…), héroe estilizado con andar expresivo, Nova con
// comportamiento propio, iluminación cálida y Bloom real por postproceso.
//
// Fase 6: héroe, NPC y rival usan los modelos KayKit Adventurers (CC0) con
// esqueleto y clips reales vía <Adventurer> (characters3d.tsx). El HeroModel
// procedural sigue vivo como fallback automático de carga/error y como
// contrato para battle3d. Nova NO cambia: es canon propio del vídeo.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  CapsuleCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

import {
  INTERACT_REACH,
  REST_Y,
  getHeroLook,
  getWorldLayout,
  getWorld3DTheme,
  type HeroLook,
  type WorldLayout,
} from "./worldConfig";
import { getWorldEnvironment, getWorldAmbience } from "./environments";
import { Adventurer } from "./characters3d";

/** Estado de un nodo interactuable, tal y como lo consume la escena 3D. */
export type Scene3DNode = {
  id: string;
  type: "mission" | "npc" | "rival" | "portal" | "blocked";
  kind?: "duelo" | "puzzle" | "cartas" | "arena" | "boss";
  status?: "available" | "locked" | "completed";
  /** Posición en el terreno (x, z). */
  position: [number, number];
  label: string;
};

/** Puente de controles móviles: joystick + salto + lanzar. Compartido con el HUD DOM. */
export type World3DControls = {
  move: { x: number; y: number };
  jump: boolean;
  cast: boolean;
};

const SPEED = 6.2;
const JUMP_V = 7.6;
/** Duración (s) de la pose de lanzamiento del brazo tras cada disparo. */
const CAST_TIME = 0.3;

// ---------------------------------------------------------------------------
// HeroModel: humanoide low-poly estilizado, usado por el héroe, NPCs y rival.
// Fase 4-B: proporciones juveniles (cabeza grande, silueta clara), pelo, ojos
// con parpadeo, hombreras, botas, capa con vuelo y andar con personalidad
// (inclinación al correr, rebote, balanceo asimétrico).
// El origen del modelo está a la altura de la cadera; los pies quedan a -0.86.
// ---------------------------------------------------------------------------
type HeroVariant = "hero" | "npc" | "rival";

const HAIR: Record<HeroVariant, string> = { hero: "#4a3623", npc: "#2e5e7e", rival: "#6e2144" };

function HeroModel({
  bodyColor,
  accent,
  look,
  variant,
  speedRef,
  facingRef,
  classId,
  castTimeRef,
}: {
  bodyColor: string;
  accent: string;
  look: HeroLook;
  variant: HeroVariant;
  /** ref con la magnitud de velocidad horizontal (0..1). */
  speedRef?: React.MutableRefObject<number>;
  /** ref con el ángulo de rotación Y objetivo. */
  facingRef?: React.MutableRefObject<number>;
  /** Clase canónica del póster: monta la identidad §4 del Art Bible sobre la base. */
  classId?: string;
  /** ref con el tiempo restante (s) de la pose de lanzamiento (lo decrementa el modelo). */
  castTimeRef?: React.MutableRefObject<number>;
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const cape = useRef<THREE.Mesh>(null);
  const eyes = useRef<THREE.Group>(null);
  // Refs de props canónicos por clase (solo cobran vida si llega classId).
  const ponytail = useRef<THREE.Group>(null);
  const holoMat = useRef<THREE.MeshStandardMaterial>(null);
  const pageL = useRef<THREE.Group>(null);
  const pageR = useRef<THREE.Group>(null);
  const bookSparks = useRef<THREE.Group>(null);
  const fistL = useRef<THREE.Group>(null);
  const fistR = useRef<THREE.Group>(null);
  const dreads = useRef<THREE.Group>(null);
  const shieldCore = useRef<THREE.Mesh>(null);
  const phase = useMemo(() => (variant === "hero" ? 0 : variant === "npc" ? 1.7 : 3.1), [variant]);

  // Textura de "líneas de circuito" del panel holográfico del Estratega.
  // Canvas determinista (trazos fijos): nada de Math.random en construcción.
  const holoTex = useMemo(() => {
    if (classId !== "estratega") return null;
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "rgba(10, 32, 50, 0.82)";
    ctx.fillRect(0, 0, 96, 64);
    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = 2;
    // Pistas de circuito (segmentos fijos con codos a 90°).
    const runs: [number, number, number, number][] = [
      [8, 10, 58, 10],
      [58, 10, 58, 26],
      [58, 26, 88, 26],
      [8, 24, 32, 24],
      [32, 24, 32, 48],
      [32, 48, 70, 48],
      [12, 40, 22, 40],
      [70, 48, 70, 58],
    ];
    for (const [x1, y1, x2, y2] of runs) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    // Nodos ("soldaduras") al final de cada pista.
    ctx.fillStyle = "#eaf6ff";
    for (const [, , x2, y2] of runs) ctx.fillRect(x2 - 2, y2 - 2, 4, 4);
    return new THREE.CanvasTexture(c);
  }, [classId]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime + phase;
    const spd = speedRef?.current ?? 0;
    const walk = Math.min(1, spd);
    const stride = Math.sin(t * (5.5 + walk * 5.5));
    const swing = stride * (0.12 + walk * 1.05);
    if (leftArm.current) leftArm.current.rotation.x = swing;
    if (rightArm.current) rightArm.current.rotation.x = -swing * 0.92;
    if (leftLeg.current) leftLeg.current.rotation.x = -swing * 0.95;
    if (rightLeg.current) rightLeg.current.rotation.x = swing * 0.95;
    if (body.current) {
      // Rebote al caminar + respiración en reposo + inclinación hacia delante.
      const breath = Math.sin(t * 2.1) * 0.012;
      body.current.position.y = breath + walk * Math.abs(Math.sin(t * 11)) * 0.07;
      body.current.rotation.x = walk * 0.16;
      body.current.rotation.z = stride * walk * 0.04;
    }
    if (head.current) {
      head.current.rotation.z = Math.sin(t * 1.3) * 0.03 + stride * walk * 0.05;
      head.current.rotation.x = -walk * 0.1;
    }
    if (cape.current) {
      cape.current.rotation.x = 0.16 + walk * 0.6 + Math.sin(t * 3.2) * 0.05;
    }
    if (eyes.current) {
      // Parpadeo ocasional.
      const blink = t % 3.7 < 0.12 ? 0.12 : 1;
      eyes.current.scale.y = blink;
    }

    // --- Props canónicos por clase (§4 del Art Bible): idle vivo ---
    if (ponytail.current) {
      // Coleta encadenada del Estratega: el vaivén crece con la marcha.
      ponytail.current.rotation.x = -0.28 - walk * 0.35 + Math.sin(t * 2.6) * 0.06;
      ponytail.current.children.forEach((seg, i) => {
        seg.rotation.x = Math.sin(t * (3 + walk * 6) - i * 0.9) * (0.08 + walk * 0.16);
      });
    }
    if (holoMat.current) {
      // El panel holográfico parpadea sutilmente (flicker determinista).
      const flick = Math.sin(t * 9) * 0.25 + (Math.sin(t * 27.3) > 0.94 ? 0.55 : 0);
      holoMat.current.emissiveIntensity = 1.7 + flick;
      holoMat.current.opacity = 0.72 + flick * 0.08;
    }
    if (pageL.current && pageR.current) {
      // El libro del Sabio "pasa página" periódicamente (hoja derecha → izquierda).
      const cycle = (t % 3.2) / 3.2;
      const turn = cycle < 0.22 ? cycle / 0.22 : 0;
      pageR.current.rotation.y = -0.14 - turn * 2.85;
      pageL.current.rotation.y = 0.14 + Math.sin(t * 1.7) * 0.05;
    }
    if (bookSparks.current) {
      // Partículas que irradian del libro: ascienden en bucle determinista.
      bookSparks.current.children.forEach((p, i) => {
        const f = (t * 0.55 + i * 0.29) % 1;
        p.position.z = 0.05 + f * 0.45;
        p.scale.setScalar(0.45 + (1 - f) * 0.65);
      });
    }
    if (fistL.current || fistR.current) {
      // Rayos del Velocista: arcos con jitter de alta frecuencia por seno.
      for (const fist of [fistL.current, fistR.current]) {
        if (!fist) continue;
        fist.children.forEach((arc, i) => {
          arc.rotation.x = Math.sin(t * 37 + i * 2.1) * 0.7;
          arc.rotation.z = Math.cos(t * 41 + i * 1.3) * 0.7;
          arc.visible = Math.sin(t * 23 + i * 4.7) > -0.35;
          arc.scale.y = 0.7 + Math.abs(Math.sin(t * 31 + i * 1.9)) * 0.6;
        });
      }
    }
    if (dreads.current) {
      // Rastas del Constructor: física fake de seno, se mecen con la marcha.
      dreads.current.children.forEach((d, i) => {
        d.rotation.x = 0.12 + walk * 0.28 + Math.sin(t * (2.1 + walk * 6) + i * 1.1) * (0.06 + walk * 0.14);
        d.rotation.z = Math.sin(t * 1.7 + i * 0.8) * 0.05;
      });
    }
    if (shieldCore.current) {
      // El núcleo azul del escudo rúnico late.
      const beat = Math.sin(t * 2.6);
      (shieldCore.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + beat * 0.6;
      shieldCore.current.scale.setScalar(1 + beat * 0.08);
    }

    // Cast (§7): anticipación breve (retroceso) y proyección del brazo derecho
    // hacia delante durante ~0.3 s tras cada disparo.
    if (castTimeRef && castTimeRef.current > 0) {
      castTimeRef.current = Math.max(0, castTimeRef.current - dt);
      const k = castTimeRef.current / CAST_TIME; // 1 → 0 durante la pose
      if (rightArm.current) rightArm.current.rotation.x = k > 0.82 ? 0.55 : -1.5;
      if (body.current) body.current.rotation.x += k > 0.82 ? -0.08 : 0.05;
    }

    if (root.current && facingRef) {
      // Suaviza el giro hacia la dirección deseada.
      const target = facingRef.current;
      const cur = root.current.rotation.y;
      let delta = target - cur;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      root.current.rotation.y = cur + delta * Math.min(1, dt * 12);
    }
  });

  const skin = variant === "rival" ? "#f9c8d8" : variant === "npc" ? "#d8ecff" : "#f3d5b5";
  const hair = HAIR[variant];
  const pants = variant === "rival" ? "#3d1b2c" : "#2a2b3d";

  return (
    <group ref={root}>
      <group ref={body}>
        {/* Cintura + torso (más ancho arriba: silueta heroica juvenil) */}
        <mesh castShadow position={[0, 0.06, 0]}>
          <boxGeometry args={[0.46, 0.3, 0.3]} />
          <meshStandardMaterial color={bodyColor} roughness={0.6} metalness={0.1} />
        </mesh>
        <mesh castShadow position={[0, 0.4, 0]}>
          <boxGeometry args={[0.62, 0.5, 0.38]} />
          <meshStandardMaterial color={bodyColor} roughness={0.55} metalness={0.15} />
        </mesh>
        {/* Cinturón + emblema de pecho */}
        <mesh position={[0, -0.08, 0.16]}>
          <boxGeometry args={[0.5, 0.09, 0.03]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[0, 0.46, 0.2]}>
          <octahedronGeometry args={[0.07, 0]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} />
        </mesh>
        {/* Hombreras */}
        {[-1, 1].map((s) => (
          <mesh key={s} castShadow position={[s * 0.37, 0.6, 0]}>
            <sphereGeometry args={[0.13, 10, 8]} />
            <meshStandardMaterial color={accent} roughness={0.4} metalness={0.3} emissive={accent} emissiveIntensity={0.25} />
          </mesh>
        ))}
        {/* Cuello + cabeza */}
        <mesh castShadow position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.09, 0.12, 0.12, 10]} />
          <meshStandardMaterial color={skin} roughness={0.6} />
        </mesh>
        <group ref={head} position={[0, 1.02, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.28, 20, 18]} />
            <meshStandardMaterial color={skin} roughness={0.55} />
          </mesh>
          {/* Pelo: casquete + flequillo */}
          <mesh position={[0, 0.08, -0.03]} scale={[1.04, 0.86, 1.04]}>
            <sphereGeometry args={[0.285, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <meshStandardMaterial color={hair} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.16, 0.18]} rotation={[0.35, 0, 0]}>
            <boxGeometry args={[0.34, 0.1, 0.14]} />
            <meshStandardMaterial color={hair} roughness={0.8} />
          </mesh>
          {/* Ojos grandes (blanco + pupila) con parpadeo */}
          <group ref={eyes}>
            {[-0.095, 0.095].map((ex) => (
              <group key={ex} position={[ex, -0.01, 0.235]}>
                <mesh scale={[1, 1.4, 0.5]}>
                  <sphereGeometry args={[0.05, 10, 10]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.3} />
                </mesh>
                <mesh position={[0, 0, 0.03]} scale={[1, 1.5, 0.5]}>
                  <sphereGeometry args={[0.026, 8, 8]} />
                  <meshStandardMaterial color="#1a1a2e" roughness={0.3} />
                </mesh>
              </group>
            ))}
          </group>

          {/* Detalle por clase (en la cabeza) */}
          {look.detail === "capucha" && (
            <mesh castShadow position={[0, 0.1, -0.04]}>
              <coneGeometry args={[0.33, 0.52, 14]} />
              <meshStandardMaterial color={bodyColor} emissive={accent} emissiveIntensity={0.2} roughness={0.6} />
            </mesh>
          )}
          {look.detail === "visor" && (
            <mesh position={[0, 0.03, 0.24]}>
              <boxGeometry args={[0.4, 0.09, 0.03]} />
              <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} />
            </mesh>
          )}
          {look.detail === "banda" && (
            <mesh position={[0, 0.16, 0]} rotation={[0.12, 0, 0]}>
              <torusGeometry args={[0.28, 0.035, 8, 20]} />
              <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.1} />
            </mesh>
          )}

          {/* ---- Identidad canónica por clase (cabeza) ---- */}
          {classId === "explorador" && (
            <group position={[0, 0.2, 0.06]} rotation={[-0.32, 0, 0]}>
              {/* Gafas de aventurero EN LA FRENTE: correa + dos lentes. */}
              <mesh>
                <torusGeometry args={[0.285, 0.022, 8, 20]} />
                <meshStandardMaterial color="#7a5c3a" roughness={0.8} />
              </mesh>
              {[-0.1, 0.1].map((gx) => (
                <mesh key={gx} position={[gx, 0.02, 0.27]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
                  <meshStandardMaterial color="#5c452c" roughness={0.6} metalness={0.2} emissive="#38bdf8" emissiveIntensity={0.4} />
                </mesh>
              ))}
            </group>
          )}
          {classId === "estratega" && (
            <group ref={ponytail} position={[0, 0.14, -0.22]}>
              {/* Coleta azul larga: cápsulas encadenadas con vaivén al andar. */}
              {[0, 1, 2, 3].map((i) => (
                <group key={i} position={[0, -0.02 - i * 0.17, -0.05 - i * 0.05]}>
                  <mesh castShadow>
                    <capsuleGeometry args={[0.075 - i * 0.011, 0.14, 4, 8]} />
                    <meshStandardMaterial color="#3b82f6" roughness={0.6} />
                  </mesh>
                </group>
              ))}
              {/* Coletero dorado */}
              <mesh position={[0, 0.02, -0.03]}>
                <torusGeometry args={[0.08, 0.02, 6, 12]} />
                <meshStandardMaterial color="#f4c542" emissive="#f4c542" emissiveIntensity={0.5} metalness={0.5} />
              </mesh>
            </group>
          )}
          {classId === "sabio" && (
            <group position={[0, -0.01, 0.25]}>
              {/* Gafas redondas doradas (dos torus + puente). */}
              {[-0.095, 0.095].map((gx) => (
                <mesh key={gx} position={[gx, 0, 0]}>
                  <torusGeometry args={[0.068, 0.012, 6, 16]} />
                  <meshStandardMaterial color="#c99b3f" metalness={0.6} roughness={0.35} />
                </mesh>
              ))}
              <mesh position={[0, 0.015, 0]}>
                <boxGeometry args={[0.06, 0.012, 0.012]} />
                <meshStandardMaterial color="#c99b3f" metalness={0.6} roughness={0.35} />
              </mesh>
            </group>
          )}
          {classId === "velocista" && (
            <mesh position={[0, 0.1, 0]} rotation={[0.1, 0, 0]}>
              {/* Banda azul en la frente. */}
              <torusGeometry args={[0.29, 0.04, 8, 20]} />
              <meshStandardMaterial color="#2563b0" emissive="#38bdf8" emissiveIntensity={1.2} roughness={0.5} />
            </mesh>
          )}
          {classId === "constructor" && (
            <>
              {/* Gafas de soldador arriba: correa + lentes oscuras. */}
              <group position={[0, 0.22, 0.04]} rotation={[-0.5, 0, 0]}>
                <mesh>
                  <torusGeometry args={[0.28, 0.026, 8, 20]} />
                  <meshStandardMaterial color="#2a2b3d" roughness={0.7} />
                </mesh>
                {[-0.09, 0.09].map((gx) => (
                  <mesh key={gx} position={[gx, 0.02, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.075, 0.075, 0.06, 12]} />
                    <meshStandardMaterial color="#3c4048" roughness={0.4} metalness={0.5} emissive="#1a4d33" emissiveIntensity={0.35} />
                  </mesh>
                ))}
              </group>
              {/* Rastas colgando (pivot arriba, cuelgan con física fake). */}
              <group ref={dreads} position={[0, 0.1, 0]}>
                {[-0.22, -0.13, 0.13, 0.22, -0.18, 0.18].map((dx, i) => (
                  <group key={i} position={[dx, 0, i > 3 ? -0.2 : -0.14]}>
                    <mesh castShadow position={[0, -0.2, 0]}>
                      <cylinderGeometry args={[0.028, 0.022, 0.4, 6]} />
                      <meshStandardMaterial color="#2a1f14" roughness={0.9} />
                    </mesh>
                  </group>
                ))}
              </group>
            </>
          )}
        </group>

        {/* Capa (clase Estratega / rival) con vuelo */}
        {look.detail === "capa" && (
          <mesh ref={cape} castShadow position={[0, 0.62, -0.22]}>
            <planeGeometry args={[0.82, 1.15, 1, 4]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} roughness={0.75} side={THREE.DoubleSide} />
          </mesh>
        )}
        {look.detail === "aura" && (
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.7, 0]}>
            <torusGeometry args={[0.5, 0.045, 10, 28]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.3} />
          </mesh>
        )}

        {/* Brazos (pivot en el hombro) con guantes */}
        <group ref={leftArm} position={[-0.4, 0.56, 0]}>
          <mesh castShadow position={[0, -0.24, 0]}>
            <capsuleGeometry args={[0.09, 0.32, 6, 10]} />
            <meshStandardMaterial color={bodyColor} roughness={0.55} />
          </mesh>
          <mesh castShadow position={[0, -0.5, 0]}>
            <sphereGeometry args={[0.11, 10, 10]} />
            <meshStandardMaterial color={skin} roughness={0.6} />
          </mesh>
          {classId === "explorador" && (
            <mesh castShadow position={[0, -0.5, 0]}>
              {/* Guantelete azul emisivo (firma del Explorador). */}
              <boxGeometry args={[0.18, 0.2, 0.18]} />
              <meshStandardMaterial color="#1e3a6e" emissive="#38bdf8" emissiveIntensity={1.4} roughness={0.35} metalness={0.3} />
            </mesh>
          )}
          {classId === "estratega" && (
            <group position={[0, -0.58, 0.22]} rotation={[-0.5, 0, 0]}>
              {/* PANEL HOLOGRÁFICO cian flotando sobre la mano izquierda. */}
              <mesh>
                <planeGeometry args={[0.36, 0.25]} />
                <meshStandardMaterial
                  ref={holoMat}
                  map={holoTex ?? undefined}
                  color="#7dd3fc"
                  emissive="#7dd3fc"
                  emissiveMap={holoTex ?? undefined}
                  emissiveIntensity={1.7}
                  transparent
                  opacity={0.72}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
              {/* Marco inferior del panel */}
              <mesh position={[0, -0.14, 0]}>
                <boxGeometry args={[0.3, 0.015, 0.015]} />
                <meshStandardMaterial color="#7dd3fc" emissive="#7dd3fc" emissiveIntensity={1.6} />
              </mesh>
            </group>
          )}
          {classId === "sabio" && (
            <group position={[0, -0.55, 0.28]} rotation={[-Math.PI / 2 + 0.35, 0, 0]}>
              {/* LIBRO abierto flotando junto a la mano izquierda. */}
              <mesh castShadow>
                <boxGeometry args={[0.3, 0.22, 0.02]} />
                <meshStandardMaterial color="#1e3a6e" roughness={0.6} />
              </mesh>
              {/* Páginas: la derecha "pasa" periódicamente (rotación en el lomo). */}
              <group ref={pageL} position={[0, 0, 0.015]}>
                <mesh position={[-0.068, 0, 0]}>
                  <planeGeometry args={[0.13, 0.19]} />
                  <meshStandardMaterial color="#eaf6ff" emissive="#bfe3ff" emissiveIntensity={0.6} side={THREE.DoubleSide} />
                </mesh>
              </group>
              <group ref={pageR} position={[0, 0, 0.015]}>
                <mesh position={[0.068, 0, 0]}>
                  <planeGeometry args={[0.13, 0.19]} />
                  <meshStandardMaterial color="#eaf6ff" emissive="#bfe3ff" emissiveIntensity={0.6} side={THREE.DoubleSide} />
                </mesh>
              </group>
              {/* Partículas que irradian del libro (ascienden en bucle). */}
              <group ref={bookSparks}>
                {[-0.09, -0.03, 0.04, 0.1].map((px, i) => (
                  <mesh key={i} position={[px, (i % 2 === 0 ? -1 : 1) * 0.05, 0.1]}>
                    <octahedronGeometry args={[0.02, 0]} />
                    <meshStandardMaterial color="#eaf6ff" emissive="#7dd3fc" emissiveIntensity={2.2} />
                  </mesh>
                ))}
              </group>
            </group>
          )}
          {classId === "velocista" && (
            <group ref={fistL} position={[0, -0.5, 0]}>
              {/* Arcos eléctricos alrededor del puño izquierdo. */}
              {[0, 1, 2].map((i) => (
                <mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2) * 0.15, 0, Math.sin((i / 3) * Math.PI * 2) * 0.15]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.22, 4]} />
                  <meshStandardMaterial color="#bfe9ff" emissive="#38bdf8" emissiveIntensity={2.4} />
                </mesh>
              ))}
            </group>
          )}
        </group>
        <group ref={rightArm} position={[0.4, 0.56, 0]}>
          <mesh castShadow position={[0, -0.24, 0]}>
            <capsuleGeometry args={[0.09, 0.32, 6, 10]} />
            <meshStandardMaterial color={bodyColor} roughness={0.55} />
          </mesh>
          {/* Orbe de energía en la mano dominante */}
          <mesh castShadow position={[0, -0.5, 0]}>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={variant === "hero" ? 1.4 : 0.5} />
          </mesh>
          {classId === "sabio" && (
            <group position={[0, -0.5, 0.1]}>
              {/* BASTÓN del Sabio: madera + horquilla dorada + cristal octaédrico. */}
              <mesh castShadow position={[0, 0.25, 0]}>
                <cylinderGeometry args={[0.028, 0.035, 1.5, 8]} />
                <meshStandardMaterial color="#8a6a3f" roughness={0.8} />
              </mesh>
              {/* Horquilla dorada (dos púas inclinadas) */}
              {[-1, 1].map((s) => (
                <mesh key={s} position={[s * 0.07, 1.02, 0]} rotation={[0, 0, s * -0.4]}>
                  <coneGeometry args={[0.025, 0.18, 6]} />
                  <meshStandardMaterial color="#f4c542" emissive="#f4c542" emissiveIntensity={0.6} metalness={0.6} roughness={0.3} />
                </mesh>
              ))}
              <mesh position={[0, 1.1, 0]}>
                <octahedronGeometry args={[0.09, 0]} />
                <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={2} roughness={0.15} />
              </mesh>
            </group>
          )}
          {classId === "velocista" && (
            <group ref={fistR} position={[0, -0.5, 0]}>
              {/* Arcos eléctricos alrededor del puño derecho. */}
              {[0, 1, 2].map((i) => (
                <mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2 + 1) * 0.16, 0, Math.sin((i / 3) * Math.PI * 2 + 1) * 0.16]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.22, 4]} />
                  <meshStandardMaterial color="#bfe9ff" emissive="#38bdf8" emissiveIntensity={2.4} />
                </mesh>
              ))}
            </group>
          )}
          {classId === "constructor" && (
            <group position={[0, -0.42, 0]}>
              {/* Guantelete mecánico grande (metal + junta emisiva). */}
              <mesh castShadow>
                <boxGeometry args={[0.24, 0.3, 0.24]} />
                <meshStandardMaterial color="#8a8f9a" metalness={0.7} roughness={0.35} />
              </mesh>
              <mesh position={[0, -0.16, 0.02]}>
                <boxGeometry args={[0.2, 0.1, 0.2]} />
                <meshStandardMaterial color="#5b616e" metalness={0.7} roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.02, 0.125]}>
                <boxGeometry args={[0.16, 0.03, 0.01]} />
                <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.5} />
              </mesh>
            </group>
          )}
        </group>

        {/* Piernas (pivot en la cadera) con botas */}
        <group ref={leftLeg} position={[-0.15, -0.1, 0]}>
          <mesh castShadow position={[0, -0.32, 0]}>
            <capsuleGeometry args={[0.115, 0.38, 6, 10]} />
            <meshStandardMaterial color={pants} roughness={0.7} />
          </mesh>
          <mesh castShadow position={[0, -0.68, 0.05]}>
            <boxGeometry args={[0.24, 0.16, 0.36]} />
            <meshStandardMaterial color="#17172a" roughness={0.6} metalness={0.1} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.15, -0.1, 0]}>
          <mesh castShadow position={[0, -0.32, 0]}>
            <capsuleGeometry args={[0.115, 0.38, 6, 10]} />
            <meshStandardMaterial color={pants} roughness={0.7} />
          </mesh>
          <mesh castShadow position={[0, -0.68, 0.05]}>
            <boxGeometry args={[0.24, 0.16, 0.36]} />
            <meshStandardMaterial color="#17172a" roughness={0.6} metalness={0.1} />
          </mesh>
        </group>

        {/* ---- Identidad canónica por clase (torso/espalda) ---- */}
        {classId === "explorador" && (
          <>
            {/* Mochila marrón a la espalda + correas de cuero. */}
            <group position={[0, 0.38, -0.29]}>
              <mesh castShadow>
                <boxGeometry args={[0.4, 0.46, 0.2]} />
                <meshStandardMaterial color="#7a5c3a" roughness={0.85} />
              </mesh>
              <mesh position={[0, 0.26, 0]}>
                <boxGeometry args={[0.42, 0.12, 0.22]} />
                <meshStandardMaterial color="#5c452c" roughness={0.85} />
              </mesh>
            </group>
            {[-0.18, 0.18].map((sx) => (
              <mesh key={sx} position={[sx, 0.42, 0.19]} rotation={[0.1, 0, 0]}>
                <boxGeometry args={[0.07, 0.44, 0.02]} />
                <meshStandardMaterial color="#6b7a45" roughness={0.8} />
              </mesh>
            ))}
          </>
        )}
        {classId === "estratega" && (
          <>
            {/* Tabardo blanco con ribete dorado sobre el pecho (canon azul/blanco/dorado). */}
            <mesh position={[0, 0.36, 0.2]}>
              <boxGeometry args={[0.3, 0.52, 0.02]} />
              <meshStandardMaterial color="#e8ecf4" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.1, 0.21]}>
              <boxGeometry args={[0.32, 0.04, 0.02]} />
              <meshStandardMaterial color="#f4c542" emissive="#f4c542" emissiveIntensity={0.5} metalness={0.5} />
            </mesh>
            {/* Ribete dorado del cuello */}
            <mesh position={[0, 0.63, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.15, 0.022, 6, 16]} />
              <meshStandardMaterial color="#f4c542" emissive="#f4c542" emissiveIntensity={0.5} metalness={0.5} />
            </mesh>
          </>
        )}
        {classId === "sabio" && (
          <>
            {/* Faldón de túnica blanca/azul (cono truncado) con bajo azul. */}
            <mesh castShadow position={[0, -0.22, 0]}>
              <cylinderGeometry args={[0.3, 0.48, 0.55, 14]} />
              <meshStandardMaterial color="#eaf6ff" roughness={0.7} />
            </mesh>
            <mesh position={[0, -0.47, 0]}>
              <cylinderGeometry args={[0.47, 0.49, 0.08, 14]} />
              <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.35} roughness={0.6} />
            </mesh>
          </>
        )}
        {classId === "velocista" && (
          <>
            {/* Chaqueta azul eléctrico (sobre-torso) con cremallera. */}
            <mesh castShadow position={[0, 0.4, 0]}>
              <boxGeometry args={[0.66, 0.46, 0.42]} />
              <meshStandardMaterial color="#2563b0" roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.4, 0.22]}>
              <boxGeometry args={[0.03, 0.44, 0.01]} />
              <meshStandardMaterial color="#eaf6ff" emissive="#7dd3fc" emissiveIntensity={0.8} />
            </mesh>
            {/* Capucha caída sobre la nuca. */}
            <mesh castShadow position={[0, 0.66, -0.24]} rotation={[0.7, 0, 0]} scale={[1, 0.6, 1]}>
              <torusGeometry args={[0.17, 0.09, 8, 16]} />
              <meshStandardMaterial color="#2563b0" roughness={0.6} />
            </mesh>
          </>
        )}
        {classId === "constructor" && (
          <>
            {/* Peto amarillo/blanco (canon del póster). */}
            <mesh position={[0, 0.32, 0.2]}>
              <boxGeometry args={[0.44, 0.24, 0.02]} />
              <meshStandardMaterial color="#e8b13a" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.5, 0.2]}>
              <boxGeometry args={[0.44, 0.12, 0.02]} />
              <meshStandardMaterial color="#e8ecf4" roughness={0.6} />
            </mesh>
            {/* ESCUDO rúnico circular a la espalda: disco + anillo de runas + núcleo. */}
            <group position={[0, 0.38, -0.32]} rotation={[0.12, 0, 0]}>
              <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.44, 0.44, 0.06, 20]} />
                <meshStandardMaterial color="#57606e" metalness={0.6} roughness={0.4} />
              </mesh>
              <mesh position={[0, 0, -0.035]}>
                <torusGeometry args={[0.33, 0.02, 8, 24]} />
                <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.5} />
              </mesh>
              {/* Runas emisivas alrededor del anillo. */}
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i / 8) * Math.PI * 2;
                return (
                  <mesh key={i} position={[Math.cos(a) * 0.33, Math.sin(a) * 0.33, -0.045]}>
                    <boxGeometry args={[0.045, 0.045, 0.01]} />
                    <meshStandardMaterial color="#7dd3fc" emissive="#7dd3fc" emissiveIntensity={1.6} />
                  </mesh>
                );
              })}
              <mesh ref={shieldCore} position={[0, 0, -0.05]}>
                <sphereGeometry args={[0.1, 12, 12]} />
                <meshStandardMaterial color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={1.5} roughness={0.2} />
              </mesh>
            </group>
          </>
        )}

        {/* Luz de presencia del personaje */}
        <pointLight color={accent} intensity={variant === "hero" ? 3.5 : 1.8} distance={variant === "hero" ? 5 : 3.5} position={[0, 0.5, 0]} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// EnergyBolt: proyectil emisivo que dispara el héroe al "lanzar" (F/botón).
// Colisiona con nodos interactuables: al impactar registra un "hit" en el
// ref compartido para que el nodo reaccione (pulso/tembor) y se destruye.
// ---------------------------------------------------------------------------
type Bolt = { id: number; pos: THREE.Vector3; dir: THREE.Vector3; life: number; color: string };

function EnergyBolts({
  bolts,
  setBolts,
  nodes,
  hitsRef,
}: {
  bolts: Bolt[];
  setBolts: React.Dispatch<React.SetStateAction<Bolt[]>>;
  nodes: Scene3DNode[];
  hitsRef: React.MutableRefObject<Map<string, number>>;
}) {
  useFrame((_, dt) => {
    if (!bolts.length) return;
    setBolts((list) => {
      const next: Bolt[] = [];
      for (const b of list) {
        const life = b.life - dt;
        if (life <= 0) continue;
        const p = b.pos.clone().addScaledVector(b.dir, dt * 22);
        let consumed = false;
        for (const n of nodes) {
          if (n.type === "portal" || n.type === "blocked") continue;
          const dx = p.x - n.position[0];
          const dz = p.z - n.position[1];
          if (Math.hypot(dx, dz) < 1.4) {
            hitsRef.current.set(n.id, 0.55);
            consumed = true;
            break;
          }
        }
        if (consumed) continue;
        next.push({ ...b, pos: p, life });
      }
      return next;
    });
  });
  return (
    <>
      {bolts.map((b) => {
        // Giro determinista del cristal en función de su vida transcurrida.
        const roll = (0.9 - b.life) * 9;
        return (
          <group key={b.id}>
            {/* Proyectil: cristal octaédrico (§7) girando en vuelo. */}
            <group position={b.pos.toArray()} rotation={[roll, roll * 0.7, 0]}>
              <mesh>
                <octahedronGeometry args={[0.26, 0]} />
                <meshStandardMaterial color={b.color} emissive={b.color} emissiveIntensity={2.6} roughness={0.15} />
              </mesh>
              <pointLight color={b.color} intensity={6} distance={5} />
            </group>
            {/* Estela: esferitas emisivas decrecientes que siguen con retardo. */}
            {[1, 2, 3, 4].map((i) => {
              const trailPos = b.pos.clone().addScaledVector(b.dir, -i * 0.34);
              trailPos.y += Math.sin((0.9 - b.life) * 18 + i * 1.7) * 0.04;
              return (
                <mesh key={i} position={trailPos.toArray()} scale={1 - i * 0.19}>
                  <sphereGeometry args={[0.12, 8, 8]} />
                  <meshStandardMaterial
                    color={b.color}
                    emissive={b.color}
                    emissiveIntensity={2.2 - i * 0.4}
                    transparent
                    opacity={0.85 - i * 0.17}
                    depthWrite={false}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Héroe: cápsula con físicas + HeroModel visible por encima.
// ---------------------------------------------------------------------------
function Hero({
  heroColor,
  look,
  classId,
  spawn,
  posRef,
  controlsRef,
  nodes,
  paused,
  onActiveNodeChange,
  onInteract,
  onCast,
}: {
  heroColor: string;
  look: HeroLook;
  /** Clase canónica del jugador (identidad §4 sobre la base). */
  classId?: string;
  spawn: [number, number];
  posRef: React.MutableRefObject<THREE.Vector3>;
  controlsRef: React.MutableRefObject<World3DControls>;
  nodes: Scene3DNode[];
  paused: boolean;
  onActiveNodeChange: (id: string | null) => void;
  onInteract: (id: string) => void;
  onCast: (origin: THREE.Vector3, dir: THREE.Vector3) => void;
}) {
  const body = useRef<RapierRigidBody>(null);
  const keys = useRef({ up: false, down: false, left: false, right: false, jump: false, cast: false });
  const facing = useRef(0);
  const facingRef = useRef(0);
  const speedRef = useRef(0);
  const lastActive = useRef<string | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const castCooldown = useRef(0);
  // Tiempo restante de la pose de lanzamiento; el modelo lo consume y decrementa.
  const castTimeRef = useRef(0);
  // true mientras el héroe está en el aire (lo deriva el grounded de la física).
  const airborneRef = useRef(false);

  // Teclado.
  useEffect(() => {
    const setKey = (k: string, v: boolean) => {
      switch (k) {
        case "ArrowUp":
        case "w":
        case "W":
          keys.current.up = v;
          return true;
        case "ArrowDown":
        case "s":
        case "S":
          keys.current.down = v;
          return true;
        case "ArrowLeft":
        case "a":
        case "A":
          keys.current.left = v;
          return true;
        case "ArrowRight":
        case "d":
        case "D":
          keys.current.right = v;
          return true;
        case " ":
        case "Spacebar":
          keys.current.jump = v;
          return true;
      }
      return false;
    };
    const down = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      if (e.key === "e" || e.key === "E" || e.key === "Enter") {
        if (lastActive.current) {
          e.preventDefault();
          onInteract(lastActive.current);
        }
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        keys.current.cast = true;
        return;
      }
      if (setKey(e.key, true)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => setKey(e.key, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onInteract]);

  useFrame((_, dt) => {
    const b = body.current;
    if (!b) return;
    const t = b.translation();
    posRef.current.set(t.x, t.y, t.z);

    const c = controlsRef.current;
    const paused = pausedRef.current;

    let mx = paused ? 0 : (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0) + c.move.x;
    let mz = paused ? 0 : (keys.current.down ? 1 : 0) - (keys.current.up ? 1 : 0) + c.move.y;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
    }
    speedRef.current = Math.min(1, mag);

    const vel = b.linvel();
    b.setLinvel({ x: mx * SPEED, y: vel.y, z: mz * SPEED }, true);

    if (mag > 0.08) {
      facing.current = Math.atan2(mx, mz);
    }
    facingRef.current = facing.current;

    const grounded = t.y <= REST_Y + 0.14 && Math.abs(vel.y) < 2.2;
    airborneRef.current = !grounded;
    const wantJump = !paused && (keys.current.jump || c.jump);
    if (wantJump && grounded) {
      b.setLinvel({ x: mx * SPEED, y: JUMP_V, z: mz * SPEED }, true);
    }
    c.jump = false;

    // Cast: dispara un pulso de energía hacia la dirección de mira.
    castCooldown.current = Math.max(0, castCooldown.current - dt);
    const wantCast = !paused && (keys.current.cast || c.cast);
    keys.current.cast = false;
    c.cast = false;
    if (wantCast && castCooldown.current === 0) {
      castCooldown.current = 0.35;
      // Arma la pose de cast (§7): anticipación + brazo proyectado ~0.3 s.
      castTimeRef.current = CAST_TIME;
      const dir = new THREE.Vector3(Math.sin(facing.current), 0, Math.cos(facing.current));
      const origin = new THREE.Vector3(t.x + dir.x * 0.7, t.y + 0.4, t.z + dir.z * 0.7);
      onCast(origin, dir);
    }

    // Proximidad.
    let best: Scene3DNode | null = null;
    let bd = Infinity;
    for (const n of nodesRef.current) {
      const dx = t.x - n.position[0];
      const dz = t.z - n.position[1];
      const d = Math.hypot(dx, dz);
      if (d < INTERACT_REACH && d < bd) {
        bd = d;
        best = n;
      }
    }
    const id = best ? best.id : null;
    if (id !== lastActive.current) {
      lastActive.current = id;
      onActiveNodeChange(id);
    }
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      enabledRotations={[false, false, false]}
      position={[spawn[0], REST_Y, spawn[1]]}
      linearDamping={0.4}
      canSleep={false}
      type="dynamic"
    >
      <CapsuleCollider args={[0.6, 0.45]} />
      {/* Fase 6: aventurero KayKit animado. Su origen está en los PIES, así que
          baja al fondo de la cápsula (-1.05). El HeroModel procedural (origen
          en la CADERA, pies a -0.86) queda como fallback de carga y de error. */}
      <Suspense
        fallback={
          <group position={[0, -0.19, 0]}>
            <HeroModel
              bodyColor={heroColor}
              accent={look.accent}
              look={look}
              variant="hero"
              speedRef={speedRef}
              facingRef={facingRef}
              classId={classId}
              castTimeRef={castTimeRef}
            />
          </group>
        }
      >
        <group position={[0, -1.05, 0]}>
          <Adventurer
            mode="world"
            classId={classId}
            variant="hero"
            speedRef={speedRef}
            airborneRef={airborneRef}
            facingRef={facingRef}
            castTimeRef={castTimeRef}
            fallback={
              <group position={[0, 0.86, 0]}>
                <HeroModel
                  bodyColor={heroColor}
                  accent={look.accent}
                  look={look}
                  variant="hero"
                  speedRef={speedRef}
                  facingRef={facingRef}
                  classId={classId}
                  castTimeRef={castTimeRef}
                />
              </group>
            }
          />
        </group>
      </Suspense>
    </RigidBody>
  );
}

// ---------------------------------------------------------------------------
// VisibilityFrameDriver: si la pestaña está oculta, requestAnimationFrame no
// dispara y el mundo se congela en negro (pasa en previews embebidas). Este
// driver conmuta a frameloop manual y avanza la escena con un intervalo hasta
// que la pestaña vuelve a ser visible.
// ---------------------------------------------------------------------------
function VisibilityFrameDriver() {
  const advance = useThree((s) => s.advance);
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    let iv: number | null = null;
    const apply = () => {
      if (document.hidden) {
        setFrameloop("never");
        // advance() en modo "never" espera un timestamp en SEGUNDOS (unidades
        // de clock.elapsedTime). Pasar ms aquí produce deltas gigantes y la
        // física da pasos de miles de segundos (el héroe "se teletransporta").
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
// Cámara en tercera persona (más baja y cercana: encuadre cinematográfico).
// ---------------------------------------------------------------------------
function FollowCamera({ posRef, maxZ = Infinity }: { posRef: React.MutableRefObject<THREE.Vector3>; maxZ?: number }) {
  const { camera } = useThree();
  const desired = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    const p = posRef.current;
    // La cámara nunca sale del nivel (evita meterse en árboles/bermas del borde).
    desired.current.set(p.x, p.y + 7, Math.min(p.z + 10.2, maxZ));
    camera.position.lerp(desired.current, Math.min(1, dt * 4));
    look.current.set(p.x, p.y + 1.6, p.z);
    camera.lookAt(look.current);
  });
  return null;
}

// ---------------------------------------------------------------------------
// Nova companion — Fase 4-B: compañero con comportamiento. Sigue al héroe,
// se adelanta hacia los cristales activos, celebra cada misión completada,
// tiembla cerca del Vacío y siempre "mira" (cara orientada) a su objetivo.
// ---------------------------------------------------------------------------
function NovaCompanion({
  posRef,
  accent,
  nodes,
  activeId,
  doneCount,
  voidSpots,
  spawn,
}: {
  posRef: React.MutableRefObject<THREE.Vector3>;
  accent: string;
  nodes: Scene3DNode[];
  activeId: string | null;
  doneCount: number;
  voidSpots: [number, number][];
  spawn: [number, number];
}) {
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const sparkles = useRef<THREE.Group>(null);
  // Expresión física de la mascota (§5): voltereta, orejas y cola.
  const bodyG = useRef<THREE.Group>(null);
  const earL = useRef<THREE.Group>(null);
  const earR = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const cur = useRef(new THREE.Vector3(spawn[0] + 1.4, 2.4, spawn[1] + 1.4));
  const target = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());
  const celebrateUntil = useRef(-1);
  const prevDone = useRef(doneCount);

  // Cada misión completada dispara una celebración de ~2.4 s.
  useEffect(() => {
    if (doneCount > prevDone.current) celebrateUntil.current = -2; // señal: fijar en el próximo frame
    prevDone.current = doneCount;
  }, [doneCount]);

  useFrame((state, dt) => {
    if (!g.current) return;
    const t = state.clock.elapsedTime;
    if (celebrateUntil.current === -2) celebrateUntil.current = t + 2.4;
    const p = posRef.current;
    const bob = Math.sin(t * 2) * 0.15;

    const active = activeId ? nodes.find((n) => n.id === activeId) : null;
    const celebrating = t < celebrateUntil.current;

    // ¿Está el héroe cerca del Vacío? Nova se asusta.
    let scared = active?.type === "blocked";
    for (const [vx, vz] of voidSpots) {
      if (Math.hypot(p.x - vx, p.z - vz) < 7) scared = true;
    }

    if (celebrating) {
      // Órbita rápida alrededor del héroe.
      const a = t * 5;
      target.current.set(p.x + Math.cos(a) * 1.3, p.y + 2.2 + Math.sin(t * 9) * 0.35, p.z + Math.sin(a) * 1.3);
    } else if (scared) {
      // Se esconde tras el héroe (lado sur) y tiembla.
      target.current.set(
        p.x + 0.7 + Math.sin(t * 30) * 0.06,
        p.y + 1.7 + Math.sin(t * 26) * 0.07,
        p.z + 1.9 + Math.cos(t * 28) * 0.06,
      );
    } else if (active && active.type === "mission" && active.status !== "locked") {
      // Se adelanta hacia el cristal, a medio camino entre héroe y nodo.
      target.current.set(
        active.position[0] * 0.6 + p.x * 0.4,
        2 + bob,
        active.position[1] * 0.6 + p.z * 0.4,
      );
    } else {
      target.current.set(p.x + 1.6, p.y + 2.3 + bob, p.z + 1.6);
    }

    cur.current.lerp(target.current, Math.min(1, dt * (celebrating ? 6 : scared ? 5 : 3)));
    g.current.position.copy(cur.current);

    // Mira al cristal activo o al jugador.
    if (active && active.type === "mission" && active.status !== "locked" && !celebrating && !scared) {
      lookAt.current.set(active.position[0], 1.2, active.position[1]);
    } else {
      lookAt.current.set(p.x, p.y + 1.3, p.z);
    }
    g.current.lookAt(lookAt.current);

    if (ring.current) {
      ring.current.rotation.z = t * (celebrating ? 6 : 0.8);
      ring.current.rotation.x = Math.PI / 2.2 + (scared ? Math.sin(t * 24) * 0.2 : Math.sin(t * 0.9) * 0.12);
    }
    if (core.current) {
      const s = celebrating ? 1 + Math.abs(Math.sin(t * 10)) * 0.25 : scared ? 0.85 : 1;
      // Cuerpo rechoncho: elipsoide (ancho > alto), el pulso conserva la forma.
      core.current.scale.set(s, s * 0.9, s * 1.05);
      (core.current.material as THREE.MeshStandardMaterial).emissiveIntensity = scared ? 0.9 : celebrating ? 3 : 1.9;
    }

    // --- Expresión física (§5): voltereta, curiosidad, orejas y cola ---
    const curious = !!active && active.type === "mission" && active.status !== "locked" && !celebrating && !scared;
    if (bodyG.current) {
      if (celebrating) {
        // Voltereta: rotación X completa y continua mientras dura la fiesta.
        bodyG.current.rotation.x = (t - (celebrateUntil.current - 2.4)) * 5.2;
      } else {
        // Vuelve suavemente a la vertical (módulo de vuelta completa).
        const wrapped = bodyG.current.rotation.x % (Math.PI * 2);
        bodyG.current.rotation.x = THREE.MathUtils.lerp(wrapped, 0, Math.min(1, dt * 8));
      }
      // Inclinación curiosa hacia el cristal activo.
      bodyG.current.rotation.z = THREE.MathUtils.lerp(bodyG.current.rotation.z, curious ? 0.3 : 0, Math.min(1, dt * 6));
    }
    if (earL.current && earR.current) {
      // Orejas: caídas cuando se asusta, alegres al celebrar, latido suave en idle.
      const drop = scared ? 1.1 : 0;
      const wig = celebrating ? Math.sin(t * 14) * 0.22 : Math.sin(t * 2.3) * 0.06;
      earL.current.rotation.z = THREE.MathUtils.lerp(earL.current.rotation.z, 0.24 + drop + wig, Math.min(1, dt * 7));
      earR.current.rotation.z = THREE.MathUtils.lerp(earR.current.rotation.z, -0.24 - drop - wig, Math.min(1, dt * 7));
    }
    if (tail.current) {
      // Cola pequeña con vaivén (frenética al celebrar, temblorosa si hay miedo).
      tail.current.rotation.y = Math.sin(t * (celebrating ? 10 : scared ? 14 : 3.2)) * 0.4;
    }
    if (light.current) {
      light.current.intensity = scared ? 2 : celebrating ? 8 : 4.5;
    }
    if (sparkles.current) {
      sparkles.current.visible = celebrating;
      if (celebrating) {
        sparkles.current.rotation.y = t * 4;
        sparkles.current.rotation.x = t * 2.3;
      }
    }
  });

  return (
    <group ref={g}>
      {/* bodyG concentra la expresión física: voltereta e inclinación curiosa. */}
      <group ref={bodyG}>
        {/* Cuerpo rechoncho translúcido azul que irradia luz. */}
        <mesh ref={core} scale={[1, 0.9, 1.05]}>
          <sphereGeometry args={[0.34, 20, 20]} />
          <meshStandardMaterial color="#bfe9ff" emissive="#4fb6ff" emissiveIntensity={1.9} roughness={0.15} transparent opacity={0.88} />
        </mesh>
        {/* DOS OREJAS grandes puntiagudas (pivot en la base para caer/alegrarse). */}
        <group ref={earL} position={[-0.16, 0.24, -0.02]} rotation={[0, 0, 0.24]}>
          <mesh position={[0, 0.17, 0]}>
            <coneGeometry args={[0.09, 0.34, 8]} />
            <meshStandardMaterial color="#a9def7" emissive="#4fb6ff" emissiveIntensity={1.4} transparent opacity={0.9} />
          </mesh>
        </group>
        <group ref={earR} position={[0.16, 0.24, -0.02]} rotation={[0, 0, -0.24]}>
          <mesh position={[0, 0.17, 0]}>
            <coneGeometry args={[0.09, 0.34, 8]} />
            <meshStandardMaterial color="#a9def7" emissive="#4fb6ff" emissiveIntensity={1.4} transparent opacity={0.9} />
          </mesh>
        </group>
        {/* Cola pequeña con vaivén. */}
        <group ref={tail} position={[0, -0.04, -0.32]}>
          <mesh position={[0, 0.03, -0.08]} rotation={[-1.15, 0, 0]}>
            <coneGeometry args={[0.07, 0.26, 8]} />
            <meshStandardMaterial color="#a9def7" emissive="#4fb6ff" emissiveIntensity={1.4} transparent opacity={0.9} />
          </mesh>
        </group>
        {/* Ojos negros ENORMES brillantes con highlight blanco (mira por +z). */}
        {[-0.115, 0.115].map((ex) => (
          <group key={ex} position={[ex, 0.05, 0.27]}>
            <mesh scale={[1, 1.35, 0.55]}>
              <sphereGeometry args={[0.078, 12, 12]} />
              <meshStandardMaterial color="#0a1622" roughness={0.12} metalness={0.2} />
            </mesh>
            <mesh position={[0.022, 0.038, 0.035]}>
              <sphereGeometry args={[0.024, 8, 8]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.6} />
            </mesh>
          </group>
        ))}
        {/* Boca feliz (semiarco abierto hacia arriba). */}
        <mesh position={[0, -0.07, 0.3]} rotation={[0.25, 0, Math.PI]}>
          <torusGeometry args={[0.05, 0.014, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#0a1622" roughness={0.3} />
        </mesh>
        {/* Mejillas rosadas sutiles. */}
        {[-0.17, 0.17].map((cx) => (
          <mesh key={cx} position={[cx, -0.04, 0.24]} scale={[1, 0.7, 0.4]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#f9a8c9" emissive="#f9a8c9" emissiveIntensity={0.35} transparent opacity={0.75} />
          </mesh>
        ))}
      </group>
      <mesh ref={ring} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[0.55, 0.05, 12, 32]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} />
      </mesh>
      {/* Chispas de celebración */}
      <group ref={sparkles} visible={false}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.85, Math.sin(a * 2) * 0.3, Math.sin(a) * 0.85]}>
              <octahedronGeometry args={[0.06, 0]} />
              <meshStandardMaterial color="#fff6c9" emissive="#ffd166" emissiveIntensity={2.5} />
            </mesh>
          );
        })}
      </group>
      <pointLight ref={light} color="#6cc4ff" intensity={4.5} distance={6} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Nodo interactuable 3D.
// ---------------------------------------------------------------------------
function nodeColor(node: Scene3DNode, accent: string): string {
  if (node.type === "blocked") return "#5b5566";
  if (node.type === "rival") return "#f472b6";
  if (node.type === "portal") return "#a78bfa";
  if (node.type === "npc") return "#7dd3fc";
  if (node.status === "locked") return "#5b5566";
  if (node.status === "completed") return "#3ee08f";
  if (node.kind === "boss") return "#f4c542";
  return accent;
}

const NPC_LOOK: HeroLook = { accent: "#4fb6ff", detail: "capucha", emblem: "🌟", label: "Guía" };
const RIVAL_LOOK: HeroLook = { accent: "#f472b6", detail: "capa", emblem: "🤺", label: "Rival" };

function Node3D({
  node,
  active,
  accent,
  isNext,
  hitsRef,
}: {
  node: Scene3DNode;
  active: boolean;
  accent: string;
  isNext: boolean;
  hitsRef: React.MutableRefObject<Map<string, number>>;
}) {
  const g = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Mesh>(null);
  const color = nodeColor(node, accent);
  const isBoss = node.kind === "boss";
  const isCrystal = node.type === "mission";
  const isHumanoid = node.type === "npc" || node.type === "rival";
  const [hit, setHit] = useState(0);
  useFrame((state, dt) => {
    // Consume hit timer del ref compartido para animar el pulso.
    const cur = hitsRef.current.get(node.id) ?? 0;
    if (cur > 0) {
      const nxt = Math.max(0, cur - dt);
      hitsRef.current.set(node.id, nxt);
      setHit(nxt);
    } else if (hit !== 0) setHit(0);

    if (!g.current) return;
    const t = state.clock.elapsedTime;
    const hitBoost = hit > 0 ? 0.4 + Math.sin(t * 40) * 0.15 : 0;
    if (!isHumanoid) {
      g.current.rotation.y = t * (isCrystal ? 0.8 : 0.3);
      g.current.position.y = 1.25 + Math.sin(t * 1.6 + node.position[0]) * 0.12 + (active ? 0.25 : 0) + hitBoost;
      const s = 1 + hit * 0.6;
      g.current.scale.setScalar(s);
    } else {
      g.current.rotation.y = Math.sin(t * 0.5 + node.position[0]) * 0.4 + (hit > 0 ? Math.sin(t * 50) * 0.25 : 0);
      g.current.position.x = hit > 0 ? Math.sin(t * 45) * 0.08 : 0;
    }
    if (beam.current && isNext) {
      const pulse = 0.55 + Math.sin(t * 3) * 0.2;
      (beam.current.material as THREE.MeshStandardMaterial).opacity = pulse;
    }
  });
  const emissive = node.status === "locked" || node.type === "blocked" ? 0.15 : active ? 1.6 : 0.8;
  return (
    <group position={[node.position[0], 0, node.position[1]]}>
      {/* Baliza de guía: pilar de luz sobre la próxima misión disponible. */}
      {isNext && (
        <>
          <mesh ref={beam} position={[0, 4, 0]}>
            <cylinderGeometry args={[0.18, 0.55, 8, 12, 1, true]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1.8}
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, 3, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.35, 0.55, 4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
          </mesh>
        </>
      )}
      {isHumanoid ? (
        <group ref={g} position={[0, 0.9, 0]}>
          {/* Fase 6: NPC (Mage guía) y rival (Rogue rosa) en KayKit, con el
              HeroModel clásico como fallback de carga/error. El Adventurer
              tiene el origen en los pies: se baja 0.86 (donde el clásico
              apoyaba los suyos). */}
          <Suspense
            fallback={
              <HeroModel
                bodyColor={node.type === "rival" ? "#7c1d3f" : "#274b6b"}
                accent={color}
                look={node.type === "rival" ? RIVAL_LOOK : NPC_LOOK}
                variant={node.type === "rival" ? "rival" : "npc"}
              />
            }
          >
            <group position={[0, -0.86, 0]}>
              <Adventurer
                mode="world"
                variant={node.type === "rival" ? "rival" : "npc"}
                accent={color}
                fallback={
                  <group position={[0, 0.86, 0]}>
                    <HeroModel
                      bodyColor={node.type === "rival" ? "#7c1d3f" : "#274b6b"}
                      accent={color}
                      look={node.type === "rival" ? RIVAL_LOOK : NPC_LOOK}
                      variant={node.type === "rival" ? "rival" : "npc"}
                    />
                  </group>
                }
              />
            </group>
          </Suspense>
          {active && (
            <mesh position={[0, 1.75, 0]}>
              <sphereGeometry args={[0.14, 10, 10]} />
              <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={2} />
            </mesh>
          )}
        </group>
      ) : (
        <group ref={g}>
          {isCrystal ? (
            <mesh castShadow scale={isBoss ? 1.5 : 1.1}>
              <octahedronGeometry args={[0.7, 0]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive + hit * 1.5} roughness={0.15} metalness={0.3} />
            </mesh>
          ) : node.type === "portal" ? (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.9, 0.22, 16, 40]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
            </mesh>
          ) : (
            <mesh castShadow>
              <icosahedronGeometry args={[0.7, 0]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} roughness={0.4} />
            </mesh>
          )}
          {active && node.status !== "locked" && node.type !== "blocked" && (
            <mesh position={[0, 1.5, 0]}>
              <sphereGeometry args={[0.14, 10, 10]} />
              <meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={2} />
            </mesh>
          )}
        </group>
      )}
      {/* Base luminosa en el suelo (pulsa al recibir un pulso de energía). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]} scale={1 + hit * 0.7}>
        <ringGeometry args={[0.7, 1.1, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 1.2 : 0.4 + hit * 1.5} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      {(active || hit > 0) && <pointLight color={color} intensity={8 + hit * 10} distance={6} position={[0, 1.4, 0]} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Terreno base: colisiones compartidas (suelo, muros, barreras, obstáculos).
// El Bosque pinta su mundo con BosqueEnvironment; el resto de mundos conserva
// la presentación clásica (plano + rejilla) hasta su propio art pass.
// ---------------------------------------------------------------------------
function Terrain({
  theme,
  layout,
  hasEnv,
}: {
  theme: ReturnType<typeof getWorld3DTheme>;
  layout: WorldLayout;
  /** true si el mundo monta un entorno propio (dibuja su propio suelo/límites). */
  hasEnv: boolean;
}) {
  const half = layout.groundHalf;
  const wallH = 4;
  const wall = (pos: [number, number, number], size: [number, number, number]) => (
    <RigidBody type="fixed" colliders={false} position={pos}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
      {/* En el Bosque el límite lo dibujan bermas y árboles: muro invisible. */}
      {!hasEnv && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={size} />
          <meshStandardMaterial color={theme.grid} emissive={theme.accent} emissiveIntensity={0.25} transparent opacity={0.35} />
        </mesh>
      )}
    </RigidBody>
  );
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[half + 6, 0.5, half + 6]} position={[0, -0.5, 0]} />
        {!hasEnv && (
          <>
            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
              <planeGeometry args={[half * 2, half * 2]} />
              <meshStandardMaterial color={theme.ground} roughness={0.9} metalness={0.1} />
            </mesh>
            <gridHelper args={[half * 2, 24, theme.grid, theme.grid]} position={[0, 0.02, 0]} />
          </>
        )}
      </RigidBody>

      {wall([0, wallH / 2, -half], [half * 2, wallH, 0.6])}
      {wall([0, wallH / 2, half], [half * 2, wallH, 0.6])}
      {wall([-half, wallH / 2, 0], [0.6, wallH, half * 2])}
      {wall([half, wallH / 2, 0], [0.6, wallH, half * 2])}

      {/* Barreras invisibles del layout (orillas del río, etc.). */}
      {layout.barriers.map((b, i) => (
        <RigidBody key={`bar${i}`} type="fixed" colliders={false} position={[b.pos[0], b.half[1], b.pos[1]]}>
          <CuboidCollider args={b.half} />
        </RigidBody>
      ))}

      {layout.obstacles.map((o, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[o.pos[0], o.size[1] / 2, o.pos[1]]}>
          <CuboidCollider args={[o.size[0] / 2, o.size[1] / 2, o.size[2] / 2]} />
          {hasEnv ? (
            <group rotation={[0, i * 1.7, 0]}>
              <mesh castShadow receiveShadow scale={[o.size[0] * 0.62, o.size[1] * 0.62, o.size[2] * 0.62]}>
                <dodecahedronGeometry args={[1, 0]} />
                <meshStandardMaterial color="#68785f" flatShading roughness={1} />
              </mesh>
              {/* Casquete de musgo */}
              <mesh position={[0, o.size[1] * 0.38, 0]} scale={[o.size[0] * 0.45, o.size[1] * 0.2, o.size[2] * 0.45]}>
                <sphereGeometry args={[1, 8, 6]} />
                <meshStandardMaterial color="#43804a" flatShading roughness={1} />
              </mesh>
            </group>
          ) : (
            <mesh castShadow receiveShadow rotation={[0, i, 0]}>
              <boxGeometry args={o.size} />
              <meshStandardMaterial color={theme.ground} emissive={theme.grid} emissiveIntensity={0.2} roughness={0.7} />
            </mesh>
          )}
        </RigidBody>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Escena raíz.
// ---------------------------------------------------------------------------
let BOLT_ID = 0;

export default function World3DScene({
  worldId,
  classId,
  nodes,
  nextMissionId,
  heroColor,
  controlsRef,
  paused,
  onActiveNodeChange,
  onInteract,
}: {
  worldId: string;
  classId: string;
  nodes: Scene3DNode[];
  nextMissionId?: string | null;
  heroColor: string;
  controlsRef: React.MutableRefObject<World3DControls>;
  paused: boolean;
  onActiveNodeChange: (id: string | null) => void;
  onInteract: (id: string) => void;
}) {
  const theme = useMemo(() => getWorld3DTheme(worldId), [worldId]);
  const layout = useMemo(() => getWorldLayout(worldId), [worldId]);
  // Entorno + ambience del mundo: un solo rig paramétrico para todos los mundos.
  const Env = useMemo(() => getWorldEnvironment(worldId), [worldId]);
  const amb = useMemo(() => getWorldAmbience(worldId), [worldId]);
  const look = useMemo(() => getHeroLook(classId), [classId]);
  const spawn = layout.spawn;
  const posRef = useRef(new THREE.Vector3(spawn[0], REST_Y, spawn[1]));
  const hitsRef = useRef<Map<string, number>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bolts, setBolts] = useState<Bolt[]>([]);

  const doneCount = useMemo(
    () => nodes.filter((n) => n.type === "mission" && n.status === "completed").length,
    [nodes],
  );
  const voidSpots = useMemo<[number, number][]>(() => {
    const boss = nodes.find((n) => n.kind === "boss" && n.status !== "completed");
    const out: [number, number][] = [layout.decorSpots.blocked];
    if (boss) out.push(boss.position);
    return out;
  }, [nodes, layout]);

  const handleActive = (id: string | null) => {
    setActiveId(id);
    onActiveNodeChange(id);
  };

  const spawnBolt = (origin: THREE.Vector3, dir: THREE.Vector3) => {
    BOLT_ID += 1;
    setBolts((prev) => [...prev, { id: BOLT_ID, pos: origin, dir, life: 0.9, color: look.accent }]);
  };

  // El sol se lee de la ambience (dirección normalizada → posición lejana).
  const sunPos = useMemo(
    () => new THREE.Vector3(amb.sunDir[0], amb.sunDir[1], amb.sunDir[2]).normalize().multiplyScalar(40),
    [amb],
  );

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{
        position: [spawn[0], REST_Y + 7, Math.min(spawn[1] + 10.2, amb.clampCameraZ ?? Infinity)],
        fov: 50,
      }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={[amb.fogColor]} />
      <fog attach="fog" args={[amb.fogColor, amb.fogNear, amb.fogFar]} />

      {/* Rig de iluminación paramétrico: la ambience del mundo manda. */}
      <ambientLight color={amb.ambientColor} intensity={amb.ambientIntensity} />
      <hemisphereLight color={amb.hemiSky} groundColor={amb.hemiGround} intensity={amb.hemiIntensity} />
      <directionalLight
        castShadow
        position={[sunPos.x, sunPos.y, sunPos.z]}
        intensity={amb.sunIntensity}
        color={amb.sunColor}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-far={110}
        shadow-bias={-0.0004}
      />
      {amb.fillIntensity > 0 && (
        <directionalLight position={[16, 12, 20]} intensity={amb.fillIntensity} color={amb.fillColor} />
      )}

      <Suspense fallback={null}>
        <Physics gravity={[0, -18, 0]}>
          <Terrain theme={theme} layout={layout} hasEnv={Env != null} />
          {Env != null && <Env />}
          {nodes.map((n) => (
            <Node3D
              key={n.id}
              node={n}
              active={activeId === n.id}
              accent={theme.accent}
              isNext={n.id === nextMissionId}
              hitsRef={hitsRef}
            />
          ))}
          <Hero
            heroColor={heroColor}
            look={look}
            classId={classId}
            spawn={spawn}
            posRef={posRef}
            controlsRef={controlsRef}
            nodes={nodes}
            paused={paused}
            onActiveNodeChange={handleActive}
            onInteract={onInteract}
            onCast={spawnBolt}
          />
        </Physics>
        <NovaCompanion
          posRef={posRef}
          accent={theme.accent}
          nodes={nodes}
          activeId={activeId}
          doneCount={doneCount}
          voidSpots={voidSpots}
          spawn={spawn}
        />
        <EnergyBolts bolts={bolts} setBolts={setBolts} nodes={nodes} hitsRef={hitsRef} />

        {/* Postproceso: Bloom moderado + viñeta sutil (mirada cinematográfica). */}
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.55} luminanceThreshold={1} luminanceSmoothing={0.25} />
          <Vignette eskil={false} offset={0.24} darkness={0.42} />
        </EffectComposer>
      </Suspense>

      <FollowCamera posRef={posRef} maxZ={amb.clampCameraZ ?? Infinity} />
      <VisibilityFrameDriver />
    </Canvas>
  );
}

// Contratos para otros módulos (World3DScreen, rutas reto.*): named exports
// además del default. NUNCA cambiar sus props de forma no aditiva.
// Fase 6: se re-exporta Adventurer (personajes KayKit animados) para la oleada
// de batalla; su contrato canónico vive en ./characters3d.
export { HeroModel, VisibilityFrameDriver, NovaCompanion };
export { Adventurer, type AdventurerProps, type AdventurerPose } from "./characters3d";
