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

  itComBanco("TC11: produto novo fica pendente e fora da vitrine e do checkout", async () => {
    const artesao = await api.cookie(USUARIOS.artesao);
    const comprador = await api.cookie(USUARIOS.comprador);
    const outroArtesao = await api.cookie(USUARIOS.outroArtesao);
    const admin = await api.cookie(USUARIOS.admin);
    const novo = await criar("/produtos", {
      nome: "Peça pendente de curadoria TC11",
      descricao: "Descrição da peça",
      tecnica: "Têxtil",
      categoria: "Categoria pendente TC11",
      preco: 100,
      estoqueQtd: 2,
      statusCuradoria: "aprovado", // Somente a decisão de curadoria pode publicar.
    }, artesao);
    assert.equal(novo.status, 201);
    assert.equal(novo.corpo.statusCuradoria, "pendente");
    const id = novo.corpo.id as string;

    const get = (caminho: string, cookie?: string) =>
      fetch(`${api.url}${caminho}`, { headers: cookie ? { cookie } : {} });

    const busca = await get("/produtos?busca=Peça%20pendente%20de%20curadoria%20TC11", artesao);
    assert.equal(busca.status, 200);
    assert.deepEqual(await busca.json(), []);
    assert.equal((await get(`/produtos/${id}`)).status, 404);

    const perfil = await get(`/artesaos/${novo.corpo.artesaoId}`);
    assert.equal(perfil.status, 200);
    assert.ok(!(await perfil.json()).produtos.some((p: { id: string }) => p.id === id));

    const relacionados = await get(`/produtos/${PRODUTO_DO_ARTESAO}/relacionados?limite=20`);
    assert.equal(relacionados.status, 200);
    assert.ok(!(await relacionados.json()).some((p: { id: string }) => p.id === id));

    const recomendacoes = await get("/recomendacoes?limite=20");
    assert.equal(recomendacoes.status, 200);
    assert.ok(!(await recomendacoes.json()).dados.some((p: { id: string }) => p.id === id));

    const gestao = "/produtos?visao=gestao";
    assert.equal((await get(gestao)).status, 401);
    assert.equal((await get(gestao, comprador)).status, 403);
    for (const [cookie, podeVer] of [[artesao, true], [admin, true], [outroArtesao, false]] as const) {
      const r = await get(gestao, cookie);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("cache-control"), "private, no-store");
      assert.equal((await r.json()).some((p: { id: string }) => p.id === id), podeVer);
    }

    const pedido = await criar("/pedidos", { itens: [{ produtoId: id, quantidade: 1 }] }, comprador);
    assert.equal(pedido.status, 409);
    assert.match(pedido.corpo.erro, /não está disponível/);
    const { rows } = await banco!.query<{ estoque_qtd: number }>(
      "SELECT estoque_qtd FROM origem.produto WHERE id = $1", [id]
    );
    assert.equal(rows[0]?.estoque_qtd, 2);
  });

  itComBanco("TC16: só admin aprova e torna o produto encontrável no catálogo público", async () => {
    const artesao = await api.cookie(USUARIOS.artesao);
    const comprador = await api.cookie(USUARIOS.comprador);
    const admin = await api.cookie(USUARIOS.admin);
    const novo = await criar("/produtos", {
      nome: "Peça para aprovação TC16",
      descricao: "Descrição da peça",
      tecnica: "Têxtil",
      categoria: "Categoria TC16",
      preco: 95,
      estoqueQtd: 2,
    }, artesao);
    assert.equal(novo.status, 201);
    const id = novo.corpo.id as string;
    const rota = `${api.url}/produtos/${id}/curadoria`;
    const aprovar = (cookie?: string, status = "aprovado") =>
      fetch(rota, { method: "PATCH", ...json({ status }, cookie) });
    const busca = `${api.url}/produtos?busca=aprova%C3%A7%C3%A3o%20TC16`;
    assert.deepEqual(await (await fetch(busca)).json(), []);
    assert.equal((await aprovar()).status, 401);
    assert.equal((await aprovar(artesao)).status, 403);
    assert.equal((await aprovar(comprador)).status, 403);
    assert.equal((await aprovar(admin, "pendente")).status, 400);
    assert.equal((await fetch(`${api.url}/produtos/${id}`)).status, 404);

    const resposta = await aprovar(admin);
    assert.equal(resposta.status, 200);
    assert.equal((await resposta.json()).statusCuradoria, "aprovado");
    assert.equal((await aprovar(admin)).status, 200);
    assert.ok((await (await fetch(busca)).json()).some((p: { id: string }) => p.id === id));
    assert.equal((await fetch(`${api.url}/produtos/${id}`)).status, 200);
    const { rows } = await banco!.query<{ status_curadoria: string }>(
      "SELECT status_curadoria FROM origem.produto WHERE id = $1", [id]
    );
    assert.equal(rows[0]?.status_curadoria, "aprovado");
  });

  itComBanco("TC17: rejeita produto pendente com justificativa persistida e mantém a vitrine protegida", async () => {
    const artesao = await api.cookie(USUARIOS.artesao);
    const comprador = await api.cookie(USUARIOS.comprador);
    const admin = await api.cookie(USUARIOS.admin);
    const novo = await criar("/produtos", {
      nome: "Peça em avaliação TC17",
      descricao: "Descrição da peça",
      tecnica: "Têxtil",
      categoria: "Categoria TC17",
      preco: 95,
      estoqueQtd: 2,
    }, artesao);
    assert.equal(novo.status, 201);
    const id = novo.corpo.id as string;
    const rejeitar = (justificativa: unknown, cookie?: string, produtoId = id) => fetch(
      `${api.url}/produtos/${produtoId}/curadoria`,
      { method: "PATCH", ...json({ status: "rejeitado", justificativa }, cookie) }
    );
    const motivo = "A descrição precisa indicar a origem da peça.";
    assert.equal((await rejeitar(motivo)).status, 401);
    assert.equal((await rejeitar(motivo, artesao)).status, 403);
    assert.equal((await rejeitar(motivo, comprador)).status, 403);
    assert.equal((await rejeitar(undefined, admin)).status, 400);
    assert.equal((await rejeitar("   ", admin)).status, 400);
    assert.equal((await rejeitar("x".repeat(501), admin)).status, 400);
    assert.equal((await rejeitar(motivo, admin, PRODUTO_DO_ARTESAO)).status, 409);

    const resposta = await rejeitar(`  ${motivo}  `, admin);
    assert.equal(resposta.status, 200);
    const rejeitado = await resposta.json();
    assert.equal(rejeitado.statusCuradoria, "rejeitado");
    assert.equal(rejeitado.rejeicaoCuradoria.justificativa, motivo);
    assert.equal(rejeitado.rejeicaoCuradoria.autorId, USUARIOS.admin.id);
    assert.ok(Number.isFinite(Date.parse(rejeitado.rejeicaoCuradoria.data)));
    const repetido = await rejeitar(motivo, admin);
    assert.equal(repetido.status, 200);
    assert.deepEqual((await repetido.json()).rejeicaoCuradoria, rejeitado.rejeicaoCuradoria);
    assert.equal((await rejeitar("Outra justificativa.", admin)).status, 409);
    assert.equal((await fetch(`${api.url}/produtos/${id}/curadoria`, {
      method: "PATCH", ...json({ status: "aprovado" }, admin),
    })).status, 409);

    const gestao = `${api.url}/produtos?visao=gestao`;
    const listaAdmin: { id: string; rejeicaoCuradoria?: unknown }[] =
      await (await fetch(gestao, { headers: { cookie: admin } })).json();
    assert.deepEqual(listaAdmin.find((produto) => produto.id === id)?.rejeicaoCuradoria, rejeitado.rejeicaoCuradoria);
    const listaArtesao: { id: string; statusCuradoria: string; rejeicaoCuradoria?: unknown }[] =
      await (await fetch(gestao, { headers: { cookie: artesao } })).json();
    const produtoDoArtesao = listaArtesao.find((produto) => produto.id === id);
    assert.equal(produtoDoArtesao?.statusCuradoria, "rejeitado");
    assert.equal(produtoDoArtesao?.rejeicaoCuradoria, undefined);
    assert.equal((await fetch(`${api.url}/produtos/${id}`)).status, 404);
    assert.deepEqual(await (await fetch(`${api.url}/produtos?busca=TC17`)).json(), []);
    assert.equal((await criar("/pedidos", { itens: [{ produtoId: id, quantidade: 1 }] }, comprador)).status, 409);
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
