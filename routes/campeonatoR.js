import { Router } from "express";
import { CampeonatoController } from "../controllers/campeonatoC.js";
import { DesignacionController } from "../controllers/designacionC.js";
import { AuthMiddleware } from "../middlewares/authM.js";
import { requireRole } from "../middlewares/roleM.js";

// Partidos / Designaciones module. Lectura: cualquier miembro del módulo,
// incluido ARB (la vista "Partidos" se le muestra en el menú y puede ver
// campeonatos, partidos y designaciones). Escritura: solo roles asignadores
// (ADM/GER/SUP) — un ARB no asigna árbitros (decisión ratificada, Paso 3).
const canRead = requireRole("ADM", "GER", "SUP", "ARB");
const canAssign = requireRole("ADM", "GER", "SUP");

const campeonatoRouter = Router();

// Campeonatos y partidos provienen de SISCAMP (solo lectura).
campeonatoRouter.get(
  "/",
  AuthMiddleware,
  canRead,
  CampeonatoController.getAll,
);
campeonatoRouter.get(
  "/:id/partidos",
  AuthMiddleware,
  canRead,
  CampeonatoController.getPartidos,
);

// Designaciones de árbitros (viven en PITAR). Anidadas bajo el campeonato
// porque `partidos.Codigo` NO es único en SISCAMP (PK compuesta junto a
// IdCamp): el código por sí solo sería ambiguo.
campeonatoRouter.get(
  "/:id/partidos/:codigo/arbitros",
  AuthMiddleware,
  canRead,
  DesignacionController.listar,
);
campeonatoRouter.post(
  "/:id/partidos/:codigo/arbitros",
  AuthMiddleware,
  canAssign,
  DesignacionController.create,
);
campeonatoRouter.put(
  "/:id/partidos/:codigo/arbitros/:idFuncion",
  AuthMiddleware,
  canAssign,
  DesignacionController.update,
);
campeonatoRouter.delete(
  "/:id/partidos/:codigo/arbitros/:idFuncion",
  AuthMiddleware,
  canAssign,
  DesignacionController.remove,
);

export default campeonatoRouter;