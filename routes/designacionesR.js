import { Router } from "express";
import { DesignacionController } from "../controllers/designacionC.js";
import { AuthMiddleware } from "../middlewares/authM.js";
import { requireRole } from "../middlewares/roleM.js";

// Same audience as /api/disponibilidad: the whole Partidos/Disponibilidad
// module roles can consult. ADM/GER/SUP manage ANY employee's view; an ARB-only
// user sees ONLY their own `id_empleado` (req.user.id_empleado).
const canReadDesignaciones = requireRole("ADM", "GER", "SUP", "ARB");

const PRIVILEGED_CODES = ["ADM", "GER", "SUP"];
const DENY_MESSAGE = "No tiene permisos para realizar esta acción";

const forbidden = (res) => res.status(403).json({ message: DENY_MESSAGE });

const isPrivileged = (req) =>
  Array.isArray(req.user?.roleCodes) &&
  req.user.roleCodes.some((code) => PRIVILEGED_CODES.includes(code));

const ownsEmpleado = (req, idEmpleado) =>
  idEmpleado != null &&
  req.user?.id_empleado != null &&
  String(idEmpleado) === String(req.user.id_empleado);

// The consulted employee comes from the URL param: non-privileged users must
// own it. Fail-closed: missing user, missing roles, or null id_empleado → 403.
const requireOwnEmpleadoParam = (paramName) => (req, res, next) => {
  if (!req.user) return forbidden(res);
  if (isPrivileged(req)) return next();
  if (ownsEmpleado(req, req.params[paramName])) return next();
  return forbidden(res);
};

const designacionesRouter = Router();

// GET /api/designaciones/empleado/:idEmpleado
// The employee's own designations (as designated referee) with partido data.
designacionesRouter.get(
  "/empleado/:idEmpleado",
  AuthMiddleware,
  canReadDesignaciones,
  requireOwnEmpleadoParam("idEmpleado"),
  DesignacionController.listarPorEmpleado,
);

export default designacionesRouter;