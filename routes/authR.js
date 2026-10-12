import { Router } from "express";
import { AuthController } from "../controllers/authC.js";
import { AuthMiddleware } from "../middlewares/authM.js";

const authRouter = Router();

authRouter.post("/login", AuthController.login);
authRouter.post("/logout", AuthController.logout);
authRouter.get("/verify", AuthController.verify);
authRouter.get("/profile", AuthMiddleware, AuthController.getUserInfo);
authRouter.post("/forgot-password", AuthController.forgotPassword);
authRouter.post("/reset-password", AuthController.resetPassword);

export default authRouter;
