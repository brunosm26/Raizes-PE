import type { RequestHandler } from "express";
import { lerPeriodoPedidos } from "../utils/periodoPedidos";
import { ErroHttp } from "../utils/erroHttp";
import { sessaoDe } from "../middlewares/sessao";
import { invalidarCatalogo } from "../services/cacheCatalogo";
import { enfileirarPedidoCriado, enfileirarStatusAtualizado } from "../services/filaAssincronaService";
import * as pedidoService from "../services/pedidoService";

// GET /api/pedidos
export const listar: RequestHandler = async (req, res) => {
  const sessao = sessaoDe(req);
  const { inicio, fim } = req.query;
  if (inicio === undefined && fim === undefined) {
    res.json(await pedidoService.listarParaSessao(sessao));
    return;
  }
  if (sessao.tipo !== "admin") throw new ErroHttp(403, "Apenas administradores podem filtrar pedidos por período.");
  const periodo = lerPeriodoPedidos(inicio, fim);
  if (!periodo) throw new ErroHttp(400, "Informe um período válido.");
  res.json(await pedidoService.listarParaSessao(sessao, periodo));
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
