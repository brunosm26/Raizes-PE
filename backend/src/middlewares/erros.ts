import type { ErrorRequestHandler, RequestHandler } from "express";
import { ErroHttp } from "../utils/erroHttp";

// Rota não encontrada: responde 404 em JSON em vez da página HTML padrão do Express.
export const naoEncontrado: RequestHandler = (req, _res, next) => {
  next(new ErroHttp(404, `Rota não encontrada: ${req.method} ${req.path}`));
};

// Tratador final de erros. Erros inesperados (500) não expõem a mensagem interna.
export const tratadorDeErros: ErrorRequestHandler = (erro, _req, res, _next) => {
  if (erro instanceof ErroHttp) {
    res.status(erro.status).json({ ok: false, erro: erro.message });
    return;
  }

  console.error(erro);
  res.status(500).json({ ok: false, erro: "Erro interno do servidor" });
};
