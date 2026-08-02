// ============================================================================
// Prueba de humo del pipeline de contenido (Fase 11).
//
//   node scripts/smoke-content.mjs
//
// Compila `src/lib/content/generate.ts` con esbuild (ya está en node_modules
// como dependencia de Vite) y lo ejecuta sobre un temario de ejemplo. No
// arranca ningún servidor ni toca el navegador: `generate.ts` es 100% puro.
//
// Verifica:
//   1. Se generan al menos MIN_PREGUNTAS preguntas reales.
//   2. NINGUNA pregunta tiene opciones duplicadas (un distractor que repite la
//      respuesta correcta) ni índice de respuesta fuera de rango.
//   3. Ningún V/F con negación (doble negación) ni cloze con hueco absurdo.
//   4. El reparto cubre los 7 mundos.
//   5. El generador es DETERMINISTA: dos pasadas → resultado idéntico.
//   6. Los filtros de calidad descartan de verdad preguntas malas inyectadas.
// ============================================================================

import { build } from "esbuild";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIN_PREGUNTAS = 20;

// --- Temario de ejemplo (Biología · La célula), con la variedad real de un
// apunte: definiciones "X es…", "Se llama X a…" y líneas "Término: definición".
const TEMARIO = `
Tema 3 · La célula

La célula es la unidad básica y funcional de todos los seres vivos.
La membrana plasmática es la capa que rodea la célula y controla lo que entra y sale de ella.
El núcleo es el orgánulo que dirige la actividad celular y guarda el ADN del organismo.
Se llama mitocondria a el orgánulo que produce la energía que la célula necesita para vivir.
El citoplasma es el medio interno gelatinoso donde flotan los orgánulos de la célula.
Los ribosomas son las estructuras encargadas de fabricar las proteínas de la célula.
El aparato de Golgi es el orgánulo que empaqueta y distribuye las sustancias fabricadas.
Los lisosomas son vesículas que contienen enzimas digestivas para reciclar material celular.
El cloroplasto es el orgánulo de las células vegetales que realiza la fotosíntesis.
La pared celular es la cubierta rígida que da forma y sostén a la célula vegetal.
La vacuola es la bolsa que almacena agua, sales y sustancias de reserva en la célula.
El retículo endoplasmático es la red de canales que transporta sustancias por el interior celular.
Ósmosis: el paso de agua a través de una membrana desde la zona menos concentrada a la más concentrada.
Difusión: el movimiento de partículas desde donde hay mucha concentración hacia donde hay poca.
Mitosis: la división celular que produce dos células hijas idénticas a la madre.
Meiosis: la división celular que produce cuatro células con la mitad de cromosomas.

La membrana plasmática regula el intercambio de sustancias con el exterior de la célula.
Durante la mitosis los cromosomas se reparten por igual entre las dos células hijas.
La fotosíntesis ocurre en el cloroplasto gracias al pigmento verde llamado clorofila.
Las plantas almacenan agua en la vacuola, que puede ocupar casi todo el interior celular.
El núcleo se separa del citoplasma mediante una envoltura con poros.
Los ribosomas se apoyan en el retículo endoplasmático rugoso para fabricar proteínas.
`;

