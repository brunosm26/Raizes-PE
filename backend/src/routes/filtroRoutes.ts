import { Router } from "express";
import * as filtroController from "../controllers/filtroController";

export const filtroRoutes = Router();

filtroRoutes.get("/", filtroController.listar);
