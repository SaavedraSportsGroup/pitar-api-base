import { Router } from "express";
import { ArbitroController } from "../controllers/arbitroC.js";
import { AuthMiddleware } from "../middlewares/authM.js";
import { requireRole } from "../middlewares/roleM.js";

// Árbitros are consumed by the Partidos/Disponibilidad modules, so we allow the
// same roles as those modules. Adjust the allow-list here if the audience
// changes.
const canReadArbitros = requireRole("ADM", "GER", "SUP", "ARB");

const arbitroRouter = Router();

arbitroRouter.get("/", AuthMiddleware, canReadArbitros, ArbitroController.getAll);
// /codigo/:codigo must be declared before /:id to avoid collisions.
arbitroRouter.get(
  "/codigo/:codigo",
  AuthMiddleware,
  canReadArbitros,
  ArbitroController.getByCodigo,
);
arbitroRouter.get(
  "/:id",
  AuthMiddleware,
  canReadArbitros,
  ArbitroController.getById,
);

export default arbitroRouter;
