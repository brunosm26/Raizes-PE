import assert from "node:assert/strict";
import { it } from "node:test";
import { assinaturaItens, idDoPedido } from "../src/utils/idempotenciaPedido";
import { idDoPedido as idNext, assinaturaItens as assinaturaNext } from "../../lib/servidor/idempotenciaPedido";

it("Express e Next preservam o ID determinístico entre instâncias e normalizam caixa", () => {
  const comprador = "10000000-0000-4000-8000-000000000007";
  const chave = "abcdefab-abcd-4000-8000-abcdefabcdef";
  const id = idDoPedido(comprador, chave);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(idNext(comprador, chave.toUpperCase()), id);
  assert.notEqual(idDoPedido("10000000-0000-4000-8000-000000000008", chave), id);
  assert.notEqual(idDoPedido(comprador), idDoPedido(comprador));
});

it("a comparação de carrinho independe da ordem e agrupa linhas repetidas", () => {
  const a = [{ produtoId: "BB", quantidade: 1 }, { produtoId: "aa", quantidade: 2 }, { produtoId: "bb", quantidade: 2 }];
  const b = [{ produtoId: "aa", quantidade: 2 }, { produtoId: "bb", quantidade: 3 }];
  assert.equal(assinaturaItens(a), assinaturaItens(b));
  assert.equal(assinaturaNext(a), assinaturaItens(b));
});
