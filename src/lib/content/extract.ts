// ============================================================================
// Extracción CLIENT-SIDE de texto de documentos del alumno (Fase 6).
//
// Todo ocurre en el navegador: PDF (pdfjs-dist con su worker), DOCX (mammoth),
// TXT/MD (texto plano) y texto pegado. Sin servidores ni IA: el texto nunca
// sale del dispositivo (el guardado del archivo en Supabase Storage es un
// flujo aparte, best-effort, en biblioteca.index).
//
// OJO SSR: pdfjs-dist y mammoth tocan APIs de navegador, por eso se importan
// DINÁMICAMENTE dentro de las funciones y nunca a nivel de módulo.
// ============================================================================

export type FormatoDocumento = "pdf" | "docx" | "txt" | "md" | "texto";

export type ExtractProgress = {
  /** Página del PDF que se está leyendo (1-based). */
  pagina: number;
  /** Total de páginas que se van a leer. */
  totalPaginas: number;
};

export type ExtractResult = {
  /** Texto normalizado, listo para el generador heurístico. */
  text: string;
  formato: FormatoDocumento;
  /** Solo PDF: páginas totales del documento y páginas realmente leídas. */
  paginas?: number;
  paginasLeidas?: number;
  /** Aviso honesto para el UI (p. ej. PDF truncado a MAX_PDF_PAGES páginas). */
  aviso?: string;
};

/** Máximo de páginas de PDF que leemos para no saturar el navegador. */
export const MAX_PDF_PAGES = 80;

/** Cede el turno al hilo principal para que la UI pueda seguir pintando. */
export const cederTurno = () => new Promise<void>((r) => setTimeout(r, 0));

function soloNavegador(): void {
  if (typeof window === "undefined") {
    throw new Error("La extracción de documentos solo funciona en el navegador.");
  }
}

/**
 * Normaliza texto extraído: unifica saltos de línea, une palabras cortadas por
 * guion a final de línea ("mem-\nbrana" → "membrana"), elimina encabezados y
 * pies de página repetidos (típicos de PDF) y colapsa espacios sobrantes.
 */
export function normalizarTexto(raw: string): string {
  let t = raw.replace(/\r\n?/g, "\n");
  // Palabras cortadas por salto de línea con guion.
  t = t.replace(/(\p{L})-\n[ \t]*(\p{L})/gu, "$1$2");
  const lineas = t.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim());
  // Encabezados/pies repetidos: líneas cortas idénticas que aparecen 4+ veces
  // y no terminan como una frase normal.
  const conteo = new Map<string, number>();
  for (const l of lineas) {
    if (l && l.length <= 60) conteo.set(l, (conteo.get(l) ?? 0) + 1);
  }
  const repetidas = new Set(
    [...conteo.entries()].filter(([l, n]) => n >= 4 && !/[.:;!?]$/.test(l)).map(([l]) => l),
  );
  t = lineas.filter((l) => !repetidas.has(l)).join("\n");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

/** Texto pegado directamente por el alumno (pestaña "Pegar texto"). */
export function extraerDeTextoPegado(texto: string): ExtractResult {
  return { text: normalizarTexto(texto), formato: "texto" };
}

/** Detecta el formato por la extensión del nombre de archivo. */
export function formatoDeArchivo(nombre: string): FormatoDocumento | null {
  const ext = nombre.slice(nombre.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "txt") return "txt";
  if (ext === "md" || ext === "markdown") return "md";
  return null;
}

/**
 * Extrae el texto de un archivo del alumno según su formato.
 * Lanza un Error con mensaje en español si el formato no está soportado.
 */
export async function extraerTexto(
  file: File,
  onProgress?: (p: ExtractProgress) => void,
): Promise<ExtractResult> {
  soloNavegador();
  const formato = formatoDeArchivo(file.name);
  if (formato === "pdf") return extraerPdf(file, onProgress);
  if (formato === "docx") return extraerDocx(file);
  if (formato === "txt" || formato === "md") {
    const crudo = await file.text();
    return { text: normalizarTexto(crudo), formato };
  }
  throw new Error(
    "Formato no soportado. Usa PDF, DOCX, TXT o MD — o pega el texto directamente.",
  );
}

async function extraerPdf(
  file: File,
  onProgress?: (p: ExtractProgress) => void,
): Promise<ExtractResult> {
  // pdfjs-dist solo en el navegador; su worker se resuelve vía Vite (?url)
  // para que el parseo pesado no bloquee el hilo principal.
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = await file.arrayBuffer();
  const tarea = pdfjs.getDocument({ data });
  const doc = await tarea.promise;
  try {
    const paginas = doc.numPages;
    const paginasLeidas = Math.min(paginas, MAX_PDF_PAGES);
    const partes: string[] = [];
    for (let p = 1; p <= paginasLeidas; p++) {
      const page = await doc.getPage(p);
      const contenido = await page.getTextContent();
      partes.push(contenido.items.map((it) => ("str" in it ? it.str : "")).join(" "));
      page.cleanup();
      onProgress?.({ pagina: p, totalPaginas: paginasLeidas });
      // Yield periódico: documentos grandes sin congelar la UI.
      if (p % 4 === 0) await cederTurno();
    }
    return {
      text: normalizarTexto(partes.join("\n\n")),
      formato: "pdf",
      paginas,
      paginasLeidas,
      aviso:
        paginas > paginasLeidas
          ? `El PDF tiene ${paginas} páginas; para no saturar el navegador solo se han analizado las primeras ${paginasLeidas}.`
          : undefined,
    };
  } finally {
    // En pdfjs v6, destroy() vive en la tarea de carga (libera doc y worker).
    await tarea.destroy();
  }
}

async function extraerDocx(file: File): Promise<ExtractResult> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const resultado = await mammoth.extractRawText({ arrayBuffer });
  return { text: normalizarTexto(resultado.value), formato: "docx" };
}
