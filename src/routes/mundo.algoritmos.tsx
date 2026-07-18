import { createFileRoute } from "@tanstack/react-router";
import { World3DScreen } from "@/components/game/world3d";

export const Route = createFileRoute("/mundo/algoritmos")({
  head: () => {
    const title = "Ciudad de los Algoritmos — Nexus Quest";
    const desc =
      "Matemáticas · ESO. Tiende Puentes de Ecuaciones y restaura el Núcleo Lógico en Cracks Academy: Nexus Quest.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: () => <World3DScreen worldId="algoritmos" />,
});
