// Fase 2-D — Modelo de datos del sistema de diálogo tipo RPG clásico.
//
// Es puramente presentacional/narrativo: describe qué se dice y quién lo dice.
// No aplica recompensas, no muta el progreso ni el gating. Se usa para dar
// sensación de aventura (caja inferior, retrato del hablante, secuencia de
// mensajes y elecciones) en la capa de exploración de mundos.

/** Tipo de hablante; decide el estilo del retrato y el color del marco. */
export type SpeakerKind = "nova" | "hero" | "ally" | "rival" | "void";

/** Una línea de diálogo dentro de una secuencia. */
export interface DialogueLine {
  /** Nombre mostrado (p. ej. «Nova»). */
  speaker: string;
  /** Tipo de hablante para el estilo del retrato. Por defecto "ally". */
  kind?: SpeakerKind;
  /** Emoji de respaldo cuando no hay imagen de retrato. */
  emoji?: string;
  /** URL opcional de retrato (imagen). */
  portrait?: string;
  /** Texto del mensaje (se escribe con efecto máquina de escribir). */
  text: string;
}

/** Una opción de elección al final de una secuencia de diálogo. */
export interface DialogueChoiceOption {
  label: string;
  /** Tono visual del botón. Por defecto "primary". */
  tone?: "primary" | "gold" | "void";
  /** Acción al elegir esta opción. */
  onSelect?: () => void;
}
