import type { RequestHandler } from "express";
import { cacheCatalogo, chaveRecomendacoes } from "../services/cacheCatalogo";
import { limitar } from "../services/catalogoService";
import { calcularRecomendacoes } from "../services/recomendacaoService";
import { textoDaQuery } from "../utils/query";
import { enviarComCache } from "./respostaCache";

// GET /api/recomendacoes?limite=4
// Comprador logado recebe recomendações pelo próprio histórico; visitante (ou outro
// perfil) recebe o cold start. O comprador vem da sessão, nunca da URL.
// Com cache por comprador (ou "anonimo") e limite: X-Cache HIT/MISS.
export const listar: RequestHandler = async (req, res) => {
  const compradorId = req.sessao?.tipo === "comprador" ? req.sessao.id : undefined;
  const limite = limitar(textoDaQuery(req.query.limite), 4);
  const { valor: recomendacoes, origem } = await cacheCatalogo.lerOuCalcular(
    chaveRecomendacoes(compradorId, limite),
    () => calcularRecomendacoes(compradorId, limite)
  );
  enviarComCache(res, origem, {
    sucesso: true,
    origem: "baseline_ia_v1",
    compradorId: compradorId ?? null,
    total: recomendacoes.length,
    dados: recomendacoes,
  });
};
