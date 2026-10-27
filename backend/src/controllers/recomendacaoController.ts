import type { RequestHandler } from "express";
import { limitar } from "../services/catalogoService";
import { calcularRecomendacoes } from "../services/recomendacaoService";
import { textoDaQuery } from "../utils/query";

// GET /api/recomendacoes?limite=4
// Comprador logado recebe recomendações pelo próprio histórico; visitante (ou outro
// perfil) recebe o cold start. O comprador vem da sessão, nunca da URL.
export const listar: RequestHandler = async (req, res) => {
  const compradorId = req.sessao?.tipo === "comprador" ? req.sessao.id : undefined;
  const recomendacoes = await calcularRecomendacoes(compradorId, limitar(textoDaQuery(req.query.limite), 4));
  res.json({
    sucesso: true,
    origem: "baseline_ia_v1",
    compradorId: compradorId ?? null,
    total: recomendacoes.length,
    dados: recomendacoes,
  });
};
