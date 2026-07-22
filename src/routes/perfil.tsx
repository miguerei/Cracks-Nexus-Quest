import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Gem, Coins, Flame, FileText, RotateCcw, Sparkles } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { GameHud } from "@/components/hud/GameHud";
import { GameFrame } from "@/components/game/GameFrame";
import { GameButton } from "@/components/game/GameButton";
import { CrystalIcon } from "@/components/game/CrystalIcon";
import { ClassBadge } from "@/components/game/ClassBadge";
import { AvatarDisc } from "@/components/game/AvatarDisc";
import { usePlayerStore, usePlayerDerived, ACHIEVEMENT_LIST } from "@/store/usePlayerStore";
import { getLeagues, xpIntoLevel, getClassById } from "@/services/gameService";
import { ARTBOOK } from "@/lib/artbook";

export const Route = createFileRoute("/perfil")({
  component: Profile,
});

function Profile() {
  const s = usePlayerStore();
  const { level, league } = usePlayerDerived();
  const { current, needed } = xpIntoLevel(s.xp);
  const lg = getLeagues()[league];
  const cls = getClassById(s.avatar.classId);

  // weakConcepts/masteredConcepts store concept names directly from minigames
  const mastered = s.masteredConcepts;
  const weak = s.weakConcepts.filter((w) => !mastered.includes(w));

  return (
    <div className="relative min-h-screen">
      <StarField />
      <GameHud />

      {/* Atmósfera del Key Art (Art Bible), muy tenue para no dañar legibilidad. */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <img
          src={ARTBOOK.keyArt}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="h-full w-full object-cover object-top opacity-[0.08]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Ficha del Aspirante */}
        <GameFrame glow="primary" as="header">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent">Ficha de Aspirante</p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <AvatarDisc base={s.avatar.base} color={s.avatar.color} hair={s.avatar.hair} outfit={s.avatar.outfit} emblem={s.avatar.emblem} size={96} />
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-black">{s.avatar.name}</h1>
                <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${lg.color}22`, color: lg.color }}>{lg.name}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold" style={{ color: cls.color }}>{cls.emoji} {cls.name}</span> · Nivel {level}
              </p>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>XP</span><span>{current}/{needed}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-energy" style={{ width: `${(current / needed) * 100}%` }} />
                </div>
              </div>
            </div>
            {/* Insignia de clase como gema/cristal (Art Bible) */}
            <ClassBadge
              emoji={cls.emoji}
              name={cls.name}
              color={cls.color}
              selected
              className="w-full shrink-0 sm:w-40"
            />
          </div>
        </GameFrame>

        {/* Currencies */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<CrystalIcon kind="crystal" size="sm" />} value={s.crystals} label="Cristales" />
          <Stat icon={<CrystalIcon kind="coin" size="sm" />} value={s.coins} label="Monedas" />
          <Stat icon={<CrystalIcon kind="points" size="sm" />} value={s.nexos} label="Nexos" />
          <Stat icon={<CrystalIcon kind="xp" size="sm" />} value={s.streak} label="Racha" />
        </div>

        {/* Concept mastery */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Panel title="Conceptos fuertes" empty="Aún no dominas conceptos. ¡Juega un reto!" items={mastered} tone="energy" />
          <Panel title="Conceptos débiles" empty="Sin conceptos débiles. ¡Buen trabajo!" items={weak} tone="destructive" />
        </div>

        {/* Achievements */}
        <GameFrame glow="gold" className="mt-6">
          <h2 className="mb-3 text-lg font-bold">Logros</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {ACHIEVEMENT_LIST.map((a) => {
              const unlocked = s.achievements.includes(a.id);
              return (
                <div key={a.id} title={a.desc} className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center bevel-highlight ${unlocked ? "border-gold/50 bg-gold/10 glow-gold" : "border-border bg-background/40 opacity-50 grayscale"}`}>
                  <span className="text-2xl">{a.emoji}</span>
                  <span className="text-[10px] font-semibold leading-tight">{a.name}</span>
                </div>
              );
            })}
          </div>
        </GameFrame>

        {/* Documents + history */}
        <GameFrame className="mt-6">
          <h2 className="mb-3 text-lg font-bold">Actividad</h2>
          {s.documentName ? (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-background/40 p-3 text-sm">
              <FileText className="h-4 w-4 text-energy" /> {s.documentName}
            </div>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">Aún no has subido documentos.</p>
          )}
          {s.attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin misiones jugadas todavía.</p>
          ) : (
            <ul className="space-y-2">
              {s.attempts.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-xl bg-background/40 px-3 py-2 text-sm">
                  <span className="font-semibold">{a.game}</span>
                  <span className="text-muted-foreground">{a.correct}/{a.total} · +{a.xp} XP</span>
                </li>
              ))}
            </ul>
          )}
        </GameFrame>

        <div className="mt-6 flex flex-wrap gap-3">
          <GameButton asChild variant="primary">
            <Link to="/biblioteca">
              <Sparkles className="h-4 w-4" /> Subir nuevo documento
            </Link>
          </GameButton>
          <GameButton
            variant="ghost"
            onClick={() => {
              // QA M2: borra TODO el progreso y el temario; exige confirmación.
              if (window.confirm("¿Reiniciar la demo? Se borrará TODO tu progreso, tus divisas y el temario subido. Esta acción no se puede deshacer.")) {
                s.resetAll();
              }
            }}
          >
            <RotateCcw className="h-4 w-4" /> Reiniciar demo
          </GameButton>
        </div>
      </main>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <GameFrame className="p-4 text-center">
      <div className="mx-auto mb-1 grid place-items-center">{icon}</div>
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </GameFrame>
  );
}

function Panel({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: "energy" | "destructive" }) {
  return (
    <GameFrame glow={tone === "energy" ? "energy" : "none"}>
      <h3 className="mb-3 font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((c, idx) => (
            <motion.span
              key={c + idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-full border px-3 py-1 text-sm ${tone === "energy" ? "border-energy/50 bg-energy/10 text-energy" : "border-destructive/50 bg-destructive/10 text-destructive"}`}
            >
              {c}
            </motion.span>
          ))}
        </div>
      )}
    </GameFrame>
  );
}
