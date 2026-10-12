import { EmpleadoModel } from "../models/empleado.js";

/**
 * Employee-record RBAC guard.
 *
 * Closes a broken-access-control gap: /api/empleados/* previously required only
 * authentication, so any authenticated user could read or mutate ANY employee's
 * record. This guard allows a request only when the user holds one of the
 * privileged codes (Administrador/Gerente) OR is operating on their OWN record.
 *
 * Fail-closed by design: missing user, missing roles, or an unowned/nonexistent
 * target all resolve to 403. The privileged short-circuit runs BEFORE the DB
 * lookup, so Administrador/Gerente never pay the ownership query.
 */

const PRIVILEGED_CODES = ["ADM", "GER"];
const DENY_MESSAGE = "No tiene permisos para realizar esta acción";

const forbidden = (res) => res.status(403).json({ message: DENY_MESSAGE });

const hasPrivilegedRole = (req) => {
  const codes = req.user?.roleCodes;
  return Array.isArray(codes) && codes.some((code) => PRIVILEGED_CODES.includes(code));
};

/**
 * For routes where `:id` is an id_empleado. Privileged codes pass; every other
 * user passes only when the employee's id_usuario matches their own id.
 */
export const requireEmployeeAccess = async (req, res, next) => {
  if (!req.user) return forbidden(res);
  if (hasPrivilegedRole(req)) return next();

  try {
    const empleado = await EmpleadoModel.getById(req.params.id);
    const ownerId = empleado?.id_usuario;
    if (ownerId != null && String(ownerId) === String(req.user.id)) {
      return next();
    }
    return forbidden(res);
  } catch (error) {
    console.error("requireEmployeeAccess error:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

/**
 * For GET /:id/id, where `:id` is an id_usuario. Privileged codes pass; every
 * other user passes only when `:id` equals their own user id.
 */
export const requireSelfUser = (req, res, next) => {
  if (!req.user) return forbidden(res);
  if (hasPrivilegedRole(req)) return next();
  if (req.params.id != null && String(req.params.id) === String(req.user.id)) {
    return next();
  }
  return forbidden(res);
};
