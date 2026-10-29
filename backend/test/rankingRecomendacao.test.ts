import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankearRecomendacoes, type EntradaRecomendacao } from "../src/services/rankingRecomendacao";
import type { ProdutoComArtesao, Tecnica } from "../src/types/dominio";

// Regra de pontuação das recomendações (PI4-82, 83 e 84), migrada de lib/rankingRecomendacao.ts
// para o backend. Função pura: nada aqui toca o banco. Os scores esperados seguem a fórmula
// do service: média x 10 + avaliações x 2 (+5 se cadastrado há menos de 30 dias de 30/06/2025).

function produto(
  id: string,
  tecnica: Tecnica,
  regiao: string,
  estoqueQtd: number,
  dataCadastro = "2025-01-01"
): ProdutoComArtesao {
  return {
    id,
    artesaoId: `a-${id}`,
    nome: `Peça ${id}`,
    descricao: "Teste",
    tecnica,
    categoria: "Casa",
    preco: 100,
    estoqueQtd,
    dataCadastro,
    artesaoNome: `Artesão ${id}`,
    artesaoRegiao: regiao,
  };
}

const PRODUTOS = [
  produto("p1", "Cerâmica", "Caruaru", 5),
  produto("p2", "Têxtil", "Tacaratu", 3, "2025-06-20"), // novidade, sem avaliação
  produto("p3", "Madeira", "Caruaru", 0), // esgotado
  produto("p4", "Cerâmica", "Tracunhaém", 2),
  produto("p5", "Palha", "Caruaru", 4),
  produto("p6", "Renda e Bordado", "Recife", 1),
];

const AVALIACOES = [
  { produtoId: "p1", media: 4.8, qtd: 2 },
  { produtoId: "p3", media: 5, qtd: 10 },
  { produtoId: "p4", media: 4, qtd: 1 },
  { produtoId: "p5", media: 4.6, qtd: 1 },
  { produtoId: "p6", media: 4.9, qtd: 4 },
];

const VISITANTE: EntradaRecomendacao = { produtos: PRODUTOS, avaliacoes: AVALIACOES, comprados: [] };
const COMPRADOR: EntradaRecomendacao = { ...VISITANTE, comprados: [{ produtoId: "p1", quantidade: 2 }] };

const resumo = (lista: ReturnType<typeof rankearRecomendacoes>) => lista.map((p) => [p.id, p.score, p.criterio]);

describe("ranking de recomendação", () => {
  it("nunca recomenda produto sem estoque, mesmo o mais bem avaliado (PI4-82)", () => {
    const todos = rankearRecomendacoes(VISITANTE, 10);
    assert.equal(todos.length, 5);
    assert.ok(todos.every((p) => p.id !== "p3" && p.estoqueQtd > 0));
  });

  it("respeita o limite (padrão 4)", () => {
    assert.equal(rankearRecomendacoes(VISITANTE).length, 4);
    assert.equal(rankearRecomendacoes(VISITANTE, 2).length, 2);
    assert.deepEqual(rankearRecomendacoes({ produtos: [], avaliacoes: [], comprados: [] }), []);
  });

  it("cold start (PI4-84): bem avaliados primeiro, novidade com +5 e média 4,0 para quem não tem avaliação", () => {
    assert.deepEqual(resumo(rankearRecomendacoes(VISITANTE, 10)), [
      ["p6", 49 + 8 + 20, "popularidade"],
      ["p1", 48 + 4 + 20, "popularidade"],
      ["p5", 46 + 2 + 20, "popularidade"],
      ["p2", 40 + 0 + 5, "novidade"],
      ["p4", 40 + 2, "novidade"],
    ]);
    const [p6] = rankearRecomendacoes(VISITANTE, 1);
    assert.equal(p6?.motivo, "Mais bem avaliados (4.9 ★)");
    const p2 = rankearRecomendacoes(VISITANTE, 10).find((p) => p.id === "p2");
    assert.equal(p2?.motivo, "Peça artesanal autêntica de Tacaratu");
  });

  it("com histórico (PI4-83): técnica, depois região, depois comunidade; o que já comprou cai 50", () => {
    assert.deepEqual(resumo(rankearRecomendacoes(COMPRADOR, 10)), [
      ["p4", 42 + 40 + 2 * 10, "historico_tecnica"],
      ["p5", 48 + 25, "historico_regiao"],
      ["p6", 57 + 15, "popularidade"],
      ["p1", 52 + 40 + 2 * 10 - 50, "historico_tecnica"],
      ["p2", 45, "popularidade"],
    ]);
    const porId = new Map(rankearRecomendacoes(COMPRADOR, 10).map((p) => [p.id, p.motivo]));
    assert.equal(porId.get("p4"), "Inspirado no seu apreço por Cerâmica");
    assert.equal(porId.get("p5"), "Tradição de Caruaru, de onde você já comprou");
    assert.equal(porId.get("p6"), "Alta recomendação da comunidade (4.9 ★)");
    assert.equal(porId.get("p2"), "Destaque do artesanato pernambucano");
  });

  it("compra de produto que não está no catálogo não conta como histórico", () => {
    const entrada = { ...VISITANTE, comprados: [{ produtoId: "removido", quantidade: 3 }] };
    assert.deepEqual(resumo(rankearRecomendacoes(entrada, 10)), resumo(rankearRecomendacoes(VISITANTE, 10)));
  });

  it("explicabilidade: todo item traz motivo, critério e os dados do artesão", () => {
    for (const p of [...rankearRecomendacoes(VISITANTE, 10), ...rankearRecomendacoes(COMPRADOR, 10)]) {
      assert.ok(p.motivo.length > 0);
      assert.ok(["historico_tecnica", "historico_regiao", "popularidade", "novidade"].includes(p.criterio));
      assert.ok(p.artesaoNome && p.artesaoRegiao);
    }
  });

  it("não altera a entrada", () => {
    const copia = structuredClone(COMPRADOR);
    rankearRecomendacoes(COMPRADOR, 10);
    assert.deepEqual(COMPRADOR, copia);
  });
});
