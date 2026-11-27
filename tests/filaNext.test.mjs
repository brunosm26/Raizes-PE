import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Fila assíncrona e notificações nas rotas app/api do Next (fallback sem API_URL), com o mesmo
// contrato do Express: o checkout e o PATCH respondem sem esperar o worker, e cada usuário só
// vê e marca as próprias notificações. Sessão, pedidos e recomendações viram dublês. Sem banco.

const require = createRequire(import.meta.url);
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

require.extensions[".ts"] = function (modulo, arquivo) {
  const { outputText } = ts.transpileModule(fs.readFileSync(arquivo, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  modulo._compile(outputText, arquivo);
};

const resolverOriginal = Module._resolveFilename;
Module._resolveFilename = function (pedido, pai, ...resto) {
  if (pedido.startsWith("@/")) return resolverOriginal.call(this, path.join(raiz, pedido.slice(2)), pai, ...resto);
  return resolverOriginal.call(this, pedido, pai, ...resto);
};

function dublar(relativo, exportados) {
  const arquivo = require.resolve(path.join(raiz, relativo));
  const modulo = new Module(arquivo);
  modulo.filename = arquivo;
  modulo.loaded = true;
  modulo.exports = exportados;
  require.cache[arquivo] = modulo;
}

const COMPRADOR = { id: "10000000-0000-4000-8000-000000000007", nome: "Ana Beatriz", tipo: "comprador" };
const ARTESAO = { id: "10000000-0000-4000-8000-000000000002", nome: "Tacaratu", tipo: "artesao" };
const ADMIN = { id: "10000000-0000-4000-8000-000000000009", nome: "Admin", tipo: "admin" };
const PEDIDO_ID = "4a1b2c3d-0000-4000-8000-000000000001";

const pedidoFalso = (status = "pendente") => ({
  id: PEDIDO_ID,
  compradorId: COMPRADOR.id,
  compradorNome: COMPRADOR.nome,
  dataPedido: "2026-11-19T12:00:00.000Z",
  status,
  valorTotal: 80,
  itens: [
    { id: "i1", pedidoId: PEDIDO_ID, produtoId: "x1", quantidade: 2, precoUnitario: 40, produtoNome: "Tapete", produtoTecnica: "Têxtil", artesaoUsuarioId: ARTESAO.id, artesaoNome: ARTESAO.nome },
  ],
});

let sessaoAtual = null;
const consultasAdministrativas = [];
const recomendacoes = { atrasoMs: 100, chamadas: [] };

class ErroAuth extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}
class ErroPedido extends Error {
  status = 400;
}

dublar("lib/servidor/auth.ts", {
  ErroAuth,
  obterSessao: async () => sessaoAtual,
  exigirSessao: async (perfis) => {
    if (!sessaoAtual) throw new ErroAuth("Faça login para continuar.", 401);
    if (perfis && !perfis.includes(sessaoAtual.tipo)) throw new ErroAuth("Seu perfil não tem permissão para esta ação.", 403);
    return sessaoAtual;
  },
});
dublar("lib/servidor/pedidos.ts", {
  ErroPedido,
  criarPedido: async () => pedidoFalso(),
  atualizarStatus: async (_id, status) => pedidoFalso(status),
  listarPedidos: async () => [],
  listarPedidosAdministrativos: async (periodo) => {
    consultasAdministrativas.push(periodo);
    return [];
  },
  listarPedidosDoArtesao: async () => [],
});
dublar("lib/motorRecomendacao.ts", {
  calcularRecomendacoes: async (compradorId) => {
    recomendacoes.chamadas.push(compradorId);
    await new Promise((ok) => setTimeout(ok, recomendacoes.atrasoMs));
    return [];
  },
});

const { NextRequest } = require("next/server");
const rota = (arquivo) => require(path.join(raiz, "app", "api", ...arquivo.split("/"), "route.ts"));
const pedidos = rota("pedidos");
const pedido = rota("pedidos/[id]");
const notificacoes = rota("notificacoes");
const ler = rota("notificacoes/ler");
const { caixaNotificacoes, filaAssincrona } = require(path.join(raiz, "lib", "servidor", "processamentoAssincrono.ts"));

const requisicao = (metodo, dados) =>
  new NextRequest("http://localhost:3000/api/x", { method: metodo, ...(dados === undefined ? {} : { body: JSON.stringify(dados) }) });
const params = { params: Promise.resolve({ id: PEDIDO_ID }) };

async function caixaDe(usuario) {
  sessaoAtual = usuario;
  const r = await notificacoes.GET();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  return r.json();
}

beforeEach(async () => {
  await filaAssincrona.aguardarOcioso();
  filaAssincrona.limpar();
  caixaNotificacoes.limpar();
  recomendacoes.chamadas = [];
  sessaoAtual = null;
});

describe("fila assíncrona no fallback do Next", () => {
  it("fila e notificações são cópias idênticas das do Express", () => {
    const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8").replace(/\r\n/g, "\n");
    for (const arquivo of ["filaAssincrona.ts", "notificacoesPedido.ts"]) {
      assert.equal(ler("lib", "servidor", arquivo), ler("backend", "src", "utils", arquivo), arquivo);
    }
  });

  it("POST /api/pedidos responde 201 sem esperar o job; o worker avisa comprador e artesão", async () => {
    sessaoAtual = COMPRADOR;
    const r = await pedidos.POST(requisicao("POST", { itens: [{ produtoId: "x1", quantidade: 2 }] }));
    assert.equal(r.status, 201);
    const [job] = filaAssincrona.jobsRecentes();
    assert.equal(job.tipo, "pedido.criado");
    assert.notEqual(job.status, "concluido", "a resposta esperou o job");

    await filaAssincrona.aguardarOcioso();
    assert.equal(filaAssincrona.buscar(job.id).status, "concluido");
    assert.deepEqual(recomendacoes.chamadas, [COMPRADOR.id]);
    assert.deepEqual((await caixaDe(COMPRADOR)).dados.map((n) => n.tipo), ["pedido.recebido"]);
    const artesao = await caixaDe(ARTESAO);
    assert.equal(artesao.dados[0].tipo, "pedido.nova_venda");
    assert.match(artesao.dados[0].resumoWhatsapp, /2x Tapete/);
  });

  it("PATCH /api/pedidos/:id 'enviado' gera o aviso do comprador; admin vê a fila", async () => {
    sessaoAtual = ARTESAO;
    const r = await pedido.PATCH(requisicao("PATCH", { status: "enviado" }), params);
    assert.equal(r.status, 200);
    await filaAssincrona.aguardarOcioso();

    const comprador = await caixaDe(COMPRADOR);
    assert.deepEqual(comprador.dados.map((n) => n.tipo), ["pedido.enviado"]);
    assert.equal(comprador.fila, undefined);
    const admin = await caixaDe(ADMIN);
    assert.equal(admin.total, 0);
    assert.deepEqual(admin.fila.contagem, { pendente: 0, processando: 0, concluido: 1, erro: 0 });
    assert.equal(admin.fila.jobsRecentes[0].tipo, "pedido.status_atualizado");
  });

  it("POST /api/notificacoes/ler marca só as do usuário logado", async () => {
    sessaoAtual = COMPRADOR;
    await pedidos.POST(requisicao("POST", { itens: [{ produtoId: "x1", quantidade: 2 }] }));
    await filaAssincrona.aguardarOcioso();

    const idDoArtesao = (await caixaDe(ARTESAO)).dados[0].id;
    sessaoAtual = COMPRADOR;
    let r = await ler.POST(requisicao("POST", { ids: [idDoArtesao] }));
    assert.deepEqual(await r.json(), { marcadas: 0, naoLidas: 1 });
    r = await ler.POST(requisicao("POST"));
    assert.deepEqual(await r.json(), { marcadas: 1, naoLidas: 0 });
    assert.equal((await caixaDe(ARTESAO)).naoLidas, 1);
  });

  it("erros: 401 sem sessão, 400 para corpo inválido ou ids fora do formato", async () => {
    assert.equal((await notificacoes.GET()).status, 401);
    assert.equal((await ler.POST(requisicao("POST", {}))).status, 401);
    sessaoAtual = COMPRADOR;
    const invalido = new NextRequest("http://localhost:3000/api/x", { method: "POST", body: "{invalido" });
    assert.equal((await ler.POST(invalido)).status, 400);
    const r = await ler.POST(requisicao("POST", { ids: "tudo" }));
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(await r.json()), ["ok", "erro"]);
  });
});


describe("período administrativo dos pedidos (fallback Next)", () => {
  const consultar = (query) => pedidos.GET(new NextRequest("http://localhost:3000/api/pedidos" + query));

  it("valida a sessão e encaminha apenas limites válidos para a consulta administrativa", async () => {
    assert.equal((await consultar("?inicio=2025-07-02")).status, 401);
    sessaoAtual = COMPRADOR;
    assert.equal((await consultar("?inicio=2025-07-02")).status, 403);
    sessaoAtual = ADMIN;
    assert.equal((await consultar("?inicio=2025-02-29")).status, 400);
    assert.equal((await consultar("?inicio=2025-07-02&inicio=2025-07-03")).status, 400);
    assert.equal((await consultar("?inicio=2025-07-03&fim=2025-07-02")).status, 400);
    const resposta = await consultar("?inicio=2025-07-02&fim=2025-07-02");
    assert.equal(resposta.status, 200);
    assert.deepEqual(await resposta.json(), []);
    assert.deepEqual(consultasAdministrativas, [{ inicio: "2025-07-02", fim: "2025-07-02" }]);
  });
});
