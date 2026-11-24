import assert from "node:assert/strict";
import { after, before, describe } from "node:test";
import { Pool } from "pg";
import "./cacheLigado";
import { bancoDeTeste, itComBanco, json, PRODUTO_DO_ARTESAO, semBanco, subirApi, USUARIOS, type Api } from "./ajudantes";

// Cache com o PostgreSQL de verdade (banco DESCARTÁVEL em TEST_DATABASE_URL): a 2ª leitura sai
// da memória e uma escrita real (editar produto, fazer pedido) apaga o cache, então a leitura
// seguinte volta ao banco e já traz o dado novo. No fim, o banco volta como estava.

interface ProdutoLido {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  estoqueQtd: number;
  imagemUrl?: string;
}

let api: Api;
let banco: Pool | undefined;
let estoqueInicial: number | undefined;
const pedidosCriados: string[] = [];

before(async () => {
  api = await subirApi();
  if (semBanco) return;
  banco = new Pool({ connectionString: bancoDeTeste });
  const { rows } = await banco.query<{ estoque: number }>("SELECT estoque_qtd AS estoque FROM origem.produto WHERE id = $1", [
    PRODUTO_DO_ARTESAO,
  ]);
  estoqueInicial = rows[0]?.estoque;
});

after(async () => {
  if (banco) {
    await banco.query("DELETE FROM origem.pedido WHERE id = ANY($1::uuid[])", [pedidosCriados]);
    if (estoqueInicial !== undefined) {
      await banco.query("UPDATE origem.produto SET estoque_qtd = $2 WHERE id = $1", [PRODUTO_DO_ARTESAO, estoqueInicial]);
    }
    await banco.end();
  }
  await api?.fechar();
});

async function ler(caminho: string, cookie?: string) {
  const r = await fetch(`${api.url}${caminho}`, { headers: cookie ? { cookie } : {} });
  assert.equal(r.status, 200);
  return { xCache: r.headers.get("x-cache"), corpo: await r.json() };
}

const doArtesao = (lista: ProdutoLido[]) => {
  const produto = lista.find((p) => p.id === PRODUTO_DO_ARTESAO);
  assert.ok(produto, "produto da carga db/05 não está na vitrine");
  return produto;
};

describe("cache com o banco", () => {
  itComBanco("GET /produtos: MISS, HIT e, depois do PATCH, MISS já com o estoque novo", async () => {
    const primeira = await ler("/produtos");
    assert.equal(primeira.xCache, "MISS");
    const segunda = await ler("/produtos");
    assert.equal(segunda.xCache, "HIT");
    assert.deepEqual(segunda.corpo, primeira.corpo);

    const atual = doArtesao(primeira.corpo);
    const cookie = await api.cookie(USUARIOS.artesao);
    const corpo = {
      nome: atual.nome,
      descricao: atual.descricao,
      preco: atual.preco,
      estoqueQtd: atual.estoqueQtd + 1,
      ...(atual.imagemUrl ? { imagemUrl: atual.imagemUrl } : {}),
    };
    const r = await fetch(`${api.url}/produtos/${PRODUTO_DO_ARTESAO}`, { method: "PATCH", ...json(corpo, cookie) });
    assert.equal(r.status, 200);
    await r.body?.cancel();

    const depois = await ler("/produtos");
    assert.equal(depois.xCache, "MISS");
    assert.equal(doArtesao(depois.corpo).estoqueQtd, atual.estoqueQtd + 1);
  });

  itComBanco("POST /pedidos: apaga produtos e recomendações do comprador em cache", async () => {
    const comprador = await api.cookie(USUARIOS.comprador);
    await ler("/produtos");
    // A fila reaquece a chave de limite 4, usada pela vitrine. Use outra chave para testar a invalidação.
    const recomendacoes = "/recomendacoes?limite=3";
    await ler(recomendacoes, comprador);
    assert.equal((await ler(recomendacoes, comprador)).xCache, "HIT");
    const antes = doArtesao((await ler("/produtos")).corpo).estoqueQtd;

    const r = await fetch(`${api.url}/pedidos`, {
      method: "POST",
      ...json({ itens: [{ produtoId: PRODUTO_DO_ARTESAO, quantidade: 1 }] }, comprador),
    });
    assert.equal(r.status, 201);
    pedidosCriados.push(((await r.json()) as { id: string }).id);

    assert.equal((await ler(recomendacoes, comprador)).xCache, "MISS");
    const vitrine = await ler("/produtos");
    assert.equal(vitrine.xCache, "MISS");
    assert.equal(doArtesao(vitrine.corpo).estoqueQtd, antes - 1);
  });
});
