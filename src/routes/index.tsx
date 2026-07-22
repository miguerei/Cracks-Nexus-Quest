import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Swords, Trophy, Gem, ArrowRight, Globe, BookOpen, Crown } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameButton } from "@/components/game/GameButton";
import { GameFrame } from "@/components/game/GameFrame";
import { IntroVideo } from "@/components/game/IntroVideo";
import { ARTBOOK } from "@/lib/artbook";
import { usePlayerStore } from "@/store/usePlayerStore";

// Imagen para compartir (WhatsApp/Twitter): absoluta sobre el dominio de
// producción propio — la portada vive en public/og-cover.jpg.
const OG_IMAGE = "https://cracks-game-eta.vercel.app/og-cover.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Cracks Academy: Nexus Quest — Aprende jugando" },
      {
        name: "description",
        content:
          "Crea tu Aspirante, sube tus apuntes y conviértelos en una aventura. Desbloquea mundos, gana cristales y domina el ranking en el RPG educativo Nexus Quest.",
      },
      { property: "og:title", content: "Cracks Academy: Nexus Quest" },
      {
        property: "og:description",
        content:
          "El RPG educativo donde tus apuntes se convierten en misiones. Juega, desbloquea mundos y domina el ranking.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Landing() {
  const hasProfile = usePlayerStore((s) => s.hasProfile);
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {showIntro && <IntroVideo onFinish={() => navigate({ to: "/crear-avatar" })} />}
      <StarField />

      {/* Hero — Key Art oficial del Art Bible como portada cinematográfica */}
      <section className="relative">
        <div className="absolute inset-0">
          <img
            src={ARTBOOK.keyArt}
            alt="Key Art de Nexus Quest: héroes adolescentes, Nova y cristales de energía frente al Vacío"
            fetchPriority="high"
            loading="eager"
            className="h-full w-full object-cover object-top opacity-70"
          />
          {/* Fundido para legibilidad y aire cinematográfico */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/70 to-background" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent backdrop-blur glow-primary"
          >
            <Sparkles className="h-3.5 w-3.5" /> Cracks Academy presenta
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-5xl font-black leading-none drop-shadow-[0_4px_24px_oklch(0.16_0.045_275)] sm:text-7xl"
          >
            NEXUS <span className="text-gradient-nexus">QUEST</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-5 max-w-xl text-lg text-muted-foreground sm:text-xl"
          >
            Entra, juega, desbloquea mundos y sube de rango. Tus apuntes se
            convierten en aventuras. Demuestra que eres el mejor Crack.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
          >
            {hasProfile ? (
              <GameButton asChild variant="primary" size="lg">
                <Link to="/hub">
                  Continuar aventura
                  <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                </Link>
              </GameButton>
            ) : (
              <GameButton variant="primary" size="lg" onClick={() => setShowIntro(true)}>
                Entrar en Cracks Academy
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </GameButton>
            )}
            {hasProfile && (
              <GameButton asChild variant="ghost" size="lg">
                <Link to="/ranking">
                  <Trophy className="h-4 w-4" /> Ver ranking
                </Link>
              </GameButton>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-14 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <Feature icon={<Sparkles className="h-5 w-5" />} label="Crea tu avatar" />
            <Feature icon={<Swords className="h-5 w-5" />} label="Minijuegos" />
            <Feature icon={<Gem className="h-5 w-5" />} label="Cristales y cofres" />
            <Feature icon={<Trophy className="h-5 w-5" />} label="Ranking" />
          </motion.div>
        </div>
      </section>

      {/* Lore */}
      <section className="relative mx-auto max-w-4xl px-4 pb-24">
        <GameFrame glow="violet" className="p-6 sm:p-10">
          <h2 className="text-2xl font-bold sm:text-3xl">
            El <span style={{ color: "var(--void)" }}>Vacío</span> corrompe los Núcleos del Saber
          </h2>
          <p className="mt-4 text-muted-foreground">
            En el universo de Nexus, el conocimiento se materializa en cristales,
            portales y mapas. Una fuerza llamada El Vacío —la distracción, el
            olvido, la confusión— está corrompiendo el saber. Cracks Academy te
            recluta como Aspirante. Tu misión: convertirte en Guardián del
            Conocimiento junto a Nova, tu compañero de energía.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: <Globe className="h-5 w-5 text-primary" />, t: "Explora mundos", d: "Del Bosque del Descubrimiento a la Fortaleza del Vacío." },
              { icon: <BookOpen className="h-5 w-5 text-accent" />, t: "Sube tus apuntes", d: "Nova los transforma en retos jugables." },
              { icon: <Crown className="h-5 w-5 text-gold" />, t: "Domina el ranking", d: "Ligas de Bronce a Leyenda, competición sana." },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-border bg-background/40 p-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-card/70">{c.icon}</span>
                <p className="mt-2 font-semibold">{c.t}</p>
                <p className="text-sm text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
        </GameFrame>
      </section>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/50 p-4 backdrop-blur bevel-highlight">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-nexus text-primary-foreground glow-primary">
        {icon}
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}
