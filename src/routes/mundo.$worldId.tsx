import { createFileRoute, redirect } from "@tanstack/react-router";
import { World3DScreen } from "@/components/game/world3d";
import { getWorldById } from "@/services/gameService";

// Todos los mundos del Nexus son jugables (Fase 3). Esta ruta dinámica sirve la
// pantalla jugable reutilizable para cualquier mundo. El Bosque y la Ciudad de
// los Algoritmos tienen rutas estáticas propias con su metadata, así que se
// redirige a ellas para mantener enlaces y SEO previos.
export const Route = createFileRoute("/mundo/$worldId")({
  beforeLoad: ({ params }) => {
    if (params.worldId === "bosque") throw redirect({ to: "/mundo/bosque" });
    if (params.worldId === "algoritmos") throw redirect({ to: "/mundo/algoritmos" });
  },
  head: ({ params }) => {
    const world = getWorldById(params.worldId);
    const title = world ? `${world.name} — Nexus Quest` : "Mundo del Nexus";
    const desc = world
      ? `${world.subject} · ${world.theme}. Aventura educativa demo en Cracks Academy: Nexus Quest.`
      : "Este mundo del Nexus no existe.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: DynamicWorld,
});

function DynamicWorld() {
  const { worldId } = Route.useParams();
  return <World3DScreen worldId={worldId} />;
}
