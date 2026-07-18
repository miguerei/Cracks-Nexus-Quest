import { cn } from "@/lib/utils";
import { NovaAvatar } from "@/components/hud/NovaAvatar";
import type { DialogueLine, SpeakerKind } from "./types";

/**
 * SpeakerPortrait — retrato del hablante en la caja de diálogo.
 *
 * Para Nova reutiliza su avatar oficial; para el resto muestra el emoji del
 * hablante dentro de un disco con el aura del tipo (aliado, rival, Vacío…).
 */
const KIND_RING: Record<SpeakerKind, string> = {
  nova: "border-accent/60",
  hero: "border-primary/70 bg-gradient-nexus text-primary-foreground",
  ally: "border-accent/60 bg-card text-accent",
  rival: "border-gold/70 bg-gradient-gold text-background",
  void: "border-destructive/60 bg-gradient-void text-secondary-foreground",
};

export function SpeakerPortrait({ line, size = 56 }: { line: DialogueLine; size?: number }) {
  const kind = line.kind ?? "ally";

  if (kind === "nova") {
    return <NovaAvatar variant="icon" size={size} float className="shadow-deep" />;
  }

  if (line.portrait) {
    return (
      <span
        className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border-2 bevel-highlight", KIND_RING[kind])}
        style={{ width: size, height: size }}
      >
        <img src={line.portrait} alt={line.speaker} loading="lazy" className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-2xl border-2 bevel-highlight text-2xl leading-none", KIND_RING[kind])}
      style={{ width: size, height: size }}
    >
      {line.emoji ?? "💬"}
    </span>
  );
}
