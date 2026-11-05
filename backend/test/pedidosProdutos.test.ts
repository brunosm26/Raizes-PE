import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import {
  bancoDeTeste,
  itComBanco,
  json,
  PRODUTO_DE_OUTRO,
  PRODUTO_DO_ARTESAO,
  semBanco,
  subirApi,
  USUARIOS,
  type Api,
} from "./ajudantes";

let api: Api;
before(async () => {
  api = await subirApi();
});
after(() => api?.fechar()); // com --test-name-pattern o after pode rodar antes do before (ver subirApi)

describe("pedidos e produtos: sem banco", () => {
  it("GET /pedidos sem login responde 401 { ok, erro }", async () => {
    const r = await fetch(`${api.url}/pedidos`);
    assert.equal(r.status, 401);
    assert.deepEqual(await r.json(), { ok: false, erro: "Faça login para continuar." });
  });

  it("POST /produtos com JSON inválido responde 400", async () => {
    const r = await fetch(`${api.url}/produtos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{nao é json",
    });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).erro, "Corpo da requisição inválido.");
  });

  it("cookie adulterado conta como visitante", async () => {
    const cookie = (await api.cookie(USUARIOS.comprador)).slice(0, -2) + "xx";
    const r = await fetch(`${api.url}/pedidos`, { headers: { cookie } });
    assert.equal(r.status, 401);
  });
});

describe("pedidos e produtos: com banco", () => {
  // Produtos da carga cujo estoque os pedidos abaixo baixam: Tapete (do Tacaratu) e Renda (p4).
  const COM_ESTOQUE_BAIXADO = [PRODUTO_DO_ARTESAO, "30000000-0000-4000-8000-000000000004"];
  const criados = { pedidos: [] as string[], produtos: [] as string[] };
  let estoqueInicial: { id: string; estoque: number }[] = [];
  let banco: Pool | undefined;

  // O banco é descartável, mas a suíte deixa ele como encontrou: guarda o estoque antes e,
  // no fim, apaga só o que ela criou (os itens saem junto com o pedido) e restaura o estoque.
  before(async () => {
    if (semBanco) return;
    banco = new Pool({ connectionString: bancoDeTeste });
    const { rows } = await banco.query<{ id: string; estoque: number }>(
      "SELECT id, estoque_qtd AS estoque FROM origem.produto WHERE id = ANY($1::uuid[])",
      [COM_ESTOQUE_BAIXADO]
    );
    estoqueInicial = rows;
  });

  after(async () => {
    if (!banco) return;
    const cliente = await banco.connect();
    try {
      await cliente.query("BEGIN");
      await cliente.query("DELETE FROM origem.pedido WHERE id = ANY($1::uuid[])", [criados.pedidos]);
      await cliente.query("DELETE FROM origem.produto WHERE id = ANY($1::uuid[])", [criados.produtos]);
      await cliente.query(
        `UPDATE origem.produto p SET estoque_qtd = s.estoque
           FROM unnest($1::uuid[], $2::int[]) AS s(id, estoque)
          WHERE p.id = s.id`,
        [estoqueInicial.map((e) => e.id), estoqueInicial.map((e) => e.estoque)]
      );
      await cliente.query("COMMIT");
    } catch (erro) {
      await cliente.query("ROLLBACK");
      throw erro;
    } finally {
      cliente.release();
      await banco.end();
    }
  });

  // POST que guarda o id do que foi criado (201), para a limpeza do after.
  async function criar(caminho: "/pedidos" | "/produtos", corpo: unknown, cookie: string) {
    const r = await fetch(`${api.url}${caminho}`, { method: "POST", ...json(corpo, cookie) });
    const resposta = await r.json();
    if (r.status === 201) criados[caminho === "/pedidos" ? "pedidos" : "produtos"].push(resposta.id);
    return { status: r.status, corpo: resposta };
  }

  itComBanco("comprador cria pedido (201), total vem do banco e o estoque baixa", async () => {
    const cookie = await api.cookie(USUARIOS.comprador);
    const antes = await (await fetch(`${api.url}/pedidos`, { headers: { cookie } })).json();

    const r = await criar("/pedidos", { itens: [{ produtoId: "p4", quantidade: 1 }, { produtoId: "p4", quantidade: 1 }] }, cookie);
    assert.equal(r.status, 201);
    const pedido = r.corpo;
    assert.equal(pedido.status, "pendente");
    assert.equal(pedido.valorTotal, 190);
    assert.equal(pedido.itens.length, 1);
    assert.equal(pedido.itens[0].quantidade, 2);

    const depois = await (await fetch(`${api.url}/pedidos`, { headers: { cookie } })).json();
    assert.equal(depois.length, antes.length + 1);
  });

  itComBanco("identidade e preço vêm do servidor: compradorId, valorTotal e precoUnitario do corpo são ignorados", async () => {
    const r = await criar(
      "/pedidos",
      {
        compradorId: USUARIOS.admin.id,
        valorTotal: 1,
        status: "entregue",
        itens: [{ produtoId: "p4", quantidade: 1, precoUnitario: 0.01 }],
      },
      await api.cookie(USUARIOS.comprador)
    );
    assert.equal(r.status, 201);
    const pedido = r.corpo;
    assert.equal(pedido.compradorId, USUARIOS.comprador.id);
    assert.equal(pedido.status, "pendente");
    assert.equal(pedido.valorTotal, 95);
    assert.equal(pedido.itens[0].precoUnitario, 95);
  });

  itComBanco("artesão não vê pedido que só tem produto de outro artesão", async () => {
    const r = await criar("/pedidos", { itens: [{ produtoId: PRODUTO_DO_ARTESAO, quantidade: 1 }] }, await api.cookie(USUARIOS.comprador));
    assert.equal(r.status, 201, `o pedido de apoio não foi criado: ${JSON.stringify(r.corpo)}`);
    const criado = r.corpo;
    const doOutro = await (await fetch(`${api.url}/pedidos`, { headers: { cookie: await api.cookie(USUARIOS.outroArtesao) } })).json();
    assert.ok(!doOutro.some((p: { id: string }) => p.id === criado.id));
    const doDono = await (await fetch(`${api.url}/pedidos`, { headers: { cookie: await api.cookie(USUARIOS.artesao) } })).json();
    assert.ok(doDono.some((p: { id: string }) => p.id === criado.id));
  });

  itComBanco("artesão não cria pedido (403) e quantidade acima do estoque dá 409", async () => {
    const r1 = await criar("/pedidos", { itens: [{ produtoId: "p4", quantidade: 1 }] }, await api.cookie(USUARIOS.artesao));
    assert.equal(r1.status, 403);

    const r2 = await criar("/pedidos", { itens: [{ produtoId: "p3", quantidade: 99 }] }, await api.cookie(USUARIOS.comprador));
    assert.equal(r2.status, 409);
    assert.match(r2.corpo.erro, /Só restam|esgotado/);
  });

  itComBanco("artesão só marca como enviado pedido com produto dele", async () => {
    const comprador = await api.cookie(USUARIOS.comprador);
    const r = await criar("/pedidos", { itens: [{ produtoId: PRODUTO_DO_ARTESAO, quantidade: 1 }] }, comprador);
    assert.equal(r.status, 201, `o pedido de apoio não foi criado: ${JSON.stringify(r.corpo)}`);
    const criado = r.corpo;

    const alheio = await fetch(`${api.url}/pedidos/${criado.id}`, {
      method: "PATCH",
      ...json({ status: "enviado" }, await api.cookie(USUARIOS.outroArtesao)),
    });
    assert.equal(alheio.status, 403);

    const dono = await api.cookie(USUARIOS.artesao);
    const pago = await fetch(`${api.url}/pedidos/${criado.id}`, { method: "PATCH", ...json({ status: "pago" }, dono) });
    assert.equal(pago.status, 403);

    const enviado = await fetch(`${api.url}/pedidos/${criado.id}`, {
      method: "PATCH",
      ...json({ status: "enviado" }, dono),
    });
    assert.equal(enviado.status, 200);
    assert.equal((await enviado.json()).status, "enviado");
  });

  itComBanco("produto é sempre da loja do artesão da sessão: usuarioId e artesaoId do corpo são ignorados", async () => {
    const r = await criar(
      "/produtos",
      {
        usuarioId: USUARIOS.outroArtesao.id,
        artesaoId: "20000000-0000-4000-8000-000000000001",
        nome: "Cesto de Teste",
        descricao: "Teste",
        tecnica: "Palha",
        categoria: "Cestos",
        preco: 20,
        estoqueQtd: 1,
      },
      await api.cookie(USUARIOS.artesao)
    );
    assert.equal(r.status, 201);
    assert.equal(r.corpo.artesaoId, "20000000-0000-4000-8000-000000000002"); // loja do Tacaratu
  });

  itComBanco("artesão cadastra produto (201) e não edita produto de outro (403)", async () => {
    const cookie = await api.cookie(USUARIOS.artesao);
    const r = await criar(
      "/produtos",
      { nome: "Bolsa de Palha", descricao: "Teste", tecnica: "Palha", categoria: "Bolsas", preco: "59.9", estoqueQtd: 4 },
      cookie
    );
    assert.equal(r.status, 201);
    const criado = r.corpo;
    assert.equal(criado.preco, 59.9);
    assert.equal(criado.artesaoUsuarioId, USUARIOS.artesao.id);
    assert.equal("imagemUrl" in criado, false);

    const invalido = await criar(
      "/produtos",
      { nome: "X", descricao: "Y", tecnica: "Plástico", categoria: "Z", preco: 1, estoqueQtd: 1 },
      cookie
    );
    assert.equal(invalido.status, 400);

    const alheio = await fetch(`${api.url}/produtos/${PRODUTO_DE_OUTRO}`, {
      method: "PATCH",
      ...json({ nome: "Outro", descricao: "D", preco: 10, estoqueQtd: 1 }, cookie),
    });
    assert.equal(alheio.status, 403);

    const editado = await fetch(`${api.url}/produtos/${criado.id}`, {
      method: "PATCH",
      ...json({ nome: "Bolsa de Palha Grande", descricao: "D", preco: 79, estoqueQtd: 2 }, cookie),
    });
    assert.equal(editado.status, 200);
    assert.equal((await editado.json()).nome, "Bolsa de Palha Grande");
  });
});
