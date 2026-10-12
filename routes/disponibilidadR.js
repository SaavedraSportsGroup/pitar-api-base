import { Router } from "express";
import { DisponibilidadController } from "../controllers/disponibilidadC.js";
import { DisponibilidadModel } from "../models/disponibilidad.js";
import { AuthMiddleware } from "../middlewares/authM.js";
import { requireRole } from "../middlewares/roleM.js";

// Same audience as /api/arbitros (the Partidos/Disponibilidad module roles).
const canUseDisponibilidad = requireRole("ADM", "GER", "SUP", "ARB");

// --- Ownership (possession-based access control) ---------------------------
// ADM/GER/SUP manage ANY employee's availability; an ARB-only user manages ONLY
// their own `id_empleado` (req.user.id_empleado, projected by v_usuarios).
// Mirrors the pattern in middlewares/empleadoAccessM.js but keyed on
// id_empleado. Fail-closed: missing user, missing roles, or a null id_empleado
// all resolve to 403 for non-privileged users.
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

// Routes where the employee id is a URL param (GET /:idEmpleado, /estado/:idEmpleado).
const requireOwnEmpleadoParam = (paramName) => (req, res, next) => {
  if (!req.user) return forbidden(res);
  if (isPrivileged(req)) return next();
  if (ownsEmpleado(req, req.params[paramName])) return next();
  return forbidden(res);
};

// POST carries the target employee in the body.
const requireOwnEmpleadoBody = (req, res, next) => {
  if (!req.user) return forbidden(res);
  if (isPrivileged(req)) return next();
  if (ownsEmpleado(req, req.body?.id_empleado)) return next();
  return forbidden(res);
};

// PUT/PATCH/DELETE use the availability row id: load the row and compare its
// owner. A missing row is left to the controller so it answers the 404.
const requireOwnEmpleadoRow = async (req, res, next) => {
  if (!req.user) return forbidden(res);
  if (isPrivileged(req)) return next();
  try {
    const row = await DisponibilidadModel.getById(req.params.id);
    if (!row) return next();
    if (ownsEmpleado(req, row.id_empleado)) return next();
    return forbidden(res);
  } catch (error) {
    console.error("requireOwnEmpleadoRow error:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

const disponibilidadRouter = Router();

// The literal segment must be declared before the /:idEmpleado route.
disponibilidadRouter.get(
  "/estado/:idEmpleado",
  AuthMiddleware,
  canUseDisponibilidad,
  requireOwnEmpleadoParam("idEmpleado"),
  DisponibilidadController.getEstado,
);
disponibilidadRouter.get(
  "/:idEmpleado",
  AuthMiddleware,
  canUseDisponibilidad,
  requireOwnEmpleadoParam("idEmpleado"),
  DisponibilidadController.getByEmpleado,
);

disponibilidadRouter.post(
  "/",
  AuthMiddleware,
  canUseDisponibilidad,
  requireOwnEmpleadoBody,
  DisponibilidadController.create,
);
disponibilidadRouter.put(
  "/:id",
  AuthMiddleware,
  canUseDisponibilidad,
  requireOwnEmpleadoRow,
  DisponibilidadController.update,
);
disponibilidadRouter.patch(
  "/:id/estado",
  AuthMiddleware,
  canUseDisponibilidad,
  requireOwnEmpleadoRow,
  DisponibilidadController.updateEstado,
);
disponibilidadRouter.delete(
  "/:id",
  AuthMiddleware,
  canUseDisponibilidad,
  requireOwnEmpleadoRow,
  DisponibilidadController.remove,
);

export default disponibilidadRouter;
