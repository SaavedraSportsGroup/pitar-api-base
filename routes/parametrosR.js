import { Router } from "express";
import { AuthMiddleware } from "../middlewares/authM.js";
import { ParametrosController } from "../controllers/parametrosC.js";

const parametrosRouter = Router();

parametrosRouter.get("/", AuthMiddleware, ParametrosController.getParametros);

export default parametrosRouter;
