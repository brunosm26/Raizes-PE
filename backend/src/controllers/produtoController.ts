import type { RequestHandler } from "express";
import { sessaoDe } from "../middlewares/sessao";
import * as catalogoService from "../services/catalogoService";
import * as produtoService from "../services/produtoService";
import { ErroHttp } from "../utils/erroHttp";
import { textoDaQuery } from "../utils/query";

// GET /api/produtos?tecnica=&busca=&regiao=&categoria=
export const listar: RequestHandler = async (req, res) => {
  res.json(
    await catalogoService.listarProdutos({
      tecnica: textoDaQuery(req.query.tecnica),
      busca: textoDaQuery(req.query.busca),
      regiao: textoDaQuery(req.query.regiao),
      categoria: textoDaQuery(req.query.categoria),
    })
  );
};

// GET /api/produtos/:id
export const buscar: RequestHandler<{ id: string }> = async (req, res) => {
  const produto = await catalogoService.buscarProduto(req.params.id);
  if (!produto) throw new ErroHttp(404, "Produto não encontrado");
  res.json(produto);
};

// GET /api/produtos/:id/relacionados?limite=3
export const relacionados: RequestHandler<{ id: string }> = async (req, res) => {
  const limite = catalogoService.limitar(textoDaQuery(req.query.limite) ?? "3", 3);
  res.json(await catalogoService.listarRelacionados(req.params.id, limite));
};

// GET /api/produtos/:id/avaliacoes
export const avaliacoes: RequestHandler<{ id: string }> = async (req, res) => {
  res.json(await catalogoService.resumirAvaliacoes(req.params.id));
};

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
