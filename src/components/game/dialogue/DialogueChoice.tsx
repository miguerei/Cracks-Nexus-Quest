import { cn } from "@/lib/utils";
import type { DialogueChoiceOption } from "./types";

/**
 * DialogueChoice — lista de elecciones al final de una secuencia de diálogo.
 * Presentacional: cada opción dispara su `onSelect`. Quien lo usa decide qué
 * hace (navegar a un reto, cerrar, ir al ranking…).
 */
const TONE: Record<NonNullable<DialogueChoiceOption["tone"]>, string> = {
  primary: "border-primary/50 bg-primary/10 text-foreground hover:border-primary hover:bg-primary/20",
  gold: "border-gold/50 bg-gold/10 text-gold hover:border-gold hover:bg-gold/20",
  void: "border-destructive/40 bg-destructive/10 text-muted-foreground hover:border-destructive/70",
};

export function DialogueChoice({
  choices,
  onSelect,
}: {
  choices: DialogueChoiceOption[];
  onSelect: (choice: DialogueChoiceOption) => void;
}) {
  return (
    <div className="mt-3 grid gap-2">
      {choices.map((c, i) => (
        <button
          key={`${c.label}-${i}`}
          type="button"
          onClick={() => onSelect(c)}
          className={cn(
            "flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-bold transition",
            TONE[c.tone ?? "primary"],
          )}
        >
          <span className="text-primary">▸</span>
          <span className="min-w-0 flex-1">{c.label}</span>
        </button>
      ))}
    </div>
  );
}