// --- Compila el módulo TS a un ESM temporal y lo importa.
async function cargarGenerate() {
  const dir = mkdtempSync(join(tmpdir(), "smoke-content-"));
  const salida = join(dir, "generate.mjs");
  await build({
    entryPoints: [join(RAIZ, "src/lib/content/generate.ts")],
    outfile: salida,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node18",
    logLevel: "silent",
    // `@/data/game` solo aporta TIPOS: se resuelve a un módulo vacío.
    plugins: [
      {
        name: "alias-vacio",
        setup(b) {
          b.onResolve({ filter: /^@\// }, (a) => ({ path: a.path, namespace: "vacio" }));
          b.onLoad({ filter: /.*/, namespace: "vacio" }, () => ({ contents: "export {}", loader: "js" }));
        },
      },
    ],
  });
  const mod = await import(pathToFileURL(salida).href);
  return { mod, limpiar: () => rmSync(dir, { recursive: true, force: true }) };
}

// --- Mini arnés de aserciones.
let fallos = 0;
function comprobar(ok, titulo, detalle = "") {
  console.log(`${ok ? "  OK  " : " FALLO"} · ${titulo}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
}

function clave(s) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[.,;:¿?¡!«»"'()\-…]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const { mod, limpiar } = await cargarGenerate();
const { generarContenido, motivoDescarte, filtrarPreguntasValidas, MUNDOS_REPARTO } = mod;

try {
  console.log("\n=== Prueba de humo · pipeline de contenido (Fase 11) ===\n");

  const res = generarContenido(TEMARIO);
  const todas = Object.values(res.questionsByWorld).flat();

  console.log(
    `Temario de ejemplo: ${TEMARIO.trim().length} caracteres\n` +
      `Resultado: ${res.stats.conceptos} conceptos · ${res.stats.preguntas} preguntas · ` +
      `calidad "${res.stats.calidad}" · ${res.stats.descartadas} descartadas por calidad\n`,
  );

  // 1) Volumen.
  comprobar(todas.length >= MIN_PREGUNTAS, `≥ ${MIN_PREGUNTAS} preguntas generadas`, `${todas.length} preguntas`);
  comprobar(res.stats.conceptos >= 10, "≥ 10 conceptos detectados", `${res.stats.conceptos} conceptos`);

  // 2) Ninguna opción duplicada y respuesta dentro de rango.
  const duplicadas = todas.filter((q) => new Set(q.options.map(clave)).size !== q.options.length);
  comprobar(duplicadas.length === 0, "0 preguntas con opciones duplicadas", `${duplicadas.length} encontradas`);
  const fueraRango = todas.filter((q) => !(q.answer >= 0 && q.answer < q.options.length));
  comprobar(fueraRango.length === 0, "0 respuestas fuera de rango", `${fueraRango.length} encontradas`);

  // 3) Todas pasan los filtros de calidad.
  const malas = todas.map((q) => [q, motivoDescarte(q)]).filter(([, m]) => m !== null);
  comprobar(malas.length === 0, "0 preguntas servidas incumplen los filtros", malas.map(([, m]) => m).join(", "));

  // 4) Reparto entre los 7 mundos.
  const vacios = MUNDOS_REPARTO.filter((m) => (res.questionsByWorld[m] ?? []).length === 0);
  comprobar(vacios.length === 0, "los 7 mundos reciben preguntas", vacios.length ? `vacíos: ${vacios}` : "");
  console.log(
    "         reparto: " +
      MUNDOS_REPARTO.map((m) => `${m}=${res.questionsByWorld[m].length}`).join("  "),
  );

  // 5) Determinismo.
  const res2 = generarContenido(TEMARIO);
  comprobar(
    JSON.stringify(res) === JSON.stringify(res2),
    "determinista (misma entrada → mismas preguntas)",
  );

  // 6) Los filtros descartan de verdad preguntas malas.
  const CASOS_MALOS = [
    {
      titulo: "distractor que repite la respuesta",
      q: { id: "x1", prompt: "¿Qué es «Célula»?", options: ["Unidad básica.", "unidad basica", "Otra cosa."], answer: 0, concept: "Célula" },
    },
    {
      titulo: "V/F con negación (doble negación)",
      q: { id: "x2", prompt: "¿Verdadero o falso? Núcleo: «no controla la célula».", options: ["Verdadero", "Falso"], answer: 1, concept: "Núcleo" },
    },
    {
      titulo: "cloze con hueco de 2 letras",
      q: { id: "x3", prompt: "Completa la frase: «El agua entra en ____ por ósmosis constantemente en la célula»", options: ["la", "el", "lo"], answer: 0, concept: "la" },
    },
    {
      titulo: "cloze con hueco numérico",
      q: { id: "x4", prompt: "Completa la frase: «La mitosis produce ____ células hijas idénticas a la madre»", options: ["2", "4", "8"], answer: 0, concept: "2" },
    },
    {
      titulo: "MCQ con un solo distractor",
      q: { id: "x5", prompt: "¿Qué es «Ósmosis»?", options: ["Paso de agua.", "Otra cosa."], answer: 0, concept: "Ósmosis" },
    },
  ];
  for (const c of CASOS_MALOS) {
    const motivo = motivoDescarte(c.q);
    comprobar(motivo !== null, `descarta: ${c.titulo}`, motivo ?? "NO se descartó");
  }
  const supervivientes = filtrarPreguntasValidas(CASOS_MALOS.map((c) => c.q));
  comprobar(supervivientes.length === 0, "filtrarPreguntasValidas elimina las 5 malas", `${supervivientes.length} sobrevivieron`);

  // Muestra: 3 preguntas reales tal cual se sirven al juego.
  console.log("\nMuestra de preguntas servidas:");
  for (const q of todas.slice(0, 3)) {
    console.log(`  · ${q.prompt}`);
    q.options.forEach((o, i) => console.log(`      ${i === q.answer ? "✓" : " "} ${o}`));
  }

  console.log(`\n=== ${fallos === 0 ? "TODO VERDE" : `${fallos} COMPROBACIONES FALLIDAS`} ===\n`);
} finally {
  limpiar();
}

process.exit(fallos === 0 ? 0 : 1);
