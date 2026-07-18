import { createFileRoute, redirect } from "@tanstack/react-router";

// Canonical route for the Math minigame is `/reto/puentes`.
// This alias keeps the original naming requirement (`/reto/ecuaciones`)
// working by permanently redirecting to the canonical route. No game
// logic lives here — it only forwards the navigation.
export const Route = createFileRoute("/reto/ecuaciones")({
  beforeLoad: () => {
    throw redirect({ to: "/reto/puentes", replace: true });
  },
});
