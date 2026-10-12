import { Router } from "express";
import { EmpleadoController } from "../controllers/empleadosC.js";
import { AuthMiddleware } from "../middlewares/authM.js";
import {
  requireEmployeeAccess,
  requireSelfUser,
} from "../middlewares/empleadoAccessM.js";
import { uploadAnexo, uploadFoto } from "../middlewares/uploadM.js";

const empleadoRouter = Router();

empleadoRouter.get(
  "/:id",
  AuthMiddleware,
  requireEmployeeAccess,
  EmpleadoController.getById,
);
empleadoRouter.get(
  "/:id/id",
  AuthMiddleware,
  requireSelfUser,
  EmpleadoController.getEmpleadoId,
);
empleadoRouter.get(
  "/:id/anexos",
  AuthMiddleware,
  requireEmployeeAccess,
  EmpleadoController.getAnexosById,
);
empleadoRouter.get(
  "/:id/anexos/:tipo",
  AuthMiddleware,
  requireEmployeeAccess,
  EmpleadoController.getAnexoArchivo,
);

empleadoRouter.patch(
  "/:id",
  AuthMiddleware,
  requireEmployeeAccess,
  uploadFoto,
  EmpleadoController.updateEmpleado,
);
empleadoRouter.patch(
  "/:id/salud",
  AuthMiddleware,
  requireEmployeeAccess,
  EmpleadoController.updateEmpleadoSalud,
);
empleadoRouter.patch(
  "/:id/financiero",
  AuthMiddleware,
  requireEmployeeAccess,
  EmpleadoController.updateEmpleadoFinanciero,
);

empleadoRouter.post(
  "/:id/anexos",
  AuthMiddleware,
  requireEmployeeAccess,
  uploadAnexo,
  EmpleadoController.createAnexo,
);
empleadoRouter.delete(
  "/:id/anexos/:tipo",
  AuthMiddleware,
  requireEmployeeAccess,
  EmpleadoController.deleteAnexo,
);

export default empleadoRouter;
