import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, Map, Trophy, User, Swords, Compass, Sparkles } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameHud } from "@/components/hud/GameHud";
import { GameButton } from "@/components/game/GameButton";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { SystemScreen } from "@/components/game/SystemScreen";
import { usePlayerStore, usePlayerHydrated } from "@/store/usePlayerStore";
import { ARTBOOK } from "@/lib/artbook";

export const Route = createFileRoute("/hub")({
  component: Hub,
});

const TILES = [
  { to: "/biblioteca", title: "Biblioteca Nexus", desc: "Sube tus apuntes y crea aventuras", icon: BookOpen, grad: "bg-gradient-energy", glow: "hover:glow-energy" },
  { to: "/mundo/bosque", title: "Misiones", desc: "Retos activos del Bosque", icon: Compass, grad: "bg-gradient-nexus", glow: "hover:glow-primary" },
  { to: "/mapa", title: "Mapa de Mundos", desc: "Explora y desbloquea zonas", icon: Map, grad: "bg-gradient-nexus", glow: "hover:glow-primary" },
  { to: "/ranking", title: "Ranking Semanal", desc: "Compite con tu clase", icon: Trophy, grad: "bg-gradient-gold", glow: "hover:glow-gold" },
  { to: "/perfil", title: "Tu Perfil", desc: "Progreso, logros y cristales", icon: User, grad: "bg-gradient-void", glow: "hover:glow-violet" },
] as const;

function Hub() {
  const hydrated = usePlayerHydrated();
  const { hasProfile, avatar, documentName } = usePlayerStore();
  const customContent = usePlayerStore((s) => s.customContent);

  // Wait for persisted state so a returning Aspirante isn't bounced to
  // avatar creation before their profile rehydrates from localStorage.
  if (!hydrated) {
    return (
      <SystemScreen
        spin
        tone="primary"
        title="Nova está calibrando el Núcleo…"
        message="Preparando tu Nexus. Esto solo tarda un instante."
      />
    );
  }

  // No Aspirante yet: warm gate instead of a silent redirect.
  if (!hasProfile) {
    return (
      <SystemScreen
        icon="🧭"
        tone="primary"
        title="Crea tu Aspirante para entrar al Nexus"
        message="Aún no tienes un héroe en Cracks Academy. Diseña tu Aspirante y Nova te acompañará en la aventura."
        novaMessage="En menos de un minuto tendrás tu avatar listo para cruzar los primeros portales."
      >
        <Link
          to="/crear-avatar"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-nexus px-6 py-3.5 font-bold text-primary-foreground glow-primary transition hover:scale-[1.02]"
        >
          <Sparkles className="h-4 w-4" /> Crear mi Aspirante
        </Link>
      </SystemScreen>
    );
  }


  return (
    <div className="relative min-h-screen overflow-hidden">
      <StarField />
      {/* Atmósfera del Art Bible: Key Art tenue como fondo del centro de mando */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src={ARTBOOK.keyArt}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="h-full w-full object-cover object-top opacity-[0.1]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
      </div>

      <GameHud />
      <main className="relative mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <NovaBubble
            message={
              documentName
                ? `¿Listo para otra misión, ${avatar.name}? El mapa te espera.`
                : `¡Hola ${avatar.name}! Empieza subiendo tus apuntes en la Biblioteca Nexus.`
            }
          />
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-accent backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" /> Centro de mando
        </span>
        <h1 className="mt-2 mb-1 text-3xl font-black">Hub Cracks Academy</h1>
        <p className="mb-6 text-muted-foreground">Elige a dónde quieres ir, Aspirante.</p>

        {/* Temario activo: el juego pregunta sobre TU contenido. Si aún no hay
            documento, esto es la llamada principal antes de entrar a jugar. */}
        {customContent ? (
          <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-energy/40 bg-energy/5 p-4 backdrop-blur sm:flex-row sm:items-center">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-energy text-energy-foreground">
              <BookOpen className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-energy">Temario activo</p>
              <p className="truncate font-bold">{customContent.docName}</p>
              <p className="text-xs text-muted-foreground">
                {customContent.stats.conceptos} conceptos · {customContent.stats.preguntas} preguntas · los retos de todos los mundos usan este contenido.
              </p>
            </div>
            <Link to="/biblioteca" className="shrink-0">
              <GameButton variant="ghost" size="sm">Cambiar temario</GameButton>
            </Link>
          </div>
        ) : (
          <div className="mb-6 flex flex-col gap-3 rounded-3xl border-2 border-primary/50 bg-primary/5 p-5 backdrop-blur glow-primary sm:flex-row sm:items-center">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-energy text-energy-foreground">
              <BookOpen className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-accent">Antes de jugar</p>
              <p className="text-lg font-black leading-tight">Sube tu temario y el juego preguntará sobre él</p>
              <p className="text-sm text-muted-foreground">
                PDF, Word, texto… Nova lo analiza en tu dispositivo y convierte tus apuntes en los retos de los 7 mundos.
                Sin subirlo, jugarás con el contenido de ejemplo.
              </p>
            </div>
            <Link to="/biblioteca" className="shrink-0">
              <GameButton variant="primary">Subir mi temario</GameButton>
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {TILES.map((t, i) => (
            <motion.div
              key={t.to}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                to={t.to}
                className={`group relative flex items-center gap-4 overflow-hidden rounded-3xl border border-border bg-card/60 p-5 backdrop-blur bevel-highlight transition hover:-translate-y-1 hover:border-primary/60 ${t.glow}`}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px frame-metal opacity-70"
                />
                <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${t.grad} text-primary-foreground`}>
                  <t.icon className="h-7 w-7" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold">{t.title}</p>
                  <p className="text-sm text-muted-foreground">{t.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <GameButton asChild variant="primary" size="lg" className="mt-4 w-full">
          <Link to="/mundo/bosque">
            <Swords className="h-5 w-5" /> Ir directo a tu misión activa
          </Link>
        </GameButton>
      </main>
    </div>
  );
}
