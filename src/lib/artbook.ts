// Fase 1.2-A — Referencias centralizadas al Art Bible ya optimizado a .webp.
// Se usan las versiones ligeras (~250-300 KB) para no dañar el rendimiento en
// móvil. Los .png originales quedan como archivo de referencia de alta calidad.
import introVideo from "@/assets/intro-nexus-quest.mp4.asset.json";

export const ARTBOOK = {
  keyArt: "/artbook/01-key-art-cover-nexus-quest.webp",
  styleGuide: "/artbook/02-style-guide-nexus-quest.webp",
  // Fase 1.3 — Láminas oficiales de Art Bible añadidas como referencia visual.
  classSelection: "/artbook/03-class-selection-nexus-quest.webp",
  worldsMap: "/artbook/04-worlds-map-nexus-quest.webp",
  // Nova, companion oficial del Nexus. `nova` = cuerpo completo (portrait/panel);
  // `novaIcon` = recorte de cabeza para iconos pequeños del HUD/diálogos.
  nova: "/artbook/nova-companion.webp",
  novaIcon: "/artbook/nova-head.webp",
  // Originales de alta resolución (solo referencia, no para render en producción).
  keyArtSource: "/artbook/01-key-art-cover-nexus-quest.png",
  styleGuideSource: "/artbook/02-style-guide-nexus-quest.png",
} as const;

// Retratos oficiales de los 5 héroes jugables, recortados del Key Art.
// Se usan como avatar del jugador y en la selección de clase.
export const HERO_PORTRAITS: Record<string, string> = {
  explorador: "/artbook/heroes/explorador.webp",
  estratega: "/artbook/heroes/estratega.webp",
  sabio: "/artbook/heroes/sabio.webp",
  velocista: "/artbook/heroes/velocista.webp",
  constructor: "/artbook/heroes/constructor.webp",
};

/** Devuelve el retrato del héroe para una clase, con fallback al Explorador. */
export function heroPortrait(classId: string | undefined): string {
  return HERO_PORTRAITS[classId ?? "explorador"] ?? HERO_PORTRAITS.explorador;
}

// Vídeo de intro cinemática (CDN). Se reproduce al comenzar la aventura.
export const INTRO_VIDEO: string = introVideo.url;

// Rarezas de recompensa del Style Guide, mapeadas a tokens semánticos.
export type Rarity = "blue" | "violet" | "gold";

export const RARITY: Record<Rarity, { bg: string; glow: string; label: string }> = {
  blue: { bg: "bg-rare-blue", glow: "glow-rare-blue", label: "Cristal de Saber" },
  violet: { bg: "bg-rare-violet", glow: "glow-rare-violet", label: "Fragmento Épico" },
  gold: { bg: "bg-rare-gold", glow: "glow-rare-gold", label: "Llave del Nexus" },
};
