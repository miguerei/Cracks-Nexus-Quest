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

/**
 * Tope de texto que pasa al generador (Fase 11): más allá, el análisis en el
 * hilo del navegador se resiente y las preguntas extra no aportan (el pool ya
 * llena de sobra los 7 mundos). Se recorta en frontera de frase, con aviso.
 */
export const MAX_TEXTO_CHARS = 200_000;

/** Por debajo de esto avisamos de material escaso (se generarán pocas preguntas). */
export const MIN_PALABRAS_HOLGADAS = 300;

/** Nº de palabras de un texto (para el aviso de material escaso). */
export function contarPalabras(texto: string): number {
  const m = texto.match(/\p{L}+/gu);
  return m ? m.length : 0;
}

/**
 * Recorta textos desmesurados en una frontera de frase cerca del tope.
 * Devuelve el texto (quizá recortado) y un aviso honesto si hubo recorte.
 */
export function limitarTexto(texto: string): { texto: string; aviso?: string } {
  if (texto.length <= MAX_TEXTO_CHARS) return { texto };
  const corte = texto.slice(0, MAX_TEXTO_CHARS);
  const ultimaFrase = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf(".\n"), corte.lastIndexOf("\n"));
  const recortado = corte.slice(0, ultimaFrase > MAX_TEXTO_CHARS * 0.8 ? ultimaFrase + 1 : MAX_TEXTO_CHARS).trimEnd();
  return {
    texto: recortado,
    aviso: `El documento es muy largo (${Math.round(texto.length / 1000)} mil caracteres): se han analizado los primeros ${Math.round(recortado.length / 1000)} mil. Con eso sobra para llenar los 7 mundos.`,
  };
}

/**
 * Cierre común de toda extracción (Fase 11): aplica el tope de tamaño y añade
 * el aviso de material escaso. Los avisos se acumulan en una sola línea.
 */
function rematarExtraccion(base: ExtractResult): ExtractResult {
  const avisos: string[] = base.aviso ? [base.aviso] : [];
  const { texto, aviso: avisoTope } = limitarTexto(base.text);
  if (avisoTope) avisos.push(avisoTope);
  const palabras = contarPalabras(texto);
  if (palabras > 0 && palabras < MIN_PALABRAS_HOLGADAS) {
    avisos.push(
      `Material escaso: el texto tiene solo ${palabras} palabras, así que saldrán pocas preguntas. Cuantas más definiciones («X es…», «Término: definición»), mejores retos.`,
    );
  }
  return { ...base, text: texto, aviso: avisos.length > 0 ? avisos.join(" ") : undefined };
}

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
  return rematarExtraccion({ text: normalizarTexto(texto), formato: "texto" });
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
  if (file.size === 0) {
    throw new Error("El archivo está vacío (0 bytes). Elige otro documento o pega el texto directamente.");
  }
  const formato = formatoDeArchivo(file.name);
  if (formato === "pdf") return rematarExtraccion(await extraerPdf(file, onProgress));
  if (formato === "docx") return rematarExtraccion(await extraerDocx(file));
  if (formato === "txt" || formato === "md") {
    const crudo = await file.text();
    return rematarExtraccion({ text: normalizarTexto(crudo), formato });
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
  let doc: Awaited<typeof tarea.promise>;
  try {
    doc = await tarea.promise;
  } catch {
    await tarea.destroy().catch(() => undefined);
    throw new Error(
      "No se pudo abrir el PDF (¿está dañado o protegido con contraseña?). Prueba a exportarlo de nuevo o pega el texto directamente.",
    );
  }
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
    const text = normalizarTexto(partes.join("\n\n"));
    // PDF escaneado (Fase 11): páginas que son imágenes, sin texto seleccionable.
    // Mensaje claro en vez de un análisis vacío que confunde.
    if (contarPalabras(text) < paginasLeidas * 5 && contarPalabras(text) < 40) {
      throw new Error(
        "Este PDF parece escaneado: sus páginas son imágenes y no contienen texto seleccionable. Exporta tus apuntes como PDF de texto (o usa un OCR) — o pega el texto directamente.",
      );
    }
    return {
      text,
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
  let crudo: string;
  try {
    // mammoth vuelca también el texto de las tablas (celda a celda, cada
    // párrafo en su línea), así que los temarios tabulados no se pierden.
    const resultado = await mammoth.extractRawText({ arrayBuffer });
    crudo = resultado.value;
  } catch {
    throw new Error(
      "No se pudo leer el DOCX (¿está dañado o es un .doc antiguo?). Guárdalo como .docx moderno o pega el texto directamente.",
    );
  }
  const text = normalizarTexto(crudo);
  if (contarPalabras(text) < 10) {
    throw new Error(
      "El DOCX no contiene texto aprovechable (¿solo imágenes?). Prueba con un documento con texto o pega el contenido directamente.",
    );
  }
  return { text, formato: "docx" };
}
