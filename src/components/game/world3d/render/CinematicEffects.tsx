// render/CinematicEffects.tsx — Fase 7 (Cine Pass): el composer compartido que
// acerca el render en tiempo real al acabado del póster/vídeo canon.
//
// Stack (variant "world" | "battle", recortado por tier de calidad):
//   1. N8AO         — oclusión ambiental a media resolución (peso y contacto).
//   2. DepthOfField — bokeh sutil con autofocus (héroe en mundo, núcleo del
//                     enemigo en batalla). Solo tier "alta".
//   3. Bloom        — mipmapBlur, threshold 1 (canon §9: emisivos ≥ 1.2 brillan).
//   4. GradacionNexus — split-toning procedural hacia el póster: sombras frías
//                     azul-verdosas, altas luces cálidas doradas.
//   5. HueSaturation + BrightnessContrast — medios ricos, contraste de cine.
//   6. ToneMapping ACES — el composer de @react-three/postprocessing apaga el
//                     tone mapping del renderer mientras vive, así que el ACES
//                     explícito al final es la única (y correcta) curva fílmica.
//   7. Vignette (+ ChromaticAberration 0.0005 solo en "alta").
//   8. SMAA en "alta"; FXAA (barato) en "media"/"baja" — multisampling 0 porque
//      N8AOPostPass no admite MSAA y el AA morfológico lo cubre.
//
// Tiers: alta = todo; media = AO + bloom + gradación (+FXAA); baja = bloom +
// gradación (+FXAA). El dpr por tier lo da getTierDpr (quality.ts).
//
// Reglas de casa: refs en useFrame (autofocus sin estado React), dispose de lo
// que creamos (efecto de gradación y pase N8AO), cero allocaciones por frame.

import { useEffect, useMemo, useRef, type MutableRefObject, type ReactElement } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  FXAA,
  HueSaturation,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { Effect, ToneMappingMode, type DepthOfFieldEffect } from "postprocessing";
import * as THREE from "three";

import type { QualityTier } from "./quality";

export type CinematicVariant = "world" | "battle";

// ---------------------------------------------------------------------------
// GradacionNexus: split-toning procedural (paleta maestra §2 del Art Bible).
// Sombras hacia azul-verdoso frío (#1e3a6e/#38bdf8 de fondo), altas luces
// hacia dorado (#f4c542). Trabaja en HDR lineal ANTES del ACES.
// ---------------------------------------------------------------------------
const FRAG_GRADACION = /* glsl */ `
  uniform vec3 uSombras;
  uniform vec3 uLuces;
  uniform float uFuerza;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float pesoSombras = (1.0 - smoothstep(0.0, 0.45, luma)) * uFuerza;
    float pesoLuces = smoothstep(0.5, 1.0, min(luma, 1.0)) * uFuerza;
    c = mix(c, c * uSombras, pesoSombras);
    c = mix(c, c * uLuces, pesoLuces);
    outputColor = vec4(c, inputColor.a);
  }
`;

class EfectoGradacionNexus extends Effect {
  constructor(fuerza: number) {
    super("GradacionNexus", FRAG_GRADACION, {
      uniforms: new Map<string, THREE.Uniform>([
        // Multiplicadores por zona tonal (≈1 para no romper la exposición).
        ["uSombras", new THREE.Uniform(new THREE.Color(0.84, 0.97, 1.13))], // frío azul-verdoso
        ["uLuces", new THREE.Uniform(new THREE.Color(1.12, 1.04, 0.88))], // cálido dorado
        ["uFuerza", new THREE.Uniform(fuerza)],
      ]),
    });
  }
}

function GradacionNexus({ fuerza }: { fuerza: number }) {
  const efecto = useMemo(() => new EfectoGradacionNexus(fuerza), [fuerza]);
  useEffect(() => () => efecto.dispose(), [efecto]);
  return <primitive object={efecto} />;
}

