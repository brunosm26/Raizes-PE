import type { RequestHandler } from "express";
import { sessaoDe } from "../middlewares/sessao";
import { invalidarCatalogo } from "../services/cacheCatalogo";
import { enfileirarPedidoCriado, enfileirarStatusAtualizado } from "../services/filaAssincronaService";
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
  // O COMMIT já aconteceu dentro do service. O job roda depois da resposta e não é esperado.
  enfileirarPedidoCriado(pedido);
  res.status(201).json(pedido);
};

// PATCH /api/pedidos/:id  { status }
export const atualizarStatus: RequestHandler<{ id: string }> = async (req, res) => {
  const corpo = (req.body ?? {}) as { status?: unknown };
  const pedido = await pedidoService.atualizarStatus(req.params.id, corpo.status ?? "", sessaoDe(req));
  invalidarCatalogo(); // status entra no histórico usado pelas recomendações
  enfileirarStatusAtualizado(pedido);
  res.json(pedido);
};
