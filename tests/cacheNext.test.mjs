import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Cache nas rotas app/api do Next (fallback sem API_URL), com o mesmo contrato do Express:
// X-Cache MISS/HIT e Cache-Control nas três leituras e invalidação nas quatro escritas.
// Os módulos de dados e a sessão viram dublês que contam as chamadas. Sem banco e sem servidor.

const require = createRequire(import.meta.url);
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.CACHE_TTL_SEGUNDOS = "60";

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
const chamadas = { filtros: 0, produtos: 0, recomendacoes: [] };
let sessaoAtual = null;

class ErroAuth extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}
class ErroDados extends Error {
  status = 400;
}

dublar("lib/servidor/auth.ts", {
  ErroAuth,
  obterSessao: async () => sessaoAtual,
  exigirSessao: async () => {
    if (!sessaoAtual) throw new ErroAuth("Faça login para continuar.", 401);
    return sessaoAtual;
  },
});
dublar("lib/servidor/filtros.ts", {
  obterOpcoesFiltros: async () => ({ tecnicas: [], regioes: [], categorias: [`leitura-${++chamadas.filtros}`] }),
});
dublar("lib/servidor/catalogo.ts", {
  listarProdutos: async () => [{ id: "p1", leitura: ++chamadas.produtos }],
  buscarProduto: async () => null,
});
dublar("lib/motorRecomendacao.ts", {
  calcularRecomendacoes: async (compradorId, limite) => {
    chamadas.recomendacoes.push({ compradorId, limite });
    return [];
  },
});
let falharEscrita = false;
const escrita = async () => {
  if (falharEscrita) throw new ErroDados("Dados inválidos (dublê).");
  return { id: "x" };
};
dublar("lib/servidor/produtos.ts", { ErroProduto: ErroDados, criarProduto: escrita, editarProduto: escrita, arquivarProduto: escrita });
dublar("lib/servidor/pedidos.ts", {
  ErroPedido: ErroDados,
  criarPedido: escrita,
  atualizarStatus: escrita,
  listarPedidos: async () => [],
  listarPedidosDoArtesao: async () => [],
});
// A fila assíncrona das escritas de pedido tem teste próprio (tests/filaNext.test.mjs).
dublar("lib/servidor/processamentoAssincrono.ts", {
  enfileirarPedidoCriado: () => null,
  enfileirarStatusAtualizado: () => null,
});

const { NextRequest } = require("next/server");
const rota = (arquivo) => require(path.join(raiz, "app", "api", ...arquivo.split("/"), "route.ts"));
const filtros = rota("filtros");
const produtos = rota("produtos");
const produto = rota("produtos/[id]");
const pedidos = rota("pedidos");
const pedido = rota("pedidos/[id]");
const recomendacoes = rota("recomendacoes");
const { invalidarCatalogo } = require(path.join(raiz, "lib", "servidor", "cacheCatalogo.ts"));

const url = (caminho) => new NextRequest(`http://localhost:3000/api${caminho}`);
const corpo = (metodo, dados = {}) =>
  new NextRequest("http://localhost:3000/api/x", { method: metodo, body: JSON.stringify(dados) });
const params = { params: Promise.resolve({ id: "30000000-0000-4000-8000-000000000002" }) };

async function ler(get, caminho = "") {
  const r = await get(url(caminho));
  assert.equal(r.status, 200);
  return { xCache: r.headers.get("x-cache"), cacheControl: r.headers.get("cache-control"), corpo: await r.json() };
}

beforeEach(() => {
  invalidarCatalogo();
  chamadas.filtros = 0;
  chamadas.produtos = 0;
  chamadas.recomendacoes = [];
  sessaoAtual = null;
  falharEscrita = false;
});

describe("cache no fallback do Next", () => {
  it("a classe do cache é a mesma do Express (cópia idêntica)", () => {
    const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8").replace(/\r\n/g, "\n");
    assert.equal(ler("lib", "servidor", "cacheMemoria.ts"), ler("backend", "src", "utils", "cacheMemoria.ts"));
  });

  for (const [nome, get] of [
    ["/api/filtros", () => filtros.GET()],
    ["/api/produtos", (req) => produtos.GET(req)],
    ["/api/recomendacoes", (req) => recomendacoes.GET(req)],
  ]) {
    it(`GET ${nome}: MISS, depois HIT com o mesmo corpo e Cache-Control private, no-cache`, async () => {
      const primeira = await ler(get);
      const segunda = await ler(get);
      assert.equal(primeira.xCache, "MISS");
      assert.equal(segunda.xCache, "HIT");
      assert.equal(segunda.cacheControl, "private, no-cache");
      assert.deepEqual(segunda.corpo, primeira.corpo);
    });
  }

  it("GET /api/produtos: mesma chave canônica do Express (ordem dos parâmetros não importa)", async () => {
    assert.equal((await ler(produtos.GET, "/produtos?regiao=Caruaru&categoria=Vasos")).xCache, "MISS");
    assert.equal((await ler(produtos.GET, "/produtos?categoria=Vasos&regiao=Caruaru")).xCache, "HIT");
    assert.equal((await ler(produtos.GET, "/produtos?categoria=Tapetes")).xCache, "MISS");
    assert.equal(chamadas.produtos, 2);
  });

  it("GET /api/recomendacoes: separa comprador da sessão, anônimo e limite", async () => {
    await ler(recomendacoes.GET, "/recomendacoes");
    sessaoAtual = COMPRADOR;
    assert.equal((await ler(recomendacoes.GET, "/recomendacoes")).xCache, "MISS");
    sessaoAtual = ARTESAO;
    assert.equal((await ler(recomendacoes.GET, "/recomendacoes")).xCache, "HIT", "outro perfil cai no anonimo");
    assert.equal((await ler(recomendacoes.GET, "/recomendacoes?limite=99")).xCache, "MISS");
    assert.deepEqual(chamadas.recomendacoes, [
      { compradorId: undefined, limite: 4 },
      { compradorId: COMPRADOR.id, limite: 4 },
      { compradorId: undefined, limite: 20 },
    ]);
  });

  const ESCRITAS = [
    ["POST /api/produtos", () => produtos.POST(corpo("POST"))],
    ["PATCH /api/produtos/:id", () => produto.PATCH(corpo("PATCH"), params)],
    ["DELETE /api/produtos/:id", () => produto.DELETE(new NextRequest(url("/produtos/x"), { method: "DELETE" }), params), 204],
    ["POST /api/pedidos", () => pedidos.POST(corpo("POST"))],
    ["PATCH /api/pedidos/:id", () => pedido.PATCH(corpo("PATCH"), params)],
  ];

  for (const [nome, escrever, status] of ESCRITAS) {
    it(`${nome} com sucesso apaga o cache`, async () => {
      await ler(filtros.GET);
      await ler(produtos.GET, "/produtos");
      sessaoAtual = ARTESAO;
      assert.ok((status ? [status] : [200, 201]).includes((await escrever()).status));
      assert.equal((await ler(filtros.GET)).xCache, "MISS");
      assert.equal((await ler(produtos.GET, "/produtos")).xCache, "MISS");
    });

    it(`${nome} que falha não apaga o cache`, async () => {
      await ler(filtros.GET);
      sessaoAtual = ARTESAO;
      falharEscrita = true;
      assert.equal((await escrever()).status, 400);
      assert.equal((await ler(filtros.GET)).xCache, "HIT");
    });
  }
});
