// render/OutlinePass.tsx — Fase 10 "Anime Pass": el contorno.
//
// Junto al cel-shading, es el rasgo que convierte un 3D en un dibujo: en el
// vídeo canon cada silueta está recortada por un trazo oscuro.
//
// TÉCNICA: detección de bordes sobre la PROFUNDIDAD INVERSA (1/z) en vez de
// la lineal. 1/z es lineal en pantalla para cualquier plano, así que su
// laplaciano vale ~0 en suelos y paredes por rasante que sea el ángulo, y
// solo se dispara en siluetas y aristas reales. Esto evita el fallo clásico
// del Sobel de profundidad: contornear el terreno entero en escorzo.
//
// CALIBRACIÓN VERIFICADA EN NAVEGADOR: el umbral es EL parámetro delicado.
// Con 0.005 el trazo aparecía en cada brizna de hierba y cada hoja, y la
// vegetación se convertía en una masa negra. 0.055 lo reserva a siluetas.

import { useEffect, useMemo } from "react";
import { Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";

import type { QualityTier } from "./quality";

const FRAG_CONTORNO = /* glsl */ `
  uniform float uGrosor;
  uniform vec3 uColor;
  uniform float uFuerza;
  uniform float uUmbral;
  uniform float uPendiente;
  uniform float uCerca;
  uniform float uLejos;

  // Profundidad inversa: lineal en pantalla, así el laplaciano solo salta en
  // discontinuidades reales (siluetas), no en superficies inclinadas.
  float invZ(const in vec2 uv) {
    float d = texture2D(depthBuffer, uv).r;
    float z = perspectiveDepthToViewZ(d, cameraNear, cameraFar);
    return 1.0 / max(0.0001, -z);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 px = uGrosor / resolution;

    float wC = invZ(uv);
    float wL = invZ(uv - vec2(px.x, 0.0));
    float wR = invZ(uv + vec2(px.x, 0.0));
    float wU = invZ(uv + vec2(0.0, px.y));
    float wD = invZ(uv - vec2(0.0, px.y));

    // Laplaciano: cero en planos, alto en saltos de profundidad.
    float lap = abs(wL + wR - 2.0 * wC) + abs(wU + wD - 2.0 * wC);

    // Compensación de superficies rasantes (el terreno facetado en escorzo no
    // debe convertirse en alambrado).
    float pendiente = abs(wR - wL) + abs(wU - wD);
    float borde = (lap / max(0.0001, wC)) / (1.0 + uPendiente * pendiente);

    float linea = smoothstep(uUmbral, uUmbral * 4.5, borde);

    // Afinado con la distancia: se toma el objeto MÁS CERCANO del vecindario
    // para que el píxel de cielo pegado a una silueta también se trace.
    float wMax = max(max(wL, wR), max(max(wU, wD), wC));
    float distMin = 1.0 / max(0.0001, wMax);
    float fade = 1.0 - smoothstep(uCerca, uLejos, distMin);

    outputColor = vec4(mix(inputColor.rgb, uColor, linea * uFuerza * fade), inputColor.a);
  }
`;

export type OpcionesContorno = {
  grosor?: number;
  color?: THREE.ColorRepresentation;
  fuerza?: number;
  umbral?: number;
  pendiente?: number;
  cerca?: number;
  lejos?: number;
};

class EfectoContorno extends Effect {
  constructor({
    grosor = 1.15,
    color = "#141026",
    fuerza = 0.62,
    // 0.055 y no 0.005: verificado en navegador — el valor bajo dibujaba cada
    // brizna de hierba y convertía la vegetación en una mancha negra.
    umbral = 0.055,
    pendiente = 18,
    cerca = 34,
    lejos = 105,
  }: OpcionesContorno = {}) {
    super("ContornoAnime", FRAG_CONTORNO, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ["uGrosor", new THREE.Uniform(grosor)],
        ["uColor", new THREE.Uniform(new THREE.Color(color))],
        ["uFuerza", new THREE.Uniform(fuerza)],
        ["uUmbral", new THREE.Uniform(umbral)],
        ["uPendiente", new THREE.Uniform(pendiente)],
        ["uCerca", new THREE.Uniform(cerca)],
        ["uLejos", new THREE.Uniform(lejos)],
      ]),
    });
  }
}

/** Grosor y fuerza por tier: el trazo acompaña, nunca domina. */
export function contornoPorTier(tier: QualityTier): { grosor: number; fuerza: number } {
  switch (tier) {
    case "alta":
      return { grosor: 1.15, fuerza: 0.62 };
    case "media":
      return { grosor: 1.05, fuerza: 0.55 };
    default:
      // No se apaga en "baja": es la seña de identidad del pase y cuesta
      // menos que el Bloom (4 lecturas del depth ya renderizado).
      return { grosor: 1, fuerza: 0.45 };
  }
}

export function ContornoAnime(props: OpcionesContorno) {
  const efecto = useMemo(
    () => new EfectoContorno(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.grosor, props.fuerza, props.umbral, props.cerca, props.lejos],
  );
  useEffect(() => () => efecto.dispose(), [efecto]);
  return <primitive object={efecto} />;
}
