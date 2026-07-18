// Short, gaming-flavored feedback for minigames (P2-3).
// Turns a question's `concept` into a one-line "why" on a hit and a short
// hint on a miss. No exam-style paragraphs, no real AI — pure display copy.
// Concept keys match `Question.concept` / `Concept.term` from the demo data.

type ConceptCopy = { why: string; hint: string };

// Tuned phrases for the Biología · "La célula" demo concepts.
const CONCEPT_COPY: Record<string, ConceptCopy> = {
  "Célula": {
    why: "la célula es la unidad básica de la vida",
    hint: "busca la unidad más pequeña con vida propia",
  },
  "Núcleo": {
    why: "el núcleo dirige la célula y guarda el ADN",
    hint: "busca el centro que guarda la información genética",
  },
  "Mitocondria": {
    why: "la mitocondria produce la energía de la célula",
    hint: "busca el orgánulo que produce energía",
  },
  "Membrana": {
    why: "la membrana controla lo que entra y sale",
    hint: "revisa qué rodea la célula y filtra el paso",
  },
  "Citoplasma": {
    why: "el citoplasma es el medio donde flotan los orgánulos",
    hint: "piensa en el 'gel' interno de la célula",
  },
  "ADN": {
    why: "el ADN guarda la información genética",
    hint: "busca la molécula con las instrucciones",
  },
  "Orgánulos": {
    why: "los orgánulos tienen una función propia",
    hint: "piensa en las 'piezas' internas con tarea propia",
  },
};

/** One-line reason for a correct answer, e.g. "Impacto crítico: la mitocondria produce energía." */
export function hitFeedback(concept: string | undefined, label: string): string {
  const copy = concept ? CONCEPT_COPY[concept] : undefined;
  return copy ? `${label}: ${copy.why}.` : `${label}: concepto dominado.`;
}

/** Short hint for a wrong answer, e.g. "El Vacío se fortalece. Pista: busca el orgánulo que produce energía." */
export function missFeedback(concept: string | undefined, label: string): string {
  const copy = concept ? CONCEPT_COPY[concept] : undefined;
  return copy ? `${label}. Pista: ${copy.hint}.` : `${label}. Vuelve a intentarlo con calma.`;
}
