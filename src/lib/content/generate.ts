// ============================================================================
// Generador HEURÍSTICO de contenido educativo (Fase 6). Sin IA, offline y
// determinista: mismas entradas → mismas preguntas (PRNG con semilla derivada
// del propio texto). Produce contenido en español con la MISMA forma que el
// estático de `@/data/game` (tipos Concept y Question), de modo que los
// minijuegos existentes lo consumen sin cambiar ni una línea.
//
// Estrategia:
//   1. Segmentar el texto en frases.
//   2. Detectar pares término-definición ("X es/son/consiste en…",
//      "Se llama X a…", líneas "Término: definición", listas).
//   3. Generar preguntas: multiple-choice con distractores de términos
//      hermanos del MISMO documento, V/F por alteración de definición y
//      cloze (hueco = término) sobre frases clave.
//   4. Repartir el pool entre los 7 mundos (rotación equilibrada y estable).
//
// HONESTIDAD: las stats dicen exactamente cuántos conceptos y preguntas
// reales salieron y su calidad; si es "escaso", el UI lo avisa y el
// gameService completa con preguntas estáticas de ejemplo.
//
// Este módulo es 100% puro (solo `import type`): corre en navegador, SSR y
// Node (scripts de test) sin dependencias.
// ============================================================================

import type { Concept, Question } from "@/data/game";

/**
 * Mundos jugables en orden estable (idéntico a PLAYABLE_WORLD_IDS del
 * gameService). El reparto de preguntas rota sobre esta lista.
 */
export const MUNDOS_REPARTO = [
  "bosque",
  "algoritmos",
  "cronicas",
  "laboratorio",
  "lenguas",
  "observatorio",
  "fortaleza-vacio",
] as const;

export type CalidadContenido = "rico" | "suficiente" | "escaso";

export type ContentStats = {
  conceptos: number;
  preguntas: number;
  calidad: CalidadContenido;
  /**
   * Preguntas generadas que NO pasaron los filtros de calidad (Fase 11) y se
   * descartaron antes de servirse. Opcional: los snapshots persistidos
   * anteriores a la Fase 11 no lo tienen.
   */
  descartadas?: number;
};

export type GeneratedContent = {
  concepts: Concept[];
  questionsByWorld: Record<string, Question[]>;
  stats: ContentStats;
};

// ---- PRNG determinista (FNV-1a como semilla + mulberry32) ----

