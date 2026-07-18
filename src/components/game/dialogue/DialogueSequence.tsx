import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { DialogueBox } from "./DialogueBox";
import { DialogueChoice } from "./DialogueChoice";
import type { DialogueChoiceOption, DialogueLine } from "./types";

/**
 * DialogueSequence — orquesta una conversación tipo RPG clásico.
 *
 * Escribe cada línea con efecto máquina de escribir, avanza con Enter / Espacio
 * / clic (o toque) y, al terminar, muestra las elecciones (si las hay) o
 * completa la secuencia. Es reutilizable en cualquier overworld.
 *
 *  - Primera pulsación mientras escribe → revela la línea completa.
 *  - Siguiente pulsación → avanza a la línea siguiente.
 *  - Última línea sin elecciones → onComplete() + onClose().
 */
const TYPE_SPEED = 18; // ms por carácter

export function DialogueSequence({
  lines,
  choices,
  onComplete,
  onClose,
}: {
  lines: DialogueLine[];
  choices?: DialogueChoiceOption[];
  onComplete?: () => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState("");
  const [typing, setTyping] = useState(true);
  const [choosing, setChoosing] = useState(false);

  const line = lines[index];
  const hasChoices = choosing && !!choices?.length;

  // Efecto máquina de escribir para la línea actual.
  useEffect(() => {
    if (!line) return;
    setShown("");
    setTyping(true);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(line.text.slice(0, i));
      if (i >= line.text.length) {
        clearInterval(id);
        setTyping(false);
      }
    }, TYPE_SPEED);
    return () => clearInterval(id);
  }, [line]);

  const finish = useCallback(() => {
    onComplete?.();
    onClose();
  }, [onComplete, onClose]);

  const advance = useCallback(() => {
    if (typing) {
      // Revela la línea completa de golpe.
      setShown(line?.text ?? "");
      setTyping(false);
      return;
    }
    if (index < lines.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    if (choices?.length) {
      setChoosing(true);
      return;
    }
    finish();
  }, [typing, index, lines.length, line, choices, finish]);

  // Teclado: Enter / Espacio avanzan (salvo cuando ya se muestran elecciones).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        if (!hasChoices) advance();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [advance, hasChoices, onClose]);

  const onSelect = useCallback(
    (c: DialogueChoiceOption) => {
      onClose();
      c.onSelect?.();
    },
    [onClose],
  );

  if (!line) return null;

  return (
    <AnimatePresence>
      <DialogueBox line={line} text={shown} typing={typing} hasChoices={hasChoices} onAdvance={advance}>
        {hasChoices && choices ? <DialogueChoice choices={choices} onSelect={onSelect} /> : null}
      </DialogueBox>
    </AnimatePresence>
  );
}
