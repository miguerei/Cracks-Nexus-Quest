// render/QualityToggle.tsx — Fase 7 (Cine Pass): botón DOM para ciclar el tier
// de calidad gráfica (alta → media → baja → alta).
//
// NO se monta desde aquí: lo coloca el orquestador donde el HUD lo permita
// (p. ej. junto al botón de menú de World3DScreen). Sin él, el tier funciona
// igualmente por autodetección + localStorage ("nexus-quality").
//
// Si llega `className` se delega TODO el estilo al consumidor; sin él trae un
// estilo flotante mínimo acorde al HUD (cian holo sobre azul profundo).

import { setQualityTier, useQualityTier, type QualityTier } from "./quality";

const SIGUIENTE: Record<QualityTier, QualityTier> = { alta: "media", media: "baja", baja: "alta" };
const ETIQUETA: Record<QualityTier, string> = { alta: "Alta", media: "Media", baja: "Baja" };

const ESTILO_BASE: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid rgba(125, 211, 252, 0.45)",
  background: "rgba(13, 27, 51, 0.72)",
  color: "#7dd3fc",
  font: "600 12px/1.2 system-ui, sans-serif",
  letterSpacing: "0.02em",
  cursor: "pointer",
  backdropFilter: "blur(6px)",
};

export function QualityToggle({ className }: { className?: string }) {
  const tier = useQualityTier();
  return (
    <button
      type="button"
      className={className}
      style={className ? undefined : ESTILO_BASE}
      onClick={() => setQualityTier(SIGUIENTE[tier])}
      title="Cambiar calidad gráfica (AO, profundidad de campo, resolución)"
      aria-label={`Calidad gráfica: ${ETIQUETA[tier]}. Pulsa para cambiar.`}
    >
      ✦ Calidad: {ETIQUETA[tier]}
    </button>
  );
}
