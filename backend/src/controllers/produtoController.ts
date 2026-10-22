import type { RequestHandler } from "express";
import { sessaoDe } from "../middlewares/sessao";
import * as produtoService from "../services/produtoService";

// POST /api/produtos  { nome, descricao, tecnica, categoria, preco, estoqueQtd, imagemUrl? }
// Só artesão cadastra, e sempre na própria loja (o id vem da sessão).
export const criar: RequestHandler = async (req, res) => {
  const corpo = (req.body ?? {}) as Record<string, unknown>;
  res.status(201).json(await produtoService.criarProduto(sessaoDe(req).id, corpo));
};

// PATCH /api/produtos/:id  { nome, descricao, preco, estoqueQtd, imagemUrl? }
export const editar: RequestHandler<{ id: string }> = async (req, res) => {
  const corpo = (req.body ?? {}) as Record<string, unknown>;
  res.json(await produtoService.editarProduto(req.params.id, corpo, sessaoDe(req)));
};
