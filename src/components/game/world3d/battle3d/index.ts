// battle3d — escenario 3D de los retos de combate (duelo, boss, puzzle,
// cartas y arena).
//
// Punto de entrada para las rutas: BattleStageBackdrop es seguro de importar
// desde cualquier grafo (solo tipos + lazy); la escena three carga aparte.
// SfxToggle es DOM puro (botón 🔊 discreto que persiste la preferencia).

export { BattleStageBackdrop } from "./BattleStageBackdrop";
export { SfxToggle } from "./SfxToggle";
export type { BattleEvent, BattleEventKind, BattleStage3DProps, StageVariant } from "./types";
