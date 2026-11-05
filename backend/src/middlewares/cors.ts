import type { RequestHandler } from "express";
import { env } from "../config/env";

const METODOS = "GET,POST,PATCH,PUT,DELETE,OPTIONS";
const CABECALHOS_PADRAO = "Content-Type, Authorization";

// CORS com credenciais, sem dependência extra. Só libera as origens de CORS_ORIGIN, uma a uma:
// com cookies o navegador recusa "*", então a origem da requisição é devolvida (e só se estiver
// na lista). Sem CORS_ORIGIN o middleware não faz nada: o front usa a mesma origem (proxy do Next).
export function cors(origensPermitidas: readonly string[] = env.CORS_ORIGIN): RequestHandler {
  const permitidas = new Set(origensPermitidas);

  return (req, res, next) => {
    const origem = req.headers.origin;
    if (permitidas.size === 0 || !origem) return next();

    // A resposta muda conforme a origem: caches precisam saber disso.
    res.append("Vary", "Origin");
    if (!permitidas.has(origem)) return next();

    res.setHeader("Access-Control-Allow-Origin", origem);
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Preflight (OPTIONS com Access-Control-Request-Method): responde aqui, sem chegar nas rotas.
    if (req.method === "OPTIONS" && req.headers["access-control-request-method"]) {
      res.append("Vary", "Access-Control-Request-Headers");
      res.setHeader("Access-Control-Allow-Methods", METODOS);
      res.setHeader(
        "Access-Control-Allow-Headers",
        req.headers["access-control-request-headers"] ?? CABECALHOS_PADRAO
      );
      res.setHeader("Access-Control-Max-Age", "600");
      res.status(204).end();
      return;
    }
    next();
  };
}
