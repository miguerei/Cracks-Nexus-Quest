import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Loader2,
  Sparkles,
  Brain,
  Target,
  ArrowRight,
  AlertTriangle,
  FileWarning,
  Swords,
  Globe2,
} from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { getMissions, getSampleConcepts, getSubject, getWorlds } from "@/services/gameService";
import { usePlayerStore } from "@/store/usePlayerStore";
import { takePendingSource } from "@/lib/content/pending";
import { cederTurno, extraerDeTextoPegado, extraerTexto, type ExtractProgress } from "@/lib/content/extract";
import {
  calcularCalidad,
  detectarConceptos,
  generarPreguntas,
  repartirPorMundos,
  segmentarFrases,
  semillaDeTexto,
  MUNDOS_REPARTO,
  type GeneratedContent,
} from "@/lib/content/generate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/biblioteca/analizando/$docId")({
  component: Analyzing,
});

const SUBJECT = getSubject();
/** Mínimo de texto extraído para que el análisis tenga sentido. */
const MIN_TEXTO = 200;

// Pasos REALES del pipeline: el avance de la barra refleja el trabajo hecho
// de verdad en cada fase (nada de temporizadores fingiendo progreso).
const PASOS = [
  { label: "Extrayendo texto", detail: "Leyendo tu documento en este dispositivo" },
  { label: "Detectando conceptos", detail: "Buscando términos y definiciones" },
  { label: "Generando retos", detail: "Creando preguntas con tus propios conceptos" },
  { label: "Repartiendo por mundos", detail: "Asignando retos a los 7 mundos del Nexus" },
] as const;

const ETIQUETA_CALIDAD: Record<string, { texto: string; clase: string }> = {
  rico: { texto: "Contenido rico", clase: "border-energy/50 bg-energy/10 text-energy" },
  suficiente: { texto: "Contenido suficiente", clase: "border-primary/50 bg-primary/10 text-primary" },
  escaso: { texto: "Contenido escaso", clase: "border-destructive/50 bg-destructive/10 text-destructive" },
};

