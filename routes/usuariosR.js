import { Router } from "express";
import { UsuarioController } from "../controllers/usuariosC.js";
import { AuthMiddleware } from "../middlewares/authM.js";
import { requireRole, requireRoleOrSelf } from "../middlewares/roleM.js";

const usuariosRouter = Router();

// User management (users module) is restricted to Administrador/Gerente.
usuariosRouter.get("/", AuthMiddleware, requireRole("ADM", "GER"), UsuarioController.getAll);
usuariosRouter.get("/:id", AuthMiddleware, requireRole("ADM", "GER"), UsuarioController.getById);
usuariosRouter.post("/", AuthMiddleware, requireRole("ADM", "GER"), UsuarioController.create);
usuariosRouter.put("/:id", AuthMiddleware, requireRole("ADM", "GER"), UsuarioController.update);

// Password change is a self-service auth flow (forced change for any user) and
// an admin reset (ADM/GER). requireRoleOrSelf keeps both working while blocking
// a user from resetting someone else's password.
usuariosRouter.patch("/pass/:id", AuthMiddleware, requireRoleOrSelf("ADM", "GER"), UsuarioController.updatePass);

usuariosRouter.delete("/:id", AuthMiddleware, requireRole("ADM", "GER"), UsuarioController.delete);

export default usuariosRouter;
