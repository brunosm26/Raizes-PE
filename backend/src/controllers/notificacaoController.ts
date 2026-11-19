import type { RequestHandler } from "express";
import { sessaoDe } from "../middlewares/sessao";
import { resumirFila } from "../services/filaAssincronaService";
import * as notificacaoService from "../services/notificacaoService";

// GET /api/notificacoes — as notificações que o worker já processou para o usuário logado.
// Admin recebe também o resumo da fila (contagem por status e jobs recentes).
export const listar: RequestHandler = (req, res) => {
  const sessao = sessaoDe(req);
  const caixa = notificacaoService.listarDoUsuario(sessao.id);
  res.setHeader("Cache-Control", "no-store"); // muda a cada job processado
  res.json(sessao.tipo === "admin" ? { ...caixa, fila: resumirFila() } : caixa);
};

// POST /api/notificacoes/ler  { ids?: string[] } — sem ids, marca todas do usuário logado
export const marcarComoLidas: RequestHandler = (req, res) => {
  const corpo = (req.body ?? {}) as { ids?: unknown };
  res.json(notificacaoService.marcarComoLidas(sessaoDe(req).id, corpo.ids));
};
