import { Router } from "express";
import * as artesaoController from "../controllers/artesaoController";

export const artesaoRoutes = Router();

artesaoRoutes.get("/:id", artesaoController.buscarPerfil);
