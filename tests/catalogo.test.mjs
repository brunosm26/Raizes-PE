import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { PRODUTO, PRODUTOS } from "./fixtures/cargaDemo.mjs";

const require = createRequire(import.meta.url);
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

require.extensions[".ts"] = function (module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(transpiled, filename);
};

// lib/apiCatalogo.ts é o que a vitrine, a página do produto e o perfil do artesão chamam.
// Aqui o fetch é um dublê que registra cada chamada e devolve a resposta escolhida pelo teste:
// confere a URL montada, as opções do fetch e o tratamento de 404 e de erro. Os filtros, a busca
// sem acento, os relacionados e as avaliações em si são das rotas, testadas no backend
// (backend/test/catalogoAuthPainel.test.ts, com banco).

const chamadas = [];
let proximaResposta;

function responder(status, corpo) {
  proximaResposta = { ok: status >= 200 && status < 300, status, json: async () => structuredClone(corpo) };
}

globalThis.fetch = async (url, init) => {
  chamadas.push({ url: String(url), init });
  return proximaResposta;
};

const API_CATALOGO = path.join(rootDir, "lib", "apiCatalogo.ts");
const API_URL = path.join(rootDir, "lib", "apiUrl.ts");

// apiUrl.ts lê NEXT_PUBLIC_API_URL ao ser carregado: cada valor exige uma cópia nova do módulo.
function carregarCatalogo(baseApi) {
  if (baseApi === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = baseApi;
  delete require.cache[API_CATALOGO];
  delete require.cache[API_URL];
  return require(API_CATALOGO);
}

const catalogo = carregarCatalogo(undefined);
const { ARTE_POR_TECNICA, PADRAO_RENDA, estiloFundoProduto } = require(path.join(rootDir, "lib", "arteProduto.ts"));
const { TECNICAS } = require(path.join(rootDir, "lib", "tipos.ts"));

const VASO = PRODUTOS.find((p) => p.id === PRODUTO.vasoMaragogi);
const JARRO = PRODUTOS.find((p) => p.id === PRODUTO.jarroFosco);

beforeEach(() => {
  chamadas.length = 0;
  responder(200, []);
});

describe("getProdutos (vitrine)", () => {
  it("sem filtro chama GET /api/produtos sem cache, com o cookie, e devolve a lista da rota", async () => {
    responder(200, PRODUTOS);
    const lista = await catalogo.getProdutos();
    assert.deepEqual(lista, PRODUTOS);
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].url, "/api/produtos");
    assert.deepEqual(chamadas[0].init, { credentials: "include", cache: "no-store" });
  });

  it("monta a query na ordem técnica, busca, região e categoria, com os valores codificados", async () => {
    await catalogo.getProdutos("Renda e Bordado", "  bilro  ", "Alto do Moura, Caruaru", "Decoração");
    const url = new URL(chamadas[0].url, "http://teste.local");
    assert.equal(url.pathname, "/api/produtos");
    assert.deepEqual([...url.searchParams], [
      ["tecnica", "Renda e Bordado"],
      ["busca", "bilro"],
      ["regiao", "Alto do Moura, Caruaru"],
      ["categoria", "Decoração"],
    ]);
    assert.ok(!chamadas[0].url.includes(" "), "a URL vai codificada");
  });

  it("omite os filtros vazios e a busca só com espaços", async () => {
    await catalogo.getProdutos(undefined, "   ", undefined, "Casa");
    assert.equal(chamadas[0].url, "/api/produtos?categoria=Casa");
    await catalogo.getProdutos("Cerâmica", "", "", undefined);
    assert.equal(new URL(chamadas[1].url, "http://teste.local").search, `?tecnica=${encodeURIComponent("Cerâmica")}`);
  });

  it("404 vira lista vazia; outro erro é lançado para a tela mostrar 'tentar de novo'", async () => {
    responder(404, { erro: "não encontrado" });
    assert.deepEqual(await catalogo.getProdutos(), []);
    responder(500, { erro: "falhou" });
    await assert.rejects(catalogo.getProdutos("Palha"), /Falha ao consultar \/api\/produtos\?tecnica=Palha \(500\)/);
  });

  it("com NEXT_PUBLIC_API_URL, chama a API em outra origem (sem barra dupla)", async () => {
    try {
      const outraOrigem = carregarCatalogo("http://localhost:4000/ ");
      await outraOrigem.getProdutos("Têxtil");
      assert.equal(chamadas[0].url, `http://localhost:4000/api/produtos?tecnica=${encodeURIComponent("Têxtil")}`);
    } finally {
      carregarCatalogo(undefined);
    }
  });
});

