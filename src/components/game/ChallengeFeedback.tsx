// Floating micro-feedback banner shown after each answer in a minigame (P2-3).
// Purely presentational: brief, visual, gaming tone. It never touches rewards,
// progression or gating — the parent decides what text to show and when.

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type FeedbackState = { kind: "hit" | "miss"; text: string; key: number } | null;

export function ChallengeFeedback({ feedback }: { feedback: FeedbackState }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {feedback && (
          <motion.div
            key={feedback.key}
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className={cn(
              "flex max-w-md items-start gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur",
              feedback.kind === "hit"
                ? "border-energy bg-energy/15 text-energy glow-energy"
                : "border-destructive/60 bg-destructive/10 text-foreground",
            )}
            role="status"
          >
            {feedback.kind === "hit" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
            )}
            <span>{feedback.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
