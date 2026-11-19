import type { RequestHandler } from "express";
import { sessaoDe } from "../middlewares/sessao";
import { invalidarCatalogo } from "../services/cacheCatalogo";
import * as pedidoService from "../services/pedidoService";

// GET /api/pedidos
export const listar: RequestHandler = async (req, res) => {
  res.json(await pedidoService.listarParaSessao(sessaoDe(req)));
};

// POST /api/pedidos  { itens: [{ produtoId, quantidade }] } — o comprador é o usuário logado
export const criar: RequestHandler = async (req, res) => {
  const corpo = (req.body ?? {}) as { itens?: unknown };
  const pedido = await pedidoService.criarPedido(sessaoDe(req).id, corpo.itens ?? []);
  invalidarCatalogo(); // baixou estoque e mudou o histórico de compras do comprador
  res.status(201).json(pedido);
};

// PATCH /api/pedidos/:id  { status }
export const atualizarStatus: RequestHandler<{ id: string }> = async (req, res) => {
  const corpo = (req.body ?? {}) as { status?: unknown };
  const pedido = await pedidoService.atualizarStatus(req.params.id, corpo.status ?? "", sessaoDe(req));
  invalidarCatalogo(); // status entra no histórico usado pelas recomendações
  res.json(pedido);
};
