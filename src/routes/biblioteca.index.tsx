import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileText, Sparkles, FlaskConical, CheckCircle2, CloudCheck, Target, Loader2 } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameHud } from "@/components/hud/GameHud";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAuthStore } from "@/store/useAuthStore";
import { getSampleDocuments, getSubject } from "@/services/gameService";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/biblioteca/")({
  component: Biblioteca,
});

const SAMPLE_DOCS = getSampleDocuments();
const SUBJECT = getSubject();

type ReceivedDoc = {
  name: string;
  /** File size in bytes (only for real uploads/local files, not sample docs). */
  size: number | null;
  /** Where the doc came from. */
  source: "sample" | "file";
  /** Whether it was persisted to the user's cloud storage. */
  cloudSaved: boolean;
};

function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toUpperCase() : "DOC";
}

function formatSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Biblioteca() {
  const navigate = useNavigate();
  const setDocument = usePlayerStore((s) => s.setDocument);
  const user = useAuthStore((s) => s.user);
  const [drag, setDrag] = useState(false);
  const [received, setReceived] = useState<ReceivedDoc | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickSample(name: string) {
    setReceived({ name, size: null, source: "sample", cloudSaved: false });
    setDocument(name);
  }

  // Real upload for signed-in users: store the file in the private `documents`
  // bucket and register it in the `documents` table. Guests just get the local
  // demo flow (nothing leaves the device).
  async function handleFile(file: File) {
    setDocument(file.name);
    // Confirm reception immediately; the cloud badge updates once persisted.
    setReceived({ name: file.name, size: file.size, source: "file", cloudSaved: false });
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
    if (!received) return;
    navigate({ to: "/biblioteca/analizando/$docId", params: { docId: "demo" } });
  }

  return (
    <div className="relative min-h-screen">
      <StarField />
      <GameHud />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <NovaBubble mood="hint" message={`En esta demo trabajamos con ${SUBJECT.area} sobre "${SUBJECT.topic}". Sube tus apuntes y prepararé retos orientados a ese contenido. (De momento el análisis es simulado, aún sin IA real.)`} />
        </div>

        <h1 className="mb-1 text-3xl font-black">Biblioteca Nexus</h1>
        <p className="mb-3 text-muted-foreground">Sube tu documento de estudio y conviértelo en misión.</p>

        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-energy/50 bg-energy/10 px-4 py-1.5 text-xs font-semibold text-energy">
          <FlaskConical className="h-3.5 w-3.5" />
          Demo jugable · {SUBJECT.area} — {SUBJECT.topic}
        </div>

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
            accept=".pdf,.docx,.txt"
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
                ? "o haz clic para elegir un archivo (PDF, DOCX, TXT) — se guardará en tu nube"
                : "o haz clic para elegir un archivo (PDF, DOCX, TXT)"}
            </p>
          </div>
        </motion.div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-muted-foreground">O prueba con un apunte de ejemplo de esta demo:</p>
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

              {/* Qué pasará: los retos se orientarán al contenido recibido */}
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {SAMPLE_DOCS.includes(received.name)
                    ? <>Los retos se orientarán a este apunte: la aventura demo de <span className="font-semibold text-foreground">{SUBJECT.area} — {SUBJECT.topic}</span> (análisis simulado, sin IA real todavía).</>
                    : <>Tus retos se orientarán al contenido de este documento. En esta demo jugarás la aventura de <span className="font-semibold text-foreground">{SUBJECT.topic}</span> para que veas cómo funcionará cuando la IA analice tus apuntes.</>}
                </p>
              </div>

              <button
                onClick={analyze}
                disabled={uploading}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-nexus px-6 py-3.5 font-bold text-primary-foreground glow-primary transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                <Sparkles className="h-5 w-5" /> Generar retos con este contenido
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
