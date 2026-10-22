import { Router } from "express";
import { saude } from "../controllers/saudeController";

export const saudeRoutes = Router();

saudeRoutes.get("/", saude);
