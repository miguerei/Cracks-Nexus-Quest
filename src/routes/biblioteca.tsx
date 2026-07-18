import { createFileRoute, Outlet } from "@tanstack/react-router";

// Ruta layout de la Biblioteca. La pantalla de subida vive en
// `biblioteca.index.tsx` (/biblioteca) y las pantallas de análisis y aventura
// son rutas hijas que se renderizan aquí a través del <Outlet />.
export const Route = createFileRoute("/biblioteca")({
  component: () => <Outlet />,
});