/** Semilla estable derivada del texto: mismo documento → mismas preguntas. */
export function semillaDeTexto(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function crearRng(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates sobre una copia, gobernado por el PRNG con semilla. */
function mezclar<T>(arr: readonly T[], rng: () => number): T[] {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ---- 1) Segmentación de frases ----

/** Divide el texto en frases útiles (ni migajas ni párrafos kilométricos). */
export function segmentarFrases(texto: string): string[] {
  return texto
    .split(/\n+|(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 25 && f.length <= 400 && /\p{L}{3}/u.test(f));
}

// ---- 2) Detección de conceptos (término-definición) ----

const ARTICULO_INICIAL = /^(?:el|la|los|las|un|una|unos|unas)\s+/i;
/** Palabras que nunca son un término válido (pronombres, muletillas…). */
const TERMINOS_VETADOS = new Set([
  "esto", "eso", "ello", "esta", "este", "aquello", "también", "además",
  "no", "sí", "ya", "hay", "que", "cual", "cuando", "donde", "como",
  "por ejemplo", "es decir", "sin embargo", "resumen", "tema", "unidad",
]);
/** Encabezados de temario que no son conceptos ("Tema 3", "Unidad 2"…). */
const PATRON_ENCABEZADO = /^(?:tema|unidad|cap[ií]tulo|bloque|lecci[oó]n|apartado|ejercicio|actividad|p[aá]gina|figura|tabla|anexo)\b/i;

function limpiarTermino(crudo: string): string | null {
  const term = crudo.replace(ARTICULO_INICIAL, "").replace(/[.,;:¿?¡!]+$/, "").trim();
  if (term.length < 3 || term.length > 48) return null;
  if (!/^\p{L}/u.test(term)) return null;
  if (/[.,;]/.test(term)) return null;
  if (term.split(/\s+/).length > 5) return null;
  if (TERMINOS_VETADOS.has(term.toLowerCase())) return null;
  if (PATRON_ENCABEZADO.test(term)) return null;
  return term;
}

function limpiarDefinicion(cruda: string): string | null {
  let def = cruda.trim().replace(/\s+/g, " ");
  if (def.length < 12) return null;
  if (def.length > 220) {
    const corte = def.slice(0, 220);
    def = corte.slice(0, Math.max(corte.lastIndexOf(" "), 180)).trimEnd() + "…";
  }
  if (!/[.…]$/.test(def)) def += ".";
  return def.charAt(0).toUpperCase() + def.slice(1);
}

// "X es/son/consiste en/se define como/se conoce como Y"
const PATRON_ES = /^(.{2,60}?)\s+(?:es|son|consiste en|consisten en|se define como|se definen como|se conoce como|se conocen como)\s+(.{12,300})$/iu;
// "Se llama/denomina X a Y", "Llamamos X a Y"
const PATRON_SE_LLAMA = /(?:se llama|se denomina|llamamos|denominamos)\s+(.{2,48}?)\s+a\s+(.{12,300})/iu;
// Líneas "Término: definición" (con o sin viñeta)
const PATRON_LINEA = /^\s*[-•*·]?\s*(.{2,60}?)\s*[:—]\s*(.{12,300})$/u;

/**
 * Detecta pares término-definición en el texto. Devuelve conceptos con la
 * forma exacta del tipo `Concept` estático (id secuencial, term, definition).
 * Determinista: mismo texto → mismos conceptos en el mismo orden.
 */
export function detectarConceptos(texto: string): Concept[] {
  const encontrados = new Map<string, { term: string; definition: string }>();

  const registrar = (terminoCrudo: string, defCruda: string) => {
    const term = limpiarTermino(terminoCrudo);
    const definition = limpiarDefinicion(defCruda);
    if (!term || !definition) return;
    const clave = term.toLowerCase();
    // Nos quedamos con la primera aparición (suele ser la definición canónica).
    if (!encontrados.has(clave)) encontrados.set(clave, { term, definition });
  };

  // Líneas "Término: definición" y listas.
  for (const linea of texto.split("\n")) {
    const m = linea.match(PATRON_LINEA);
    if (m) registrar(m[1], m[2]);
  }

  // Frases "X es Y…" / "Se llama X a Y…".
  for (const frase of segmentarFrases(texto)) {
    const mEs = frase.match(PATRON_ES);
    if (mEs) registrar(mEs[1], mEs[2]);
    const mLlama = frase.match(PATRON_SE_LLAMA);
    if (mLlama) registrar(mLlama[1], mLlama[2]);
  }

  return [...encontrados.values()].map((c, i) => ({
    id: `cc${i + 1}`,
    term: c.term,
    definition: c.definition,
  }));
}

// ---- 3) Generación de preguntas ----

/**
 * Clave de comparación tolerante (Fase 11): minúsculas, sin acentos ni signos
 * de puntuación ni espacios sobrantes. «Ósmosis.» y «osmosis» son la misma
 * opción — evita distractores que en la práctica duplican la respuesta.
 */
function claveComparacion(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[.,;:¿?¡!«»"'()\-…]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Opciones de MCQ sin duplicados (QA B2, endurecido en Fase 11 con clave
 * tolerante a acentos/puntuación): si dos conceptos comparten texto, el
 * duplicado se descarta. La respuesta correcta va primero; el llamador decide
 * si con las opciones restantes la pregunta vale o se descarta.
 */
function dedupeOpciones(respuesta: string, ...distractores: string[]): string[] {
  const vistos = new Set([claveComparacion(respuesta)]);
  const limpios = distractores.filter((d) => {
    const k = claveComparacion(d);
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  return [respuesta, ...limpios];
}

function sinPuntoFinal(s: string): string {
  return s.replace(/[.…]$/, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Negaciones que convierten un V/F en trampa de doble negación («¿Verdadero
 * que NO tiene…?»). Las afirmaciones con negación se descartan del V/F.
 */
const PATRON_NEGACION = /\b(?:no|nunca|jam[aá]s|ning[uú]n[oa]?|tampoco|ni)\b/iu;

/**
 * Construye las 3 opciones de un MCQ: respuesta + 2 distractores hermanos
 * REALMENTE distintos (clave tolerante a acentos/puntuación). Recorre más
 * hermanos si los primeros duplican la respuesta. Devuelve null si el
 * documento no da ni 2 distractores distintos: mejor descartar la pregunta
 * que servir un MCQ de una sola opción plausible.
 */
function opcionesMcq(
  correcta: string,
  candidatos: string[],
  rng: () => number,
): string[] | null {
  const opciones = dedupeOpciones(correcta, ...candidatos).slice(0, 3);
  if (opciones.length < 3) return null;
  return mezclar(opciones, rng);
}

/** Distractores candidatos: el mismo campo de hasta 6 conceptos hermanos. */
function candidatosHermanos(
  conceptos: Concept[],
  i: number,
  campo: "term" | "definition",
): string[] {
  const n = conceptos.length;
  const lista: string[] = [];
  for (let paso = 1; paso <= Math.min(6, n - 1); paso++) {
    lista.push(conceptos[(i + paso) % n][campo]);
  }
  return lista;
}

/**
 * Genera el pool de preguntas a partir de los conceptos detectados y las
 * frases del documento. Necesita al menos 3 conceptos (los distractores son
 * términos hermanos del MISMO documento). Determinista con la semilla dada.
 *
 * Tipos generados por concepto:
 *  (a) multiple-choice "¿Qué es X?" con definiciones hermanas de distractor,
 *  (b) multiple-choice inverso "¿A qué concepto corresponde esta definición?",
 *  (c) V/F alternando definición verdadera / definición de un hermano,
 *  (d) cloze: frase clave del documento con el término como hueco.
 */
export function generarPreguntas(
  conceptos: Concept[],
  frases: string[],
  semilla: number,
): Question[] {
  if (conceptos.length < 3) return [];
  const rng = crearRng(semilla);
  const preguntas: Question[] = [];
  const agregar = (q: Omit<Question, "id">) =>
    preguntas.push({ id: `cq${preguntas.length + 1}`, ...q });

  const n = conceptos.length;
  conceptos.forEach((c, i) => {
    const h1 = conceptos[(i + 1) % n];

    // (a) MCQ definición: distractores = definiciones de términos hermanos.
    // Si no hay 2 definiciones hermanas realmente distintas, se descarta.
    const opcionesDef = opcionesMcq(c.definition, candidatosHermanos(conceptos, i, "definition"), rng);
    if (opcionesDef) {
      agregar({
        prompt: `¿Qué es «${c.term}»?`,
        options: opcionesDef,
        answer: opcionesDef.indexOf(c.definition),
        concept: c.term,
      });
    }

    // (b) MCQ inverso: distractores = términos hermanos.
    const opcionesTerm = opcionesMcq(c.term, candidatosHermanos(conceptos, i, "term"), rng);
    if (opcionesTerm) {
      agregar({
        prompt: `¿A qué concepto corresponde esta definición? «${sinPuntoFinal(c.definition)}»`,
        options: opcionesTerm,
        answer: opcionesTerm.indexOf(c.term),
        concept: c.term,
      });
    }

    // (c) V/F: alterna afirmación verdadera y alterada (definición de hermano).
    // Sin dobles negaciones (Fase 11): si la definición mostrada ya contiene
    // una negación, el «¿Verdadero o falso?» se vuelve trampa lingüística en
    // vez de reto de conocimiento — se descarta.
    const esVerdadera = i % 2 === 0;
    const defMostrada = esVerdadera ? c.definition : h1.definition;
    const defDistinta = claveComparacion(defMostrada) !== claveComparacion(c.definition) || esVerdadera;
    if (!PATRON_NEGACION.test(defMostrada) && defDistinta) {
      agregar({
        prompt: `¿Verdadero o falso? ${c.term}: «${sinPuntoFinal(defMostrada)}».`,
        options: ["Verdadero", "Falso"],
        answer: esVerdadera ? 0 : 1,
        concept: c.term,
      });
    }
  });

  // (d) Cloze: una frase clave por concepto (si el documento la ofrece y no es
  // la propia frase-definición, para no regalar la respuesta).
  conceptos.forEach((c, i) => {
    // Huecos absurdos fuera (Fase 11): términos cortísimos o numéricos no
    // sostienen un «completa la frase» digno.
    if (c.term.length < 4 || /^[\d\s.,%-]+$/.test(c.term)) return;
    const inicioDef = sinPuntoFinal(c.definition).slice(0, 30).toLowerCase();
    // \\b es ASCII: falla con términos que empiezan/terminan en vocal acentuada
    // («ósmosis», «colibrí»). Lookarounds Unicode con flag "u" (QA B1).
    const patron = new RegExp(`(?<!\\p{L})${escapeRegExp(c.term)}(?!\\p{L})`, "iu");
    const frase = frases.find(
      (f) =>
        f.length <= 200 &&
        patron.test(f) &&
        !f.toLowerCase().includes(inicioDef),
    );
    if (!frase) return;
    const conHueco = frase.replace(patron, "____");
    if (!conHueco.includes("____")) return;
    // Contexto suficiente: sin el hueco deben quedar al menos 30 caracteres.
    if (conHueco.replace(/_+/g, "").trim().length < 30) return;
    const opciones = opcionesMcq(c.term, candidatosHermanos(conceptos, i, "term"), rng);
    if (!opciones) return;
    agregar({
      prompt: `Completa la frase: «${conHueco}»`,
      options: opciones,
      answer: opciones.indexOf(c.term),
      concept: c.term,
    });
  });

  return preguntas;
}

// ---- 3b) Filtros de calidad (Fase 11) ----
// El generador ya evita producir preguntas malas, pero este filtro es la RED
// DE SEGURIDAD que se aplica también al contenido persistido por versiones
// anteriores (gameService lo pasa antes de servir cualquier pool custom).

/**
 * Por qué se descartaría una pregunta, o null si es válida. Exportado para
 * que el smoke test y el informe de calidad puedan explicar los descartes.
 */
export function motivoDescarte(q: Question): string | null {
  if (!q.prompt || q.prompt.trim().length < 12) return "enunciado demasiado corto";
  if (q.prompt.length > 340) return "enunciado demasiado largo";
  if (!Array.isArray(q.options) || q.options.length < 2) return "menos de 2 opciones";
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
    return "índice de respuesta fuera de rango";
  }
  const claves = q.options.map(claveComparacion);
  if (claves.some((k) => !k)) return "opción vacía";
  if (new Set(claves).size !== claves.length) {
    return "opciones duplicadas (un distractor repite la respuesta)";
  }
  const esVF = claves.length === 2 && claves.includes("verdadero") && claves.includes("falso");
  if (esVF) {
    // El prompt V/F es «¿Verdadero o falso? Término: “afirmación”.»: solo la
    // afirmación citada cuenta para la doble negación.
    const afirmacion = q.prompt.replace(/^¿Verdadero o falso\?/iu, "");
    if (PATRON_NEGACION.test(afirmacion)) return "V/F con negación (doble negación)";
    return null;
  }
  if (q.options.length < 3) return "MCQ con un solo distractor";
  const correcta = q.options[q.answer];
  if (q.prompt.includes("____")) {
    if (correcta.trim().length < 3) return "hueco de 1-2 letras (absurdo)";
    if (/^[\d\s.,%-]+$/.test(correcta)) return "hueco numérico suelto";
    if (q.prompt.replace(/_+/g, "").replace(/^Completa la frase:\s*/iu, "").trim().length < 30) {
      return "cloze sin contexto suficiente";
    }
  }
  return null;
}

/** Deja pasar solo las preguntas que superan todos los filtros de calidad. */
export function filtrarPreguntasValidas(preguntas: Question[]): Question[] {
  return preguntas.filter((q) => motivoDescarte(q) === null);
}

// ---- 4) Reparto por mundos ----

/**
 * Reparte el pool entre los 7 mundos: mezcla estable con semilla (para que un
 * concepto no caiga con sus 4 variantes en el mismo mundo) y round-robin
 * equilibrado. Mismo pool + misma semilla → mismo reparto en cada sesión.
 */
export function repartirPorMundos(
  preguntas: Question[],
  semilla: number,
): Record<string, Question[]> {
  const porMundo: Record<string, Question[]> = Object.fromEntries(
    MUNDOS_REPARTO.map((m) => [m, [] as Question[]]),
  );
  const mezcladas = mezclar(preguntas, crearRng(semilla ^ 0x9e3779b9));
  mezcladas.forEach((q, i) => {
    porMundo[MUNDOS_REPARTO[i % MUNDOS_REPARTO.length]].push(q);
  });
  return porMundo;
}

/**
 * Selección estable de preguntas para una misión concreta: rota el pool del
 * mundo según el índice de la misión (5 misiones por mundo) SIN repetir
 * pregunta dentro de la misma misión. Mismo pool + misma misión → siempre las
 * mismas preguntas, en cualquier sesión.
 */
export function preguntasParaMision(
  pool: Question[],
  indiceMision: number,
  cantidad = 7,
): Question[] {
  if (pool.length === 0) return [];
  const n = Math.min(cantidad, pool.length);
  const paso = Math.max(1, Math.floor(pool.length / 5));
  const inicio = ((indiceMision * paso) % pool.length + pool.length) % pool.length;
  const seleccion: Question[] = [];
  for (let k = 0; k < n; k++) seleccion.push(pool[(inicio + k) % pool.length]);
  return seleccion;
}

// ---- Stats honestas ----

export function calcularCalidad(conceptos: number, preguntas: number): CalidadContenido {
  if (conceptos >= 12 && preguntas >= 40) return "rico";
  if (conceptos >= 5 && preguntas >= 15) return "suficiente";
  return "escaso";
}

/**
 * Pipeline completo: texto normalizado → conceptos + preguntas repartidas por
 * mundos + stats honestas. Síncrono y puro (la ruta "analizando" lo ejecuta
 * por fases con yields para no congelar la UI; los scripts de test lo llaman
 * directo).
 */
export function generarContenido(texto: string): GeneratedContent {
  const semilla = semillaDeTexto(texto);
  const frases = segmentarFrases(texto);
  const concepts = detectarConceptos(texto);
  const generadas = generarPreguntas(concepts, frases, semilla);
  // Red de seguridad de calidad (Fase 11): nada malo llega a los mundos.
  const preguntas = filtrarPreguntasValidas(generadas);
  return {
    concepts,
    questionsByWorld: repartirPorMundos(preguntas, semilla),
    stats: {
      conceptos: concepts.length,
      preguntas: preguntas.length,
      calidad: calcularCalidad(concepts.length, preguntas.length),
      descartadas: generadas.length - preguntas.length,
    },
  };
}
