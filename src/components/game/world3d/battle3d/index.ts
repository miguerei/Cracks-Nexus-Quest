// battle3d — escenario 3D de los retos de combate (duelo y jefe).
//
// Punto de entrada para las rutas: BattleStageBackdrop es seguro de importar
// desde cualquier grafo (solo tipos + lazy); la escena three carga aparte.

export { BattleStageBackdrop } from "./BattleStageBackdrop";
export type { BattleEvent, BattleEventKind, BattleStage3DProps } from "./types";
