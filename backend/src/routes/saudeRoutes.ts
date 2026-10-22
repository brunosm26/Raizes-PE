import { Router } from "express";
import { saude, saudeBanco } from "../controllers/saudeController";

export const saudeRoutes = Router();

saudeRoutes.get("/", saude);

export const saudeBdRoutes = Router();

saudeBdRoutes.get("/", saudeBanco);
