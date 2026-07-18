import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, Brain, Swords, Gauge, ArrowRight } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameHud } from "@/components/hud/GameHud";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { getConcepts, getSubject } from "@/services/gameService";
import { usePlayerStore } from "@/store/usePlayerStore";

export const Route = createFileRoute("/biblioteca/aventura/$docId")({
  component: Adventure,
});

function Adventure() {
  const documentName = usePlayerStore((s) => s.documentName) ?? "tus apuntes";
  const MOCK_CONCEPTS = getConcepts();
  const SUBJECT = getSubject();


  return (
    <div className="relative min-h-screen">
      <StarField />
      <GameHud />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-energy/50 bg-energy/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-energy">
            <Sparkles className="h-3.5 w-3.5" /> Aventura generada (demo)
          </span>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">
            Misión: <span className="text-gradient-nexus">El Bosque del Descubrimiento</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            En esta demo, <span className="font-semibold text-foreground">{documentName}</span> se convierte en una aventura de{" "}
            <span className="font-semibold text-foreground">{SUBJECT.area}</span> sobre{" "}
            <span className="font-semibold text-foreground">{SUBJECT.topic}</span>.
          </p>
        </motion.div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatCard icon={<Brain className="h-5 w-5" />} big={String(MOCK_CONCEPTS.length)} label="conceptos detectados" grad="bg-gradient-energy" />
          <StatCard icon={<Swords className="h-5 w-5" />} big="5" label="misiones por superar" grad="bg-gradient-nexus" />
          <StatCard icon={<Gauge className="h-5 w-5" />} big={SUBJECT.difficulty} label="dificultad sugerida" grad="bg-gradient-gold" />
        </div>

        <div className="mt-6 rounded-3xl border border-border bg-card/60 p-6 backdrop-blur">
          <h2 className="mb-3 text-lg font-bold">Conceptos que dominarás</h2>
          <div className="flex flex-wrap gap-2">
            {MOCK_CONCEPTS.map((c) => (
              <span key={c.id} className="rounded-full border border-border bg-background/50 px-3 py-1.5 text-sm">
                {c.term}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <NovaBubble mood="celebrate" message="¡Tu aventura está lista! Los portales del Bosque te esperan." />
        </div>

        <Link
          to="/mundo/bosque"
          className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-nexus px-6 py-4 text-base font-bold text-primary-foreground glow-primary transition hover:scale-[1.02]"
        >
          Empezar aventura
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
