import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  CloudCheck,
  Target,
  Loader2,
  ClipboardPaste,
  BookOpenCheck,
  RotateCcw,
} from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameHud } from "@/components/hud/GameHud";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAuthStore } from "@/store/useAuthStore";
import { getSampleDocuments, getSubject, getWorlds } from "@/services/gameService";
import { setPendingSource } from "@/lib/content/pending";
import { formatoDeArchivo } from "@/lib/content/extract";
import { MUNDOS_REPARTO } from "@/lib/content/generate";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/biblioteca/")({
  component: Biblioteca,
});

const SAMPLE_DOCS = getSampleDocuments();
const SUBJECT = getSubject();
/** Mínimo de caracteres para que el análisis heurístico tenga material. */
const MIN_TEXTO_PEGADO = 200;
/** Texto pegado por debajo de esto: se avisa de material escaso (Fase 11). */
const TEXTO_PEGADO_HOLGADO = 1800;
/** Tope razonable de archivo: por encima, el navegador sufre (Fase 11). */
const MAX_BYTES = 40 * 1024 * 1024;

type ReceivedDoc = {
  name: string;
  /** File size in bytes (only for real uploads/local files, not sample docs). */
  size: number | null;
  /** Where the doc came from. */
  source: "sample" | "file";
  /** Whether it was persisted to the user's cloud storage. */
  cloudSaved: boolean;
  /** El archivo real, para extraer su texto al analizar. */
  file?: File;
};

function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toUpperCase() : "DOC";
}

const WORLDS = getWorlds();
const nombreMundo = (id: string) => WORLDS.find((w) => w.id === id)?.name ?? id;

function formatSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Biblioteca() {
  const navigate = useNavigate();
  const setDocument = usePlayerStore((s) => s.setDocument);
  const customContent = usePlayerStore((s) => s.customContent);
  const clearCustomContent = usePlayerStore((s) => s.clearCustomContent);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<"archivo" | "pegar">("archivo");
  const [drag, setDrag] = useState(false);
  const [received, setReceived] = useState<ReceivedDoc | null>(null);
  const [textoPegado, setTextoPegado] = useState("");
  const [nombrePegado, setNombrePegado] = useState("");
  const [uploading, setUploading] = useState(false);
  // Evita dobles pulsaciones mientras se navega a la pantalla de análisis
  // (con PDF grandes el usuario tiende a insistir en el botón).
  const [preparando, setPreparando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickSample(name: string) {
    setReceived({ name, size: null, source: "sample", cloudSaved: false });
    setDocument(name);
  }

  // Subida real para usuarios con sesión: guarda el archivo en el bucket
  // privado `documents` y lo registra en la tabla `documents` (best-effort:
  // si falla, el análisis local sigue funcionando igual). Los invitados no
  // suben nada — el documento no sale de su dispositivo.
  async function handleFile(file: File) {
    // Validaciones en español ANTES de aceptar el archivo (Fase 11): formato,
    // fichero vacío y tamaño desmesurado. Nada de errores crípticos después.
    if (!formatoDeArchivo(file.name)) {
      toast.error("Formato no soportado", {
        description: "Usa PDF, DOCX, TXT o MD — o pega el texto directamente.",
      });
      return;
    }
    if (file.size === 0) {
      toast.error("El archivo está vacío", {
        description: "Ese documento ocupa 0 bytes. Elige otro o pega el texto directamente.",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Archivo demasiado grande", {
        description: `Máximo ${Math.round(MAX_BYTES / (1024 * 1024))} MB. Sube solo el tema que vas a estudiar o pega su texto.`,
      });
      return;
    }
    setDocument(file.name);
    // Confirma la recepción al momento; la insignia de nube se actualiza al persistir.
    setReceived({ name: file.name, size: file.size, source: "file", cloudSaved: false, file });
    if (!user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("documents")
        .insert({ user_id: user.id, name: file.name, storage_path: path });
      if (dbErr) throw dbErr;
      setReceived((prev) => (prev ? { ...prev, cloudSaved: true } : prev));
      toast.success("Documento guardado", { description: "Tu apunte quedó a salvo en la nube." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo subir el documento.";
      toast.error("Error al subir", { description: message });
    } finally {
      setUploading(false);
    }
  }

  function analyze() {
    if (!received || preparando) return;
    setPreparando(true);
    if (received.source === "file" && received.file) {
      // Análisis REAL en el dispositivo: la ruta "analizando" extrae el texto
      // y genera los retos con el generador heurístico.
      setPendingSource({ kind: "archivo", file: received.file });
      navigate({ to: "/biblioteca/analizando/$docId", params: { docId: "custom" } });
      return;
    }
    // Apunte de ejemplo: se juega con el contenido demo (sin análisis).
    navigate({ to: "/biblioteca/analizando/$docId", params: { docId: "demo" } });
  }

  function analyzePasted() {
    const texto = textoPegado.trim();
    if (texto.length < MIN_TEXTO_PEGADO || preparando) return;
    setPreparando(true);
    const nombre = nombrePegado.trim() || "Texto pegado";
    setDocument(nombre);
    setPendingSource({ kind: "texto", texto, nombre });
    navigate({ to: "/biblioteca/analizando/$docId", params: { docId: "custom" } });
  }

  return (
    <div className="relative min-h-screen">
      <StarField />
      <GameHud />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <NovaBubble
            mood="hint"
            message="Sube tu temario (PDF, DOCX, TXT o MD) o pega el texto: lo analizo aquí mismo, en tu dispositivo, y convierto sus conceptos en retos para todos los mundos. Sin IA externa: es un análisis heurístico de términos y definiciones."
          />
        </div>

        <h1 className="mb-1 text-3xl font-black">Biblioteca Nexus</h1>
        <p className="mb-3 text-muted-foreground">Sube tu documento de estudio y conviértelo en misión.</p>

        {/* Estado del contenido activo: temario del alumno o ejemplo */}
        {customContent ? (
          <div className="mb-6 rounded-2xl border border-energy/40 bg-energy/10 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <BookOpenCheck className="h-5 w-5 shrink-0 text-energy" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-energy">
                  Jugando con tu temario: {customContent.docName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {customContent.stats.conceptos} conceptos · {customContent.stats.preguntas} preguntas generadas
                  {(customContent.stats.descartadas ?? 0) > 0
                    ? ` · ${customContent.stats.descartadas} descartadas por calidad`
                    : ""}
                </p>
              </div>
              <button
                onClick={() => {
                  clearCustomContent();
                  setReceived(null);
                  toast.success("Contenido de ejemplo restaurado", {
                    description: "Los retos vuelven a usar el contenido demo.",
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-semibold transition hover:border-primary/60"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Volver al contenido de ejemplo
              </button>
            </div>

            {/* Reparto real por mundos: el alumno ve dónde caen SUS preguntas */}
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-energy/20 pt-3">
              {MUNDOS_REPARTO.map((id) => (
                <span
                  key={id}
                  className="rounded-full border border-border bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {nombreMundo(id)} · <span className="font-bold text-foreground">{customContent.questionsByWorld[id]?.length ?? 0}</span>
                </span>
              ))}
            </div>

            {customContent.stats.calidad === "escaso" && (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Material escaso: tu documento dio {customContent.stats.preguntas} preguntas reales, así que algunos
                retos se completarán con preguntas de ejemplo. Sube un temario con más definiciones para jugar solo
                con lo tuyo.
              </p>
            )}
          </div>
        ) : (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Contenido de ejemplo activo · {SUBJECT.area} — {SUBJECT.topic}
          </div>
        )}

        {/* Pestañas: subir archivo / pegar texto */}
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card/40 p-1.5">
          {(
            [
              { id: "archivo", label: "Subir archivo", icon: <UploadCloud className="h-4 w-4" /> },
              { id: "pegar", label: "Pegar texto", icon: <ClipboardPaste className="h-4 w-4" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition",
                tab === t.id ? "bg-gradient-nexus text-primary-foreground glow-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "archivo" && (
          <>
            <motion.div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void handleFile(f);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-4 rounded-3xl border-2 border-dashed p-10 text-center transition",
                drag ? "border-primary bg-primary/10" : "border-border bg-card/40",
              )}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              />
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-energy text-energy-foreground">
                <UploadCloud className="h-8 w-8" />
              </span>
              <div>
                <p className="text-lg font-bold">{uploading ? "Subiendo tu documento…" : "Arrastra tu documento aquí"}</p>
                <p className="text-sm text-muted-foreground">
                  {user
                    ? "o haz clic para elegir un archivo (PDF, DOCX, TXT, MD) — se guardará en tu nube"
                    : "o haz clic para elegir un archivo (PDF, DOCX, TXT, MD)"}
                </p>
              </div>
            </motion.div>

            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold text-muted-foreground">
                O prueba con un apunte de ejemplo (contenido demo, sin análisis):
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SAMPLE_DOCS.map((d) => (
                  <button
                    key={d}
                    onClick={() => pickSample(d)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border bg-card/50 px-3 py-3 text-left text-sm transition hover:border-primary/60",
                      received?.name === d ? "border-primary ring-2 ring-ring/40" : "border-border",
                    )}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-accent" />
                    <span className="truncate">{d}</span>
                  </button>
                ))}
              </div>
            </div>

            {received && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 overflow-hidden rounded-2xl border border-energy/40 bg-card/70 glow-energy"
              >
                {/* Cabecera de confirmación: el archivo se recibió correctamente */}
                <div className="flex items-center gap-3 border-b border-border bg-energy/10 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-energy" />
                  <p className="text-sm font-bold text-energy">Archivo recibido correctamente</p>
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-background/60 text-[10px] font-black text-accent">
                      {fileExt(received.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{received.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {formatSize(received.size) && <span>{formatSize(received.size)}</span>}
                        <span>Formato {fileExt(received.name)}</span>
                        {received.source === "file" && (
                          uploading ? (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" /> Guardando en la nube…
                            </span>
                          ) : received.cloudSaved ? (
                            <span className="inline-flex items-center gap-1 text-energy">
                              <CloudCheck className="h-3.5 w-3.5" /> Guardado en tu nube
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Guardado en este dispositivo</span>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Qué pasará al analizar */}
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {received.source === "sample"
                        ? <>Los apuntes de ejemplo usan el contenido demo de <span className="font-semibold text-foreground">{SUBJECT.area} — {SUBJECT.topic}</span>, sin analizar nada. Para jugar con TU temario, sube un documento real o pega su texto.</>
                        : <>Se extraerá el texto <span className="font-semibold text-foreground">en tu dispositivo</span> y el generador convertirá sus conceptos y definiciones en preguntas para los retos de todos los mundos.</>}
                    </p>
                  </div>

                  <button
                    onClick={analyze}
                    disabled={uploading || preparando}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-nexus px-6 py-3.5 font-bold text-primary-foreground glow-primary transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                  >
                    {preparando ? (
                      <><Loader2 className="h-5 w-5 animate-spin" /> Abriendo el análisis…</>
                    ) : (
                      <><Sparkles className="h-5 w-5" /> Generar retos con este contenido</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </>
        )}

        {tab === "pegar" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-border bg-card/40 p-5"
          >
            <label className="mb-1 block text-sm font-semibold" htmlFor="nombre-temario">
              Nombre del temario
            </label>
            <input
              id="nombre-temario"
              value={nombrePegado}
              onChange={(e) => setNombrePegado(e.target.value)}
              placeholder="P. ej. Tema 3 · La fotosíntesis"
              className="mb-4 w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-primary/60"
            />
            <label className="mb-1 block text-sm font-semibold" htmlFor="texto-temario">
              Pega aquí el texto de tus apuntes
            </label>
            <textarea
              id="texto-temario"
              value={textoPegado}
              onChange={(e) => setTextoPegado(e.target.value)}
              rows={10}
              placeholder="Copia y pega el contenido de tu temario. Cuantas más definiciones tenga («X es…», «Se llama X a…», «Término: definición»), mejores retos saldrán."
              className="w-full resize-y rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm leading-relaxed outline-none transition focus:border-primary/60"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {textoPegado.trim().length < MIN_TEXTO_PEGADO
                ? `${textoPegado.trim().length}/${MIN_TEXTO_PEGADO} caracteres mínimos para analizar`
                : `${textoPegado.trim().length} caracteres — listo para analizar`}
            </p>
            {/* Aviso honesto de material escaso antes de gastar el análisis */}
            {textoPegado.trim().length >= MIN_TEXTO_PEGADO &&
              textoPegado.trim().length < TEXTO_PEGADO_HOLGADO && (
                <p className="mt-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  Material escaso: con este texto saldrán pocas preguntas y algunos retos se completarán con
                  contenido de ejemplo. Pega más apuntes para jugar solo con lo tuyo.
                </p>
              )}
            <button
              onClick={analyzePasted}
              disabled={textoPegado.trim().length < MIN_TEXTO_PEGADO || preparando}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-nexus px-6 py-3.5 font-bold text-primary-foreground glow-primary transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {preparando ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Abriendo el análisis…</>
              ) : (
                <><Sparkles className="h-5 w-5" /> Generar retos con este texto</>
              )}
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
