// battle3d/types.ts — API pública del escenario de combate 3D.
//
// SOLO tipos: este fichero lo importan las rutas de reto (duelo, boss,
// puzzle, cartas, arena) y NO debe arrastrar three/R3F al grafo síncrono.
// La escena real se carga lazy detrás de <ClientOnly> en BattleStageBackdrop.

/**
 * Evento de combate que dispara la ruta educativa:
 * - "idle":    sin acción (estado inicial).
 * - "cast":    respuesta correcta → el héroe lanza el hechizo (§7 del Art Bible).
 * - "miss":    respuesta incorrecta / tiempo agotado → pulso del Vacío hacia el héroe.
 * - "victory": reto superado → el enemigo se disuelve en partículas doradas+azules.
 * - "defeat":  sin vidas / reto perdido → el enemigo se desvanece en niebla (tono sereno).
 */
export type BattleEventKind = "idle" | "cast" | "miss" | "victory" | "defeat";

/** `n` debe incrementarse en cada evento para re-disparar la animación. */
export type BattleEvent = { kind: BattleEventKind; n: number };

/**
 * Variantes del escenario:
 * - "rival": humanoide oscuro con acentos rosa (reto.duelo, reto.cartas).
 * - "boss":  Coloso del Vacío §6 (reto.boss).
 * - "runas": Guardián Rúnico sereno — monolito sellado del Vacío (reto.puzzle).
 * - "horda": Sombras del Vacío en oleadas, 1 principal + 2 menores (reto.arena).
 */
export type StageVariant = "rival" | "boss" | "runas" | "horda";

export type BattleStage3DProps = {
  /** Adversario y encuadre del escenario (ver StageVariant). */
  variant: StageVariant;
  /** Clase del avatar del jugador (usePlayerStore → avatar.classId). */
  classId?: string;
  /** Color del avatar; admite oklch()/css moderno (se convierte a hex internamente). */
  heroColor?: string;
  /** Último evento de combate. */
  event: BattleEvent;
};
