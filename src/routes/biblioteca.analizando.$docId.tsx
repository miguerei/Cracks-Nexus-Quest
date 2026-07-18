import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Sparkles, Brain, Target, FlaskConical, ArrowRight } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { getAnalysisSteps, getConcepts, getMissions, getSubject } from "@/services/gameService";
import { usePlayerStore } from "@/store/usePlayerStore";

const ANALYSIS_STEPS = getAnalysisSteps();
const CONCEPTS = getConcepts();
const SUBJECT = getSubject();
// Objetivos de la aventura derivados de las misiones reales del Bosque, para que
// el "análisis" simulado sea coherente con lo que el jugador jugará después.
const OBJECTIVES = getMissions("bosque").map((m) => ({
  id: m.id,
  title: m.objective,
  concept: m.concept,
}));

export const Route = createFileRoute("/biblioteca/analizando/$docId")({
  component: Analyzing,
});

function Analyzing() {
  const navigate = useNavigate();
  const { docId } = Route.useParams();
  const documentName = usePlayerStore((s) => s.documentName) ?? "tus apuntes";
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= ANALYSIS_STEPS.length) {
          clearInterval(id);
          // En vez de saltar directo a la aventura, revelamos el resumen del
          // análisis simulado (conceptos + objetivos) y dejamos que el jugador
          // continúe cuando quiera.
          setDone(true);
          return s;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-screen px-4 py-10">
      <StarField />
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full bg-gradient-nexus text-4xl glow-primary animate-pulse-glow">
            🌟
          </div>
          <h1 className="text-2xl font-black">{done ? "Análisis completado" : "Nova está analizando"}</h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {done
              ? <>Nova ha preparado un resumen a partir de <span className="font-semibold text-foreground">{documentName}</span>.</>
              : "Procesando tu documento… (análisis simulado, sin IA real)"}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-energy/50 bg-energy/10 px-3 py-1 text-[11px] font-semibold text-energy">
            <FlaskConical className="h-3 w-3" /> Análisis simulado · {SUBJECT.area} — {SUBJECT.topic}
          </div>
        </div>

        {!done && (
          <div className="space-y-3">
            {ANALYSIS_STEPS.map((s, i) => {
              const stepDone = i < step;
              const active = i === step;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: stepDone || active ? 1 : 0.4 }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-background">
                    {stepDone ? (
                      <Check className="h-5 w-5 text-energy" />
                    ) : active ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{i + 1}</span>
                    )}
                  </span>
                  <div>
                    <p className="font-semibold">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.detail}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* Conceptos clave detectados (simulado) */}
              <section className="rounded-3xl border border-border bg-card/70 p-5 backdrop-blur">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-energy text-energy-foreground">
                    <Brain className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-bold leading-tight">Conceptos clave</h2>
                    <p className="text-xs text-muted-foreground">{CONCEPTS.length} ideas detectadas en el documento</p>
                  </div>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {CONCEPTS.map((c, i) => (
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

              {/* Objetivos posibles para la aventura */}
              <section className="rounded-3xl border border-border bg-card/70 p-5 backdrop-blur">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-nexus text-primary-foreground">
                    <Target className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-bold leading-tight">Objetivos de tu aventura</h2>
                    <p className="text-xs text-muted-foreground">Retos sugeridos a partir de estos conceptos</p>
                  </div>
                </div>
                <ol className="space-y-2">
                  {OBJECTIVES.map((o, i) => (
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
                mood="celebrate"
                message="He convertido tus apuntes en una aventura demo de la célula. ¡Estos son los retos que te esperan!"
              />

              <button
                onClick={() => navigate({ to: "/biblioteca/aventura/$docId", params: { docId } })}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-nexus px-6 py-4 text-base font-bold text-primary-foreground glow-primary transition hover:scale-[1.02]"
              >
                <Sparkles className="h-5 w-5" /> Ver mi aventura
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
