import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Brain, Swords, Gauge, ArrowRight, Globe2 } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameHud } from "@/components/hud/GameHud";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { getSampleConcepts, getSubject, getWorlds } from "@/services/gameService";
import { usePlayerStore } from "@/store/usePlayerStore";
import { MUNDOS_REPARTO } from "@/lib/content/generate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/biblioteca/aventura/$docId")({
  component: Adventure,
});

const ETIQUETA_CALIDAD: Record<string, { texto: string; clase: string }> = {
  rico: { texto: "rico", clase: "text-energy" },
  suficiente: { texto: "suficiente", clase: "text-primary" },
  escaso: { texto: "escaso", clase: "text-destructive" },
};

function Adventure() {
  const documentName = usePlayerStore((s) => s.documentName) ?? "tus apuntes";
  const customContent = usePlayerStore((s) => s.customContent);
  const SUBJECT = getSubject();
  const mundos = getWorlds();
  const nombreMundo = (id: string) => mundos.find((w) => w.id === id)?.name ?? id;

  // Resumen REAL si el alumno generó su temario; si no, resumen de la demo.
  const conceptos = customContent ? customContent.concepts : getSampleConcepts();
  const conceptosVisibles = conceptos.slice(0, 16);

  return (
    <div className="relative min-h-screen">
      <StarField />
      <GameHud />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-energy/50 bg-energy/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-energy">
            <Sparkles className="h-3.5 w-3.5" />
            {customContent ? "Aventura generada con tu temario" : "Aventura con contenido de ejemplo"}
          </span>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">
            Misión: <span className="text-gradient-nexus">{customContent ? "El Nexus con tu temario" : "El Bosque del Descubrimiento"}</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            {customContent ? (
              <>Los retos de los 7 mundos preguntarán sobre{" "}
                <span className="font-semibold text-foreground">{customContent.docName}</span>.</>
            ) : (
              <>Jugarás con el contenido demo de{" "}
                <span className="font-semibold text-foreground">{SUBJECT.area}</span> sobre{" "}
                <span className="font-semibold text-foreground">{SUBJECT.topic}</span>. Sube{" "}
                <span className="font-semibold text-foreground">{documentName === "tus apuntes" ? "tus apuntes" : documentName}</span>{" "}
                reales en la biblioteca para jugar con tu temario.</>
            )}
          </p>
        </motion.div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={<Brain className="h-5 w-5" />}
            big={String(conceptos.length)}
            label="conceptos detectados"
            grad="bg-gradient-energy"
          />
          <StatCard
            icon={<Swords className="h-5 w-5" />}
            big={customContent ? String(customContent.stats.preguntas) : "35"}
            label={customContent ? "preguntas generadas" : "misiones y retos demo"}
            grad="bg-gradient-nexus"
          />
          {customContent ? (
            <div className="rounded-3xl border border-border bg-card/60 p-5 text-center backdrop-blur">
              <span className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-xl bg-gradient-gold text-primary-foreground">
                <Gauge className="h-5 w-5" />
              </span>
              <p className={cn("text-2xl font-black capitalize", ETIQUETA_CALIDAD[customContent.stats.calidad].clase)}>
                {ETIQUETA_CALIDAD[customContent.stats.calidad].texto}
              </p>
              <p className="text-xs text-muted-foreground">material del documento</p>
            </div>
          ) : (
            <StatCard icon={<Gauge className="h-5 w-5" />} big={SUBJECT.difficulty} label="dificultad sugerida" grad="bg-gradient-gold" />
          )}
        </div>

        {customContent?.stats.calidad === "escaso" && (
          <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs leading-relaxed text-muted-foreground">
            Tu documento dio para {customContent.stats.preguntas} preguntas reales: los retos que falten se
            completarán con preguntas de ejemplo (relleno del contenido demo).
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-border bg-card/60 p-6 backdrop-blur">
          <h2 className="mb-3 text-lg font-bold">Conceptos que dominarás</h2>
          <div className="flex flex-wrap gap-2">
            {conceptosVisibles.map((c) => (
              <span key={c.id} className="rounded-full border border-border bg-background/50 px-3 py-1.5 text-sm">
                {c.term}
              </span>
            ))}
            {conceptos.length > conceptosVisibles.length && (
              <span className="rounded-full border border-border bg-background/50 px-3 py-1.5 text-sm text-muted-foreground">
                +{conceptos.length - conceptosVisibles.length} más
              </span>
            )}
          </div>
        </div>

        {customContent && (
          <div className="mt-6 rounded-3xl border border-border bg-card/60 p-6 backdrop-blur">
            <div className="mb-3 flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-bold">Tus preguntas, repartidas por el Nexus</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MUNDOS_REPARTO.map((id) => (
                <span key={id} className="rounded-full border border-border bg-background/50 px-3 py-1.5 text-xs">
                  {nombreMundo(id)} · <span className="font-bold">{customContent.questionsByWorld[id]?.length ?? 0}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <NovaBubble
            mood="celebrate"
            message={
              customContent
                ? "¡Tu aventura está lista! Cada mundo te preguntará sobre tu propio temario."
                : "¡Tu aventura está lista! Los portales del Nexus te esperan."
            }
          />
        </div>

        <Link
          to="/mapa"
          className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-nexus px-6 py-4 text-base font-bold text-primary-foreground glow-primary transition hover:scale-[1.02]"
        >
          Ir al mapa de mundos
          <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
        </Link>
      </main>
    </div>
  );
}

function StatCard({ icon, big, label, grad }: { icon: React.ReactNode; big: string; label: string; grad: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card/60 p-5 text-center backdrop-blur">
      <span className={`mx-auto mb-2 grid h-11 w-11 place-items-center rounded-xl ${grad} text-primary-foreground`}>{icon}</span>
      <p className="text-2xl font-black">{big}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