function Analyzing() {
  const navigate = useNavigate();
  const { docId } = Route.useParams();
  const esDemo = docId === "demo";
  const documentName = usePlayerStore((s) => s.documentName) ?? "tus apuntes";
  const setCustomContent = usePlayerStore((s) => s.setCustomContent);

  const [paso, setPaso] = useState(0);
  const [progresoPdf, setProgresoPdf] = useState<ExtractProgress | null>(null);
  const [resultado, setResultado] = useState<GeneratedContent | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoListo, setDemoListo] = useState(false);
  const ejecutado = useRef(false);

  useEffect(() => {
    if (ejecutado.current) return;
    ejecutado.current = true;

    // Modo demo: los apuntes de ejemplo no se analizan; se juega con el
    // contenido estático y se dice claramente.
    if (esDemo) {
      const t = setTimeout(() => setDemoListo(true), 900);
      return () => clearTimeout(t);
    }

    const fuente = takePendingSource();
    if (!fuente) {
      // Recarga o deep-link sin documento pendiente: volvemos a la biblioteca.
      navigate({ to: "/biblioteca" });
      return;
    }

    void (async () => {
      try {
        // 1) Extraer texto (PDF por páginas con progreso real).
        setPaso(0);
        const extraccion =
          fuente.kind === "archivo"
            ? await extraerTexto(fuente.file, setProgresoPdf)
            : extraerDeTextoPegado(fuente.texto);
        const nombre = fuente.kind === "archivo" ? fuente.file.name : fuente.nombre;
        if (extraccion.aviso) setAviso(extraccion.aviso);
        if (extraccion.text.length < MIN_TEXTO) {
          throw new Error(
            "El documento tiene muy poco texto aprovechable. Prueba con un temario más completo o pega el texto directamente.",
          );
        }

        // 2) Detectar conceptos (término-definición).
        setPaso(1);
        await cederTurno();
        const frases = segmentarFrases(extraccion.text);
        const conceptos = detectarConceptos(extraccion.text);

        // 3) Generar preguntas (MCQ, V/F, cloze) con semilla del propio texto.
        setPaso(2);
        await cederTurno();
        const semilla = semillaDeTexto(extraccion.text);
        const preguntas = generarPreguntas(conceptos, frases, semilla);
        if (conceptos.length < 3 || preguntas.length === 0) {
          throw new Error(
            "No he encontrado suficientes definiciones en el documento (necesito al menos 3 conceptos tipo «X es…» o «Término: definición»). Prueba con unos apuntes más teóricos.",
          );
        }

        // 4) Repartir por mundos y persistir.
        setPaso(3);
        await cederTurno();
        const porMundo = repartirPorMundos(preguntas, semilla);
        const stats = {
          conceptos: conceptos.length,
          preguntas: preguntas.length,
          calidad: calcularCalidad(conceptos.length, preguntas.length),
        };
        setCustomContent({
          docName: nombre,
          createdAt: new Date().toISOString(),
          stats,
          concepts: conceptos,
          questionsByWorld: porMundo,
        });
        setPaso(4);
        setResultado({ concepts: conceptos, questionsByWorld: porMundo, stats });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo analizar el documento.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-screen px-4 py-10">
      <StarField />
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full bg-gradient-nexus text-4xl glow-primary animate-pulse-glow">
            🌟
          </div>
          <h1 className="text-2xl font-black">
            {error ? "No se pudo analizar" : resultado || demoListo ? "Análisis completado" : "Nova está analizando"}
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {error ? (
              "El documento no dio material suficiente."
            ) : resultado ? (
              <>Retos generados a partir de <span className="font-semibold text-foreground">{documentName}</span>, aquí en tu dispositivo.</>
            ) : demoListo ? (
              <>Apunte de ejemplo: jugarás con el contenido demo de <span className="font-semibold text-foreground">{SUBJECT.area} — {SUBJECT.topic}</span>.</>
            ) : esDemo ? (
              "Preparando el contenido de ejemplo…"
            ) : (
              "Analizando tu documento en este dispositivo (heurístico, sin IA externa)…"
            )}
          </p>
        </div>

        {/* Pasos de progreso reales */}
        {!error && !resultado && !demoListo && !esDemo && (
          <div className="space-y-3">
            {PASOS.map((s, i) => {
              const hecho = i < paso;
              const activo = i === paso;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: hecho || activo ? 1 : 0.4 }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-background">
                    {hecho ? (
                      <Check className="h-5 w-5 text-energy" />
                    ) : activo ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{i + 1}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {i === 0 && activo && progresoPdf
                        ? `Página ${progresoPdf.pagina} de ${progresoPdf.totalPaginas}`
                        : s.detail}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Error honesto */}
        {error && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
              <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-sm leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => navigate({ to: "/biblioteca" })}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 px-6 py-3.5 font-bold transition hover:border-primary/60"
            >
              Volver a la biblioteca
            </button>
          </motion.div>
        )}

        {/* Resumen del análisis REAL */}
        <AnimatePresence>
          {resultado && (
            <ResumenAnalisis
              resultado={resultado}
              aviso={aviso}
              onContinuar={() => navigate({ to: "/biblioteca/aventura/$docId", params: { docId } })}
            />
          )}
        </AnimatePresence>

        {/* Resumen del modo demo (contenido de ejemplo, sin análisis) */}
        <AnimatePresence>
          {demoListo && (
            <ResumenDemo onContinuar={() => navigate({ to: "/biblioteca/aventura/$docId", params: { docId } })} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ResumenAnalisis({
  resultado,
  aviso,
  onContinuar,
}: {
  resultado: GeneratedContent;
  aviso: string | null;
  onContinuar: () => void;
}) {
  const { concepts, questionsByWorld, stats } = resultado;
  const mundos = getWorlds();
  const nombreMundo = (id: string) => mundos.find((w) => w.id === id)?.name ?? id;
  const muestra = Object.values(questionsByWorld).flat().slice(0, 3);
  const etiqueta = ETIQUETA_CALIDAD[stats.calidad];
  const conceptosVisibles = concepts.slice(0, 12);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Stats honestas */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-bold">
          {stats.conceptos} conceptos
        </span>
        <span className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-bold">
          {stats.preguntas} preguntas generadas
        </span>
        <span className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", etiqueta.clase)}>
          {etiqueta.texto}
        </span>
      </div>

      {aviso && (
        <div className="flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-xs leading-relaxed text-muted-foreground">{aviso}</p>
        </div>
      )}

      {stats.calidad === "escaso" && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tu documento dio para <span className="font-semibold text-foreground">{stats.preguntas} preguntas reales</span>.
            Es poco para llenar los 7 mundos: los retos que falten se completarán con preguntas de ejemplo
            (relleno del contenido demo). Para más retos propios, sube un temario con más definiciones.
          </p>
        </div>
      )}

      {/* Conceptos reales detectados */}
      <section className="rounded-3xl border border-border bg-card/70 p-5 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-energy text-energy-foreground">
            <Brain className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold leading-tight">Conceptos detectados en tu documento</h2>
            <p className="text-xs text-muted-foreground">
              {stats.conceptos} términos con definición encontrados
              {concepts.length > conceptosVisibles.length ? ` · se muestran ${conceptosVisibles.length}` : ""}
            </p>
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {conceptosVisibles.map((c, i) => (
            <motion.li
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-border bg-background/50 p-3"
            >
              <p className="text-sm font-semibold text-accent">{c.term}</p>
              <p className="text-xs leading-snug text-muted-foreground">{c.definition}</p>
            </motion.li>
          ))}
        </ul>
      </section>

      {/* Muestra de preguntas reales */}
      <section className="rounded-3xl border border-border bg-card/70 p-5 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-nexus text-primary-foreground">
            <Swords className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold leading-tight">Así serán tus retos</h2>
            <p className="text-xs text-muted-foreground">3 de las {stats.preguntas} preguntas generadas</p>
          </div>
        </div>
        <ol className="space-y-2">
          {muestra.map((q, i) => (
            <motion.li
              key={q.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="rounded-2xl border border-border bg-background/50 p-3"
            >
              <p className="text-sm font-semibold">{q.prompt}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {q.options.map((o, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px]",
                      idx === q.answer
                        ? "border-energy/50 bg-energy/10 font-semibold text-energy"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {o.length > 70 ? o.slice(0, 70) + "…" : o}
                  </span>
                ))}
              </div>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* Reparto por mundos */}
      <section className="rounded-3xl border border-border bg-card/70 p-5 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-gold text-primary-foreground">
            <Globe2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold leading-tight">Reparto por mundos</h2>
            <p className="text-xs text-muted-foreground">Tus preguntas alimentan los retos de los 7 mundos</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MUNDOS_REPARTO.map((id) => (
            <span key={id} className="rounded-full border border-border bg-background/50 px-3 py-1.5 text-xs">
              {nombreMundo(id)} · <span className="font-bold">{questionsByWorld[id]?.length ?? 0}</span>
            </span>
          ))}
        </div>
      </section>

      <NovaBubble
        mood="celebrate"
        message={`¡Hecho! He convertido «${concepts[0]?.term ?? "tu temario"}» y ${stats.conceptos - 1} conceptos más en retos para todos los mundos.`}
      />

      <button
        onClick={onContinuar}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-nexus px-6 py-4 text-base font-bold text-primary-foreground glow-primary transition hover:scale-[1.02]"
      >
        <Sparkles className="h-5 w-5" /> Ver mi aventura
        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
      </button>
    </motion.div>
  );
}

function ResumenDemo({ onContinuar }: { onContinuar: () => void }) {
  const conceptos = getSampleConcepts();
  const objetivos = getMissions("bosque").map((m) => ({ id: m.id, title: m.objective, concept: m.concept }));

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <section className="rounded-3xl border border-border bg-card/70 p-5 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-energy text-energy-foreground">
            <Brain className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold leading-tight">Conceptos del contenido de ejemplo</h2>
            <p className="text-xs text-muted-foreground">{conceptos.length} ideas de la demo de {SUBJECT.topic}</p>
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {conceptos.map((c, i) => (
            <motion.li
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-background/50 p-3"
            >
              <p className="text-sm font-semibold text-accent">{c.term}</p>
              <p className="text-xs leading-snug text-muted-foreground">{c.definition}</p>
            </motion.li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-border bg-card/70 p-5 backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-nexus text-primary-foreground">
            <Target className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold leading-tight">Objetivos de tu aventura</h2>
            <p className="text-xs text-muted-foreground">Retos del Bosque con este contenido</p>
          </div>
        </div>
        <ol className="space-y-2">
          {objetivos.map((o, i) => (
            <motion.li
              key={o.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              className="flex items-start gap-3 rounded-2xl border border-border bg-background/50 p-3"
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-black text-primary">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{o.title}</p>
                <p className="text-xs text-muted-foreground">Concepto: {o.concept}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </section>

      <NovaBubble
        mood="hint"
        message="Este es el contenido de ejemplo de la demo. Sube tu propio documento en la biblioteca y los retos preguntarán sobre TU temario."
      />

      <button
        onClick={onContinuar}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-nexus px-6 py-4 text-base font-bold text-primary-foreground glow-primary transition hover:scale-[1.02]"
      >
        <Sparkles className="h-5 w-5" /> Ver mi aventura
        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
      </button>
    </motion.div>
  );
}
