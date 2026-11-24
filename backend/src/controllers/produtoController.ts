import type { RequestHandler } from "express";
import { sessaoDe } from "../middlewares/sessao";
import { cacheCatalogo, chaveProdutos, invalidarCatalogo } from "../services/cacheCatalogo";
import * as catalogoService from "../services/catalogoService";
import * as produtoRepository from "../repositories/produtoRepository";
import * as produtoService from "../services/produtoService";
import { ErroHttp } from "../utils/erroHttp";
import { textoDaQuery } from "../utils/query";
import { enviarComCache } from "./respostaCache";

// GET /api/produtos?tecnica=&busca=&regiao=&categoria= (com cache: X-Cache HIT/MISS)
export const listar: RequestHandler = async (req, res) => {
  const filtros = {
    tecnica: textoDaQuery(req.query.tecnica),
    busca: textoDaQuery(req.query.busca),
    regiao: textoDaQuery(req.query.regiao),
    categoria: textoDaQuery(req.query.categoria),
  };
  const { valor, origem } = await cacheCatalogo.lerOuCalcular(chaveProdutos(filtros), () =>
    catalogoService.listarProdutos(filtros)
  );
  enviarComCache(res, origem, valor);
};

// GET /api/produtos?visao=gestao (privado, sem cache)
export const listarParaGestao: RequestHandler = async (req, res) => {
  const sessao = sessaoDe(req);
  const produtos = await produtoRepository.listarParaGestao(sessao.tipo === "artesao" ? sessao.id : undefined);
  res.set("Cache-Control", "private, no-store").json(produtos);
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
  const produto = await produtoService.criarProduto(sessaoDe(req).id, corpo);
  invalidarCatalogo(); // produto novo muda vitrine, categorias dos filtros e recomendações
  res.status(201).json(produto);
};

// PATCH /api/produtos/:id  { nome, descricao, preco, estoqueQtd, imagemUrl? }
export const editar: RequestHandler<{ id: string }> = async (req, res) => {
  const corpo = (req.body ?? {}) as Record<string, unknown>;
  const produto = await produtoService.editarProduto(req.params.id, corpo, sessaoDe(req));
  invalidarCatalogo(); // preço, estoque e nome aparecem na vitrine e nas recomendações
  res.json(produto);
};

export const moderar: RequestHandler<{ id: string }> = async (req, res) => {
  const produto = await produtoService.moderarProduto(req.params.id, req.body?.status);
  invalidarCatalogo();
  res.json(produto);
};
