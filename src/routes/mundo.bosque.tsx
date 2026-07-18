import { createFileRoute } from "@tanstack/react-router";
import { World3DScreen } from "@/components/game/world3d";

export const Route = createFileRoute("/mundo/bosque")({
  head: () => {
    const title = "Bosque del Descubrimiento — Nexus Quest";
    const desc =
      "Biología · ESO. Explora el Bosque, completa las misiones de la célula y vence a Zumbra en Cracks Academy: Nexus Quest.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: () => <World3DScreen worldId="bosque" />,
});
