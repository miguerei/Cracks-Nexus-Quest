// Fuente pendiente de análisis: la ruta /biblioteca la deja aquí y la ruta
// /biblioteca/analizando la consume. Vive SOLO en memoria (un File no es
// serializable): si el alumno recarga en mitad del análisis, la ruta
// analizando lo detecta y le devuelve a la biblioteca con honestidad.

export type PendingSource =
  | { kind: "archivo"; file: File }
  | { kind: "texto"; texto: string; nombre: string };

let pendiente: PendingSource | null = null;

export function setPendingSource(p: PendingSource): void {
  pendiente = p;
}

/** Consume la fuente pendiente (solo se entrega una vez). */
export function takePendingSource(): PendingSource | null {
  const p = pendiente;
  pendiente = null;
  return p;
}
