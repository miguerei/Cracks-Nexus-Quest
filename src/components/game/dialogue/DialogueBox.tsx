import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SpeakerPortrait } from "./SpeakerPortrait";
import type { DialogueLine } from "./types";

/**
 * DialogueBox — caja de diálogo inferior estilo RPG clásico.
 *
 * Presentacional: muestra el retrato del hablante, su nombre y el texto (ya
 * "escrito" por la secuencia con efecto máquina de escribir). Cuando `hasChoices`
 * es false muestra el indicador de continuar (▸) al terminar de escribir.
 */
export function DialogueBox({
  line,
  text,
  typing,
  hasChoices,
  onAdvance,
  children,
}: {
  line: DialogueLine;
  /** Texto ya revelado (subcadena de line.text). */
  text: string;
  typing: boolean;
  hasChoices?: boolean;
  onAdvance?: () => void;
  /** Elecciones a renderizar bajo el texto (DialogueChoice). */
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className={cn(
        "pointer-events-auto w-full rounded-2xl border-2 border-primary/45 bg-background/92 p-3 shadow-deep backdrop-blur-md sm:p-4",
      )}
      onClick={() => !typing && !hasChoices && onAdvance?.()}
      role={hasChoices ? undefined : "button"}
      tabIndex={-1}
    >
      <div className="flex items-start gap-3">
        <SpeakerPortrait line={line} />
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-xs font-black uppercase tracking-wider text-accent">{line.speaker}</p>
          <p className="min-h-[2.5rem] text-sm leading-relaxed text-foreground sm:text-base">
            {text}
            {typing && <span className="ml-0.5 inline-block animate-pulse text-primary">▍</span>}
          </p>

          {children}

          {!typing && !hasChoices && (
            <div className="mt-1 flex items-center justify-end gap-1 text-[11px] font-semibold text-muted-foreground">
              <span className="hidden sm:inline">Enter / Espacio</span>
              <motion.span
                aria-hidden="true"
                className="text-primary"
                animate={{ y: [0, 3, 0] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              >
                ▸
              </motion.span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
