// Fase 2-C — Punto de entrada estable de la capa de exploración.
// El componente vive ahora en `explorer/` como sistema reutilizable; este
// archivo mantiene la ruta de import previa para no romper las rutas de mundo.
export { WorldExplorer } from "./explorer/WorldExplorer";
export type { ExplorerPoint, ExplorerNode } from "./explorer/types";
