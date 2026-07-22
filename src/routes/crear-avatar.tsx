import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { StarField } from "@/components/game/StarField";
import { AvatarDisc } from "@/components/game/AvatarDisc";
import { GameFrame } from "@/components/game/GameFrame";
import { GameButton } from "@/components/game/GameButton";
import { ClassBadge } from "@/components/game/ClassBadge";
import { NovaBubble } from "@/components/hud/NovaBubble";
import { NovaAvatar } from "@/components/hud/NovaAvatar";
import { getPlayerClasses, getAvatarOptions, getCompanions, getWorlds } from "@/services/gameService";
import { usePlayerStore } from "@/store/usePlayerStore";
import { ARTBOOK, heroPortrait } from "@/lib/artbook";

import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PLAYER_CLASSES = getPlayerClasses();
const COMPANIONS = getCompanions();
const WORLDS = getWorlds();
const { colors: AVATAR_COLORS, hair: AVATAR_HAIR, outfits: AVATAR_OUTFITS, emblem: AVATAR_EMBLEM } = getAvatarOptions();

// Valores legado internos: los campos siguen en el store/Cloud por compatibilidad,
// pero ya no se personalizan en la UI (el héroe visual lo define la clase).
const LEGACY_HAIR = AVATAR_HAIR[0].value;
const LEGACY_OUTFIT = AVATAR_OUTFITS[0].value;
const LEGACY_EMBLEM = AVATAR_EMBLEM[0].value;

export const Route = createFileRoute("/crear-avatar")({
  component: CreateAvatar,
});