describe("página do produto", () => {
  it("getProdutoPorId codifica o id e devolve o produto da rota", async () => {
    responder(200, VASO);
    assert.deepEqual(await catalogo.getProdutoPorId(PRODUTO.vasoMaragogi), VASO);
    assert.equal(chamadas[0].url, `/api/produtos/${PRODUTO.vasoMaragogi}`);
    await catalogo.getProdutoPorId("p1/../x y");
    assert.equal(chamadas[1].url, "/api/produtos/p1%2F..%2Fx%20y");
  });

  it("getProdutoPorId: 404 vira undefined ('produto não encontrado'); 500 é lançado", async () => {
    responder(404, { erro: "Produto não encontrado." });
    assert.equal(await catalogo.getProdutoPorId("p999"), undefined);
    responder(500, { erro: "falhou" });
    await assert.rejects(catalogo.getProdutoPorId("p1"), /\(500\)/);
  });

  it("getProdutosRelacionados usa limite 3 por padrão e devolve [] no 404", async () => {
    responder(200, [JARRO]);
    assert.deepEqual(await catalogo.getProdutosRelacionados(PRODUTO.vasoMaragogi), [JARRO]);
    assert.equal(chamadas[0].url, `/api/produtos/${PRODUTO.vasoMaragogi}/relacionados?limite=3`);
    await catalogo.getProdutosRelacionados("p1", 6);
    assert.equal(chamadas[1].url, "/api/produtos/p1/relacionados?limite=6");
    responder(404, {});
    assert.deepEqual(await catalogo.getProdutosRelacionados("p999"), []);
  });

  it("getResumoAvaliacoes devolve média e quantidade da rota e zero no 404", async () => {
    responder(200, { media: 4.5, quantidade: 2 });
    assert.deepEqual(await catalogo.getResumoAvaliacoes(PRODUTO.vasoMaragogi), { media: 4.5, quantidade: 2 });
    assert.equal(chamadas[0].url, `/api/produtos/${PRODUTO.vasoMaragogi}/avaliacoes`);
    responder(404, {});
    assert.deepEqual(await catalogo.getResumoAvaliacoes("p999"), { media: 0, quantidade: 0 });
    responder(503, {});
    await assert.rejects(catalogo.getResumoAvaliacoes("p1"), /\(503\)/);
  });
});

describe("perfil do artesão", () => {
  it("getPerfilArtesao chama /api/artesaos/:id e devolve undefined no 404", async () => {
    const perfil = {
      id: "20000000-0000-4000-8000-000000000002",
      nome: "Cooperativa de Tacaratu",
      regiaoOrigem: "Tacaratu",
      biografia: "",
      produtos: PRODUTOS.filter((p) => p.artesaoId === "20000000-0000-4000-8000-000000000002"),
    };
    responder(200, perfil);
    assert.deepEqual(await catalogo.getPerfilArtesao("a2"), perfil);
    assert.equal(chamadas[0].url, "/api/artesaos/a2");
    responder(404, { erro: "Artesão não encontrado." });
    assert.equal(await catalogo.getPerfilArtesao("a999"), undefined);
  });
});

describe("domínio das técnicas e arte padrão", () => {
  it("TECNICAS tem as 5 técnicas, na ordem do CHECK do banco", () => {
    assert.deepEqual([...TECNICAS], ["Cerâmica", "Têxtil", "Madeira", "Renda e Bordado", "Palha"]);
  });

  it("usa a foto quando existe e a arte da técnica quando não existe", () => {
    const comFoto = estiloFundoProduto({ tecnica: "Cerâmica", imagemUrl: "/produtos/p1.svg" });
    assert.equal(comFoto.backgroundImage, "url(/produtos/p1.svg)");
    assert.equal(comFoto.backgroundPosition, "center");

    const semFotoCeramica = estiloFundoProduto({ tecnica: "Cerâmica" });
    assert.equal(semFotoCeramica.backgroundImage, ARTE_POR_TECNICA["Cerâmica"]);

    const semFotoRenda = estiloFundoProduto({ tecnica: "Renda e Bordado" });
    assert.equal(semFotoRenda.bg, "secondary");
    assert.equal(semFotoRenda.backgroundImage, PADRAO_RENDA);
    assert.equal(semFotoRenda.backgroundSize, "14px 14px");
  });
});
