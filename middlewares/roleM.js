/**
 * RBAC role guard (Step 5).
 *
 * Blocks an API request when the authenticated user's role codes do not
 * intersect the allowed codes. It MUST be mounted AFTER AuthMiddleware so that
 * `req.user` — and `req.user.roleCodes`, sourced from the `v_usuarios_roles`
 * view — already exists.
 *
 * Fail-closed by design: a missing user, missing/empty role codes, or an empty
 * allow-list all resolve to 403.
 */

const DENY_MESSAGE = "No tiene permisos para realizar esta acción";

const forbidden = (res) => res.status(403).json({ message: DENY_MESSAGE });

/**
 * Build a middleware that allows the request only when the current user holds
 * at least one of the given role codes.
 *
 * Accepts both varargs and a single array:
 *   requireRole("ADM", "GER")
 *   requireRole(["ADM", "GER"])
 *
 * @param {...(string|string[])} allowedCodes canonical role codes (ADM, GER, ...)
 * @returns {import("express").RequestHandler}
 */
export const requireRole =
  (...allowedCodes) =>
  (req, res, next) => {
    const userCodes = req.user?.roleCodes;
    if (!Array.isArray(userCodes) || userCodes.length === 0) {
      return forbidden(res);
    }

    const allowed = new Set(allowedCodes.flat().filter(Boolean));
    if (allowed.size === 0) {
      return forbidden(res);
    }

    const granted = userCodes.some((code) => allowed.has(code));
    if (!granted) {
      return forbidden(res);
    }

    return next();
  };

// Explicit name for the same intersection semantics.
export const requireAnyRole = requireRole;

/**
 * Guard for self-service endpoints: allows the request when the user holds one
 * of the allowed codes OR is operating on their own record (`req.params.id`
 * equals the authenticated user id).
 *
 * Used by PATCH /api/usuarios/pass/:id, which serves two flows at once:
 *   - forced password change / self-service for ANY authenticated user,
 *   - admin/manager reset for ADM/GER on any user.
 * Without the self branch, the guard would lock non-ADM/GER users out of the
 * mandatory password change; without the role branch, any user could reset
 * another user's password (broken access control).
 *
 * @param {...(string|string[])} allowedCodes canonical role codes
 * @returns {import("express").RequestHandler}
 */
export const requireRoleOrSelf =
  (...allowedCodes) =>
  (req, res, next) => {
    const paramId = req.params?.id;
    const selfId = req.user?.id;
    if (paramId != null && selfId != null && String(paramId) === String(selfId)) {
      return next();
    }
    return requireRole(...allowedCodes)(req, res, next);
  };