// ---------------------------------------------------------------------------
// EnfoqueDinamico: DoF con autofocus. En mundo sigue el Vector3 vivo del héroe
// (focusRef, copiado por frame en useFrame: cero estado React); en batalla el
// foco es fijo (focusPoint = núcleo del enemigo) y el bokeh, más marcado.
// ---------------------------------------------------------------------------
function EnfoqueDinamico({
  batalla,
  focusRef,
  focusPoint,
}: {
  batalla: boolean;
  focusRef?: MutableRefObject<THREE.Vector3>;
  focusPoint?: [number, number, number];
}) {
  const dof = useRef<DepthOfFieldEffect>(null);
  useFrame(() => {
    const efecto = dof.current;
    if (efecto && efecto.target && focusRef) efecto.target.copy(focusRef.current);
  });
  return (
    <DepthOfField
      ref={dof}
      target={focusPoint ?? [0, 1.2, 0]}
      focusRange={batalla ? 7 : 16}
      bokehScale={batalla ? 3.4 : 2}
      resolutionScale={0.5}
    />
  );
}

// ---------------------------------------------------------------------------
// N8AO con dispose: el wrapper oficial no libera el pase al desmontar (cambio
// de tier); capturamos la instancia y la liberamos nosotros.
// ---------------------------------------------------------------------------
type PaseConDispose = { dispose?: () => void };

function OclusionAmbiental({ tier, batalla }: { tier: QualityTier; batalla: boolean }) {
  const pase = useRef<PaseConDispose>(null);
  useEffect(() => {
    const p = pase.current;
    return () => p?.dispose?.();
  }, []);
  return (
    <N8AO
      ref={pase as never}
      halfRes
      depthAwareUpsampling
      aoRadius={1.7}
      distanceFalloff={1.1}
      intensity={batalla ? 2.7 : 2.3}
      color="#050d1a"
      aoSamples={tier === "alta" ? 12 : 8}
      denoiseSamples={tier === "alta" ? 8 : 4}
      denoiseRadius={12}
    />
  );
}

// ---------------------------------------------------------------------------
// CinematicEffects: composer compartido de World3DScene y BattleStage3D.
// ---------------------------------------------------------------------------
export function CinematicEffects({
  tier,
  variant = "world",
  focusRef,
  focusPoint,
}: {
  tier: QualityTier;
  variant?: CinematicVariant;
  /** Punto de foco vivo (Vector3 mutado por frame): el héroe en el mundo. */
  focusRef?: MutableRefObject<THREE.Vector3>;
  /** Punto de foco fijo (batalla: el núcleo del enemigo, cfg.core). */
  focusPoint?: [number, number, number];
}) {
  const batalla = variant === "battle";
  const caOffset = useMemo(() => new THREE.Vector2(0.0005, 0.0005), []);

  const efectos: ReactElement[] = [];

  // 1) Oclusión ambiental (media resolución): el salto de "plano" a "con peso".
  if (tier !== "baja") efectos.push(<OclusionAmbiental key="ao" tier={tier} batalla={batalla} />);

  // 2) Profundidad de campo sutil (como el vídeo): solo tier alta.
  if (tier === "alta") {
    efectos.push(<EnfoqueDinamico key="dof" batalla={batalla} focusRef={focusRef} focusPoint={focusPoint} />);
  }

  // 3-7) Bloom + gradación + curva ACES + viñeta (todos los tiers).
  efectos.push(
    <Bloom key="bloom" mipmapBlur intensity={batalla ? 0.62 : 0.55} luminanceThreshold={1} luminanceSmoothing={0.28} />,
    <GradacionNexus key="grade" fuerza={batalla ? 1 : 0.9} />,
    <HueSaturation key="sat" saturation={0.12} />,
    <BrightnessContrast key="bc" brightness={0.01} contrast={0.12} />,
    <ToneMapping key="aces" mode={ToneMappingMode.ACES_FILMIC} />,
    <Vignette key="vig" eskil={false} offset={batalla ? 0.16 : 0.22} darkness={batalla ? 0.6 : 0.46} />,
  );

  // 8) Aberración cromática MUY sutil + SMAA (alta); FXAA barato (resto).
  if (tier === "alta") {
    efectos.push(<ChromaticAberration key="ca" offset={caOffset} />, <SMAA key="smaa" />);
  } else {
    efectos.push(<FXAA key="fxaa" />);
  }

  // multisampling 0: N8AOPostPass no admite MSAA; el AA lo pone SMAA/FXAA.
  return <EffectComposer multisampling={0}>{efectos}</EffectComposer>;
}
