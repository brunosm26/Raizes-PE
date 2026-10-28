import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { itComBanco, json, subirApi, USUARIOS, type Api } from "./ajudantes";

let api: Api;
before(async () => {
  api = await subirApi();
});
after(() => api.fechar());

function cookieDaResposta(r: Response): string {
  const cabecalho = r.headers.get("set-cookie") ?? "";
  return cabecalho.split(";")[0] ?? "";
}

describe("auth, catálogo, recomendações e painel: sem banco", () => {
  it("login sem e-mail ou senha responde 400", async () => {
    const r = await fetch(`${api.url}/auth/login`, { method: "POST", ...json({ email: "a@b.c" }) });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).erro, "Informe e-mail e senha.");
  });

  it("cadastro com senha curta responde 400", async () => {
    const r = await fetch(`${api.url}/auth/cadastro`, {
      method: "POST",
      ...json({ nome: "Teste", email: "t@t.com", senha: "123" }),
    });
    assert.equal(r.status, 400);
  });

  it("logout apaga o cookie", async () => {
    const r = await fetch(`${api.url}/auth/logout`, { method: "POST" });
    assert.deepEqual(await r.json(), { ok: true });
    assert.match(r.headers.get("set-cookie") ?? "", /raizes_sessao=;.*Max-Age=0/);
  });

  it("painel sem login responde 401", async () => {
    assert.equal((await fetch(`${api.url}/painel/estatisticas`)).status, 401);
  });

  it("rota inexistente responde 404 em JSON", async () => {
    const r = await fetch(`${api.url}/nao-existe`);
    assert.equal(r.status, 404);
    assert.equal((await r.json()).ok, false);
  });
});

describe("auth, catálogo, recomendações e painel: com banco", () => {
  itComBanco("login de demonstração grava o cookie e /auth/me reconhece a sessão", async () => {
    const r = await fetch(`${api.url}/auth/login`, {
      method: "POST",
      ...json({ email: "ANA.BEATRIZ@raizespe.dev", senha: "demo123", perfil: "comprador" }),
    });
    assert.equal(r.status, 200);
    const { usuario } = await r.json();
    assert.equal(usuario.tipo, "comprador");
    assert.match(r.headers.get("set-cookie") ?? "", /HttpOnly/i);

    const me = await (await fetch(`${api.url}/auth/me`, { headers: { cookie: cookieDaResposta(r) } })).json();
    assert.deepEqual(me, { usuario: { id: usuario.id, nome: usuario.nome, tipo: "comprador" } });
  });

  itComBanco("login na aba errada responde 403 e senha errada responde 401, com freio após 5 falhas", async () => {
    const aba = await fetch(`${api.url}/auth/login`, {
      method: "POST",
      ...json({ email: "tacaratu@raizespe.dev", senha: "demo123", perfil: "comprador" }),
    });
    assert.equal(aba.status, 403);

    const tentativa = () =>
      fetch(`${api.url}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
        body: JSON.stringify({ email: "admin@raizespe.dev", senha: "errada" }),
      });
    for (let i = 0; i < 5; i++) assert.equal((await tentativa()).status, 401);
    assert.equal((await tentativa()).status, 429);
  });

  itComBanco("cadastro cria comprador (201) e e-mail repetido dá 409", async () => {
    const corpo = { nome: "Comprador Teste", email: `teste.${Date.now()}@exemplo.com`, senha: "senha-segura" };
    const r = await fetch(`${api.url}/auth/cadastro`, { method: "POST", ...json(corpo) });
    assert.equal(r.status, 201);
    assert.equal((await r.json()).usuario.tipo, "comprador");
    assert.equal((await fetch(`${api.url}/auth/cadastro`, { method: "POST", ...json(corpo) })).status, 409);
  });

  itComBanco("vitrine filtra por técnica e busca sem acento", async () => {
    const todos = await (await fetch(`${api.url}/produtos`)).json();
    assert.ok(todos.length >= 7);

    const ceramica = await (await fetch(`${api.url}/produtos?tecnica=${encodeURIComponent("Cerâmica")}`)).json();
    assert.ok(ceramica.length > 0 && ceramica.every((p: { tecnica: string }) => p.tecnica === "Cerâmica"));

    const busca = await (await fetch(`${api.url}/produtos?busca=ceramica`)).json();
    assert.equal(busca.length, ceramica.length);
  });

  itComBanco("produto aceita id legado, 404 para inexistente, relacionados e avaliações", async () => {
    const p1 = await fetch(`${api.url}/produtos/p1`);
    assert.equal(p1.status, 200);
    const produto = await p1.json();
    assert.equal(produto.id, "30000000-0000-4000-8000-000000000001");

    const inexistente = await fetch(`${api.url}/produtos/qualquer-coisa`);
    assert.equal(inexistente.status, 404);
    assert.deepEqual(await inexistente.json(), { ok: false, erro: "Produto não encontrado" });

    const rel = await (await fetch(`${api.url}/produtos/p1/relacionados?limite=1`)).json();
    assert.ok(rel.length <= 1 && rel.every((p: { id: string; tecnica: string }) => p.id !== produto.id && p.tecnica === produto.tecnica));

    const av = await (await fetch(`${api.url}/produtos/p1/avaliacoes`)).json();
    assert.equal(typeof av.media, "number");
    assert.equal(typeof av.quantidade, "number");
  });

  itComBanco("perfil do artesão traz os produtos dele", async () => {
    const r = await fetch(`${api.url}/artesaos/a2`);
    assert.equal(r.status, 200);
    const perfil = await r.json();
    assert.ok(perfil.produtos.length > 0);
    assert.ok(perfil.produtos.every((p: { artesaoId: string }) => p.artesaoId === perfil.id));
    assert.equal((await fetch(`${api.url}/artesaos/a999`)).status, 404);
  });

  itComBanco("recomendações: visitante recebe cold start, comprador recebe pela sessão", async () => {
    const visitante = await (await fetch(`${api.url}/recomendacoes?limite=2`)).json();
    assert.equal(visitante.sucesso, true);
    assert.equal(visitante.compradorId, null);
    assert.equal(visitante.total, 2);

    const cookie = await api.cookie(USUARIOS.comprador);
    const comprador = await (await fetch(`${api.url}/recomendacoes`, { headers: { cookie } })).json();
    assert.equal(comprador.compradorId, USUARIOS.comprador.id);
    assert.ok(comprador.dados.length <= 4);
  });

  itComBanco("painel: comprador 403, artesão recebe 6 meses de histórico", async () => {
    const comprador = await fetch(`${api.url}/painel/estatisticas`, {
      headers: { cookie: await api.cookie(USUARIOS.comprador) },
    });
    assert.equal(comprador.status, 403);

    const r = await fetch(`${api.url}/painel/estatisticas`, { headers: { cookie: await api.cookie(USUARIOS.artesao) } });
    assert.equal(r.status, 200);
    const est = await r.json();
    assert.equal(est.historicoMensal.length, 6);
    assert.equal(typeof est.pedidosPendentes, "number");
  });

  itComBanco("saúde do banco conta os produtos", async () => {
    const r = await (await fetch(`${api.url}/saude-bd`)).json();
    assert.equal(r.ok, true);
    assert.equal(typeof r.produtos, "number");
  });
});
