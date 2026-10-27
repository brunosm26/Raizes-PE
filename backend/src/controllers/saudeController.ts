import type { RequestHandler } from "express";
import { obterSaude, verificarBanco } from "../services/saudeService";

// GET /api/saude
export const saude: RequestHandler = (_req, res) => {
  res.status(200).json(obterSaude());
};

// GET /api/saude-bd. Rota de diagnóstico do setup: de propósito devolve a mensagem real
// do erro do banco (senha errada, host fora do ar), para quem está configurando o .env.
export const saudeBanco: RequestHandler = async (_req, res) => {
  try {
    res.json(await verificarBanco());
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "erro desconhecido";
    res.status(500).json({ ok: false, erro: mensagem });
  }
};
