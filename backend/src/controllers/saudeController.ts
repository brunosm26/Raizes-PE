import type { RequestHandler } from "express";
import { obterSaude } from "../services/saudeService";

// GET /api/saude
export const saude: RequestHandler = (_req, res) => {
  res.status(200).json(obterSaude());
};
