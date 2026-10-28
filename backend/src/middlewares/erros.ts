import type { ErrorRequestHandler, RequestHandler } from "express";
import { ErroHttp } from "../utils/erroHttp";

// Rota não encontrada: responde 404 em JSON em vez da página HTML padrão do Express.
export const naoEncontrado: RequestHandler = (req, _res, next) => {
  next(new ErroHttp(404, `Rota não encontrada: ${req.method} ${req.path}`));
};

// Erros do express.json(): corpo que não é JSON válido ou grande demais.
function erroDoCorpo(erro: unknown): ErroHttp | null {
  const tipo = (erro as { type?: unknown })?.type;
  if (tipo === "entity.parse.failed") return new ErroHttp(400, "Corpo da requisição inválido.");
  if (tipo === "entity.too.large") return new ErroHttp(413, "Corpo da requisição grande demais.");
  return null;
}

// Tratador final de erros. Erros inesperados (500) não expõem a mensagem interna.
// O Express só reconhece um tratador de erros pela aridade 4, então o _next fica.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const tratadorDeErros: ErrorRequestHandler = (erro, _req, res, _next) => {
  const conhecido = erro instanceof ErroHttp ? erro : erroDoCorpo(erro);
  if (conhecido) {
    res.status(conhecido.status).json({ ok: false, erro: conhecido.message });
    return;
  }

  console.error(erro);
  res.status(500).json({ ok: false, erro: "Erro interno do servidor" });
};
