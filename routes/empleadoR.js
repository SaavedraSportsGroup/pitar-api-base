import { Router } from "express";
import { EmpleadoController } from "../controllers/empleadosC.js";
import { AuthMiddleware } from "../middlewares/authM.js";

const empleadoRouter = Router();

empleadoRouter.get("/:id", AuthMiddleware, EmpleadoController.getById);
empleadoRouter.get("/:id/id", AuthMiddleware, EmpleadoController.getEmpleadoId);
empleadoRouter.get(
  "/:id/anexos",
  AuthMiddleware,
  EmpleadoController.getAnexosById,
);

empleadoRouter.patch("/:id", AuthMiddleware, EmpleadoController.updateEmpleado);
empleadoRouter.patch(
  "/:id/salud",
  AuthMiddleware,
  EmpleadoController.updateEmpleadoSalud,
);
empleadoRouter.patch(
  "/:id/financiero",
  AuthMiddleware,
  EmpleadoController.updateEmpleadoFinanciero,
);
empleadoRouter.patch(
  "/:id/anexos",
  AuthMiddleware,
  EmpleadoController.updateEmpleadoAnexos,
);

export default empleadoRouter;