function CreateAvatar() {
  const navigate = useNavigate();
  const createProfile = usePlayerStore((s) => s.createProfile);

  const [name, setName] = useState("");
  const [classId, setClassId] = useState(PLAYER_CLASSES[0].id);
  const [color, setColor] = useState(PLAYER_CLASSES[0].color);

  const cls = PLAYER_CLASSES.find((c) => c.id === classId)!;
  const nova = COMPANIONS[0];

  function confirm() {
    const finalName = name.trim() || "Aspirante";
    createProfile({
      name: finalName,
      classId,
      base: cls.emoji,
      color,
      // Legado interno: se conservan para no romper el modelo, sin exponerse en UI.
      hair: LEGACY_HAIR,
      outfit: LEGACY_OUTFIT,
      emblem: LEGACY_EMBLEM,
      companion: nova.id,
    });
    toast.success(`¡Bienvenido a Nexus, ${finalName}!`, { description: `${nova.name} se ha unido a tu equipo.` });
    // El temario va ANTES de jugar: así los retos preguntan sobre lo que el
    // Aspirante estudia de verdad, no sobre el contenido de ejemplo.
    navigate({ to: "/biblioteca" });
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <StarField />
      {/* Atmósfera del Art Bible: lámina oficial de Selección de Clase muy tenue */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src={ARTBOOK.classSelection}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="h-full w-full object-cover object-top opacity-[0.12]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-10">
        <div className="text-center">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent backdrop-blur glow-primary">
            <Sparkles className="h-3.5 w-3.5" /> Selección de Héroe
          </span>
          <h1 className="text-3xl font-black sm:text-4xl">
            Elige tu <span className="text-gradient-nexus">Aspirante</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Escoge tu héroe, dale nombre y prepárate para cruzar los portales del Nexus.</p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr_1fr]">
          {/* Columna izquierda — Identidad esencial */}
          <GameFrame className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold">Nombre de Aspirante</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                placeholder="Escribe tu nombre de héroe"
                className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </div>

            <OptionRow label="Color principal">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setColor(c.value)}
                  aria-label={c.label}
                  className={cn(
                    "h-11 w-11 rounded-full border-2 transition hover:scale-110",
                    color === c.value ? "ring-2 ring-offset-2 ring-offset-background" : "",
                  )}
                  style={{ background: c.value, borderColor: c.value }}
                />
              ))}
            </OptionRow>
            <p className="text-xs text-muted-foreground">
              El color principal define el aura de tu héroe y el acento de tu perfil.
            </p>

            <div className="pt-2">
              <NovaBubble message="Ponte un buen nombre y elige tu color. ¡Tu clase define quién serás en el Nexus!" mood="hint" />
            </div>
          </GameFrame>

          {/* Centro — Preview grande del héroe */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <GameFrame glow="primary" className="flex flex-col items-center gap-6 p-8">
              <div
                className="grid place-items-center rounded-full p-4"
                style={{
                  background: `radial-gradient(circle, color-mix(in oklab, ${color} 34%, transparent), transparent 70%)`,
                }}
              >
                <AvatarDisc base={cls.emoji} color={color} image={heroPortrait(classId)} size={200} className="animate-float-slow" />
              </div>
              <div className="text-center">
                <p className="text-xs uppercase tracking-widest" style={{ color }}>{cls.name}</p>
                <p className="text-3xl font-black" style={{ color }}>{name.trim() || "Sin nombre"}</p>
                {cls.role ? <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{cls.role}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{cls.perk}</p>
              </div>
            </GameFrame>
          </motion.div>

          {/* Columna derecha — Clase, ficha, Nova y CTA */}
          <GameFrame className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold">Elige tu clase</label>
              <div className="grid grid-cols-2 gap-2">
                {PLAYER_CLASSES.map((c) => (
                  <ClassBadge
                    key={c.id}
                    emoji={c.emoji}
                    name={c.name}
                    tagline={c.tagline}
                    color={c.color}
                    image={heroPortrait(c.id)}
                    selected={classId === c.id}
                    onClick={() => { setClassId(c.id); setColor(c.color); }}
                  />
                ))}
              </div>
            </div>

            {/* Ficha de clase — identidad de la elección */}
            <div
              className="rounded-2xl border-2 p-4"
              style={{
                borderColor: `color-mix(in oklab, ${cls.color} 55%, transparent)`,
                background: `linear-gradient(140deg, color-mix(in oklab, ${cls.color} 14%, transparent), transparent)`,
                boxShadow: `0 0 24px -12px ${cls.color}`,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-2xl"
                  style={{ background: "oklch(0.16 0.045 275)", border: `1.5px solid ${cls.color}` }}
                >
                  <img src={heroPortrait(cls.id)} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
                </span>
                <div className="min-w-0">
                  <p className="font-bold leading-tight">{cls.name}</p>
                  {cls.role ? <p className="text-[11px] font-semibold text-muted-foreground">{cls.role}</p> : null}
                </div>
              </div>
              {cls.description ? <p className="mt-3 text-sm text-foreground/90">{cls.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-1 text-accent">
                  <Sparkles className="h-3 w-3" aria-hidden="true" /> {cls.perk}
                </span>
                {cls.worldAffinity ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-1 text-muted-foreground">
                    Afinidad: {WORLDS.find((w) => w.id === cls.worldAffinity)?.name ?? cls.worldAffinity}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Companion panel — Nova */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-primary/60 bg-primary/10 p-4 ring-1 ring-ring/30">
              <div
                className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl"
                style={{ background: "radial-gradient(circle, oklch(0.72 0.16 230 / 0.55), transparent 70%)" }}
              />
              <div className="relative flex items-center gap-4">
                <NovaAvatar size={88} />

                <div className="min-w-0">
                  <p className="text-lg font-black leading-tight">{nova.name}</p>
                  <p className="text-xs font-semibold text-accent">Tu companion del Nexus</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Te acompañará en cada misión, te dará pistas y celebrará tus logros.
                  </p>
                </div>
              </div>
            </div>

            <GameButton onClick={confirm} variant="primary" size="lg" className="w-full">
              Comenzar aventura
              <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
            </GameButton>
          </GameFrame>
        </div>
      </div>
    </div>
  );
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}</label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
