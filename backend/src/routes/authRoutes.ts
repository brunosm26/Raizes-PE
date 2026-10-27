import { Router } from "express";
import * as authController from "../controllers/authController";

export const authRoutes = Router();

authRoutes.post("/login", authController.login);
authRoutes.post("/cadastro", authController.cadastro);
authRoutes.post("/logout", authController.logout);
authRoutes.get("/me", authController.eu);
