import jwt from "jsonwebtoken";
import { UsuarioModel } from "../models/usuario.js";

export const AuthMiddleware = async (req, res, next) => {
  try {
    const cookieToken = req.cookies.authToken;
    const headerToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null;
    const token = cookieToken || headerToken;
    if (!token) {
      return res
        .status(401)
        .json({ authenticated: false, message: "Token no encontrado" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Consulta usuario
    const user = await UsuarioModel.getById(userId);
    if (!user) {
      return res
        .status(401)
        .json({ authenticated: false, message: "Usuario no encontrado" });
    }

    if (user.activo !== 1) {
      return res
        .status(401)
        .json({ authenticated: false, message: "Usuario no activo" });
    }

    // Role codes (ADM/GER/SUP/ARB/CNT) sourced from v_usuarios_roles so the RBAC
    // guard can do code-based checks without re-deriving a name->code map. Kept
    // server-side only; auth response shapes are unchanged.
    req.user = user;
    req.user.roleCodes = await UsuarioModel.getRoleCodes(userId);
    next();
  } catch (error) {
    console.error("AuthMiddleware error:", error);
    res.status(401).json({ authenticated: false, message: "Token inválido" });
  }
};
