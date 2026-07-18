// render/quality.ts — Fase 7 (Cine Pass): sistema de tiers de calidad gráfica.
//
// CONTRATO PÚBLICO (otros módulos/agentes leen exactamente estos nombres):
//   - type QualityTier = "alta" | "media" | "baja"
//   - getQualityTier(): lee localStorage "nexus-quality" o autodetecta.
//   - setQualityTier(tier): persiste y notifica (evento "nexus-quality-change").
// Extras: useQualityTier() (hook reactivo) y getTierDpr(tier) (dpr por tier).
//
// SSR-safe: sin window/navigator devuelve "media" y los setters son no-op.

import { useSyncExternalStore } from "react";

export type QualityTier = "alta" | "media" | "baja";

const STORAGE_KEY = "nexus-quality";
const EVENT_NAME = "nexus-quality-change";

const TIERS: readonly QualityTier[] = ["alta", "media", "baja"];

function esTier(v: unknown): v is QualityTier {
  return typeof v === "string" && (TIERS as readonly string[]).includes(v);
}

/** Autodetección: "alta" en desktop capaz, "media" en móvil, "baja" en gama muy baja. */
function detectarTier(): QualityTier {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "media";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memoria = nav.deviceMemory ?? 8; // GB (Chrome; el resto asume desktop medio)
  const nucleos = navigator.hardwareConcurrency ?? 8;
  const movil = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (memoria <= 2 || nucleos <= 2) return "baja";
  if (movil) return "media";
  if (memoria <= 4 || nucleos <= 4) return "media";
  return "alta";
}

/** Tier vigente: preferencia guardada ("nexus-quality") o autodetección. */
export function getQualityTier(): QualityTier {
  if (typeof window === "undefined") return "media";
  try {
    const guardado = window.localStorage.getItem(STORAGE_KEY);
    if (esTier(guardado)) return guardado;
  } catch {
    // localStorage bloqueado (modo privado/iframe): cae a autodetección.
  }
  return detectarTier();
}

/** Persiste el tier y avisa a todos los suscriptores (useQualityTier). */
export function setQualityTier(tier: QualityTier): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, tier);
  } catch {
    // Sin persistencia: el evento sigue actualizando la sesión actual.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: tier }));
}

/** Device pixel ratio recomendado por tier (prop `dpr` del Canvas). */
export function getTierDpr(tier: QualityTier): [number, number] {
  switch (tier) {
    case "alta":
      return [1, 2];
    case "media":
      return [1, 1.5];
    default:
      return [1, 1];
  }
}

function suscribir(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, cb);
  window.addEventListener("storage", cb); // cambios desde otra pestaña
  return () => {
    window.removeEventListener(EVENT_NAME, cb);
    window.removeEventListener("storage", cb);
  };
}

const snapshotServidor = (): QualityTier => "media";

/** Hook reactivo: re-renderiza cuando cambia el tier (toggle, otra pestaña…). */
export function useQualityTier(): QualityTier {
  return useSyncExternalStore(suscribir, getQualityTier, snapshotServidor);
}
