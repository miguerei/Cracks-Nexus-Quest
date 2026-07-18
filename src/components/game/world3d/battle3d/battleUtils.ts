// battle3d/battleUtils.ts — utilidades del escenario de combate.

/**
 * PRNG determinista (mulberry32): mismo seed ⇒ mismo decorado.
 * Regla del Art Bible §9: nunca Math.random en construcción de escena.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * three.js no entiende colores CSS modernos (oklch del design system).
 * Convertimos a hex vía canvas 2D; si no se puede, azul del Explorador.
 * (Copia local del helper de World3DScreen: battle3d no depende de esa pantalla.)
 */
export function cssColorToHex(color: string | undefined): string {
  if (!color) return "#60a5fa";
  if (color.startsWith("#")) return color;
  if (typeof document === "undefined") return "#60a5fa";
  try {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const ctx = cv.getContext("2d");
    if (!ctx) return "#60a5fa";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return "#60a5fa";
  }
}
