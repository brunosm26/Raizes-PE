import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { join } from "node:path";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { parse } from "yaml";
import { TTL_MS } from "./cacheLigado";
import { json, subirApi, USUARIOS, type Api } from "./ajudantes";
import { CacheMemoria } from "../src/utils/cacheMemoria";

// Cache em memória (utils/cacheMemoria.ts) e o uso dele nas rotas GET /filtros, /produtos e
// /recomendacoes, SEM banco. Os services de leitura e de escrita viram dublês que contam as
// chamadas: "chegou no service" é o MISS (no app real, a consulta ao PostgreSQL). A prova com
// o banco de verdade fica em cacheCatalogoBanco.test.ts.

const PRODUTO = "30000000-0000-4000-8000-000000000002";
const PEDIDO = "40000000-0000-4000-8000-000000000001";

const chamadas = { filtros: 0, produtos: [] as unknown[], recomendacoes: [] as unknown[] };
let falharEscrita = false;

function dublar(relativo: string, real: object, troca: object): void {
  const caminho = require.resolve(relativo);
  const duble = new Module(caminho);
  duble.filename = caminho;
  duble.loaded = true;
  duble.exports = { ...real, ...troca };
  require.cache[caminho] = duble;
}

// Import dinâmico, como no subirApi: os módulos reais leem o config/env.
async function instalarDubles(): Promise<void> {
  dublar("../src/repositories/usuarioRepository", await import("../src/repositories/usuarioRepository.js"), {
    async buscarNomeETipo(id: string) {
      const u = Object.values(USUARIOS).find((x) => x.id === id);
      return u ? { nome: u.nome, tipo: u.tipo } : null;
    },
  });
  dublar("../src/services/filtroService", await import("../src/services/filtroService.js"), {
    async obterOpcoes() {
      chamadas.filtros++;
      return { tecnicas: [], regioes: ["Caruaru"], categorias: [`leitura-${chamadas.filtros}`] };
    },
  });
  dublar("../src/services/catalogoService", await import("../src/services/catalogoService.js"), {
    async listarProdutos(filtros: unknown) {
      chamadas.produtos.push(filtros);
      return [{ id: PRODUTO, leitura: chamadas.produtos.length }];
    },
  });
  dublar("../src/services/recomendacaoService", await import("../src/services/recomendacaoService.js"), {
    async calcularRecomendacoes(compradorId: string | undefined, limite: number) {
      chamadas.recomendacoes.push({ compradorId, limite });
      return [];
    },
  });
  const escrita = async () => {
    if (falharEscrita) {
      const { ErroHttp } = await import("../src/utils/erroHttp.js");
      throw new ErroHttp(400, "Dados inválidos (dublê).");
    }
    return { id: PRODUTO };
  };
  dublar("../src/services/produtoService", await import("../src/services/produtoService.js"), {
    criarProduto: escrita,
    editarProduto: escrita,
  });
  dublar("../src/services/pedidoService", await import("../src/services/pedidoService.js"), {
    criarPedido: escrita,
    atualizarStatus: escrita,
  });
}

let api: Api;
let invalidarCatalogo: () => void;
before(async () => {
  await instalarDubles();
  api = await subirApi();
  ({ invalidarCatalogo } = await import("../src/services/cacheCatalogo.js"));
});
after(() => api?.fechar()); // com --test-name-pattern o after pode rodar antes do before (ver subirApi)

beforeEach(() => {
  invalidarCatalogo();
  chamadas.filtros = 0;
  chamadas.produtos = [];
  chamadas.recomendacoes = [];
  falharEscrita = false;
});

async function ler(caminho: string, cookie?: string) {
  const r = await fetch(`${api.url}${caminho}`, { headers: cookie ? { cookie } : {} });
  assert.equal(r.status, 200);
  return { xCache: r.headers.get("x-cache"), cacheControl: r.headers.get("cache-control"), corpo: await r.json() };
}

async function escrever(metodo: string, caminho: string, cookie: string, corpo: unknown = {}) {
  const r = await fetch(`${api.url}${caminho}`, { method: metodo, ...json(corpo, cookie) });
  await r.body?.cancel();
  return r.status;
}

describe("CacheMemoria", () => {
  function comRelogio(ttlMs: number, maxEntradas?: number) {
    const relogio = { agora: 1_000 };
    return { relogio, cache: new CacheMemoria<string>({ ttlMs, maxEntradas, agora: () => relogio.agora }) };
  }

  it("1ª leitura é MISS e a 2ª, HIT, sem calcular de novo", async () => {
    const { cache } = comRelogio(TTL_MS);
    let calculos = 0;
    const calcular = async () => `valor-${++calculos}`;

    assert.deepEqual(await cache.lerOuCalcular("k", calcular), { valor: "valor-1", origem: "MISS" });
    assert.deepEqual(await cache.lerOuCalcular("k", calcular), { valor: "valor-1", origem: "HIT" });
    assert.equal(calculos, 1);
  });

  it("expira no TTL: até o último milissegundo é HIT, depois é MISS", async () => {
    const { cache, relogio } = comRelogio(TTL_MS);
    cache.guardar("k", "antigo");

    relogio.agora += TTL_MS - 1;
    assert.equal(cache.obter("k"), "antigo");
    relogio.agora += 1;
    assert.equal(cache.obter("k"), undefined);
    assert.equal(cache.tamanho, 0, "entrada expirada sai da memória");
  });

  it("invalidar apaga uma chave e limpar apaga todas", () => {
    const { cache } = comRelogio(TTL_MS);
    cache.guardar("a", "1");
    cache.guardar("b", "2");
    cache.invalidar("a");
    assert.equal(cache.obter("a"), undefined);
    assert.equal(cache.obter("b"), "2");
    cache.limpar();
    assert.equal(cache.tamanho, 0);
  });

  it("leitura que começou antes da invalidação não volta a gravar dado velho", async () => {
    const { cache } = comRelogio(TTL_MS);
    let liberar!: (v: string) => void;
    const lenta = cache.lerOuCalcular("k", () => new Promise<string>((ok) => (liberar = ok)));

    cache.limpar(); // escrita no meio da consulta
    liberar("de antes da escrita");

    assert.equal((await lenta).origem, "MISS");
    assert.equal(cache.obter("k"), undefined);
  });

  it("erro no cálculo não é guardado", async () => {
    const { cache } = comRelogio(TTL_MS);
    await assert.rejects(cache.lerOuCalcular("k", () => Promise.reject(new Error("banco fora do ar"))));
    assert.equal(cache.tamanho, 0);
  });

  it("TTL 0 desliga: toda leitura é MISS", async () => {
    const { cache } = comRelogio(0);
    assert.equal((await cache.lerOuCalcular("k", async () => "x")).origem, "MISS");
    assert.equal((await cache.lerOuCalcular("k", async () => "x")).origem, "MISS");
  });

  it("passando do teto de entradas, sai a mais antiga", () => {
    const { cache } = comRelogio(TTL_MS, 2);
    cache.guardar("a", "1");
    cache.guardar("b", "2");
    cache.guardar("c", "3");
    assert.equal(cache.obter("a"), undefined);
    assert.equal(cache.obter("b"), "2");
    assert.equal(cache.obter("c"), "3");
  });

  it("recusa configuração inválida", () => {
    assert.throws(() => new CacheMemoria({ ttlMs: -1 }));
    assert.throws(() => new CacheMemoria({ ttlMs: 1000, maxEntradas: 0 }));
  });
});

describe("rotas com cache: X-Cache e Cache-Control", () => {
  for (const caminho of ["/filtros", "/produtos", "/recomendacoes"]) {
    it(`GET ${caminho}: MISS, depois HIT com o mesmo corpo`, async () => {
      const primeira = await ler(caminho);
      const segunda = await ler(caminho);
      assert.equal(primeira.xCache, "MISS");
      assert.equal(segunda.xCache, "HIT");
      assert.equal(primeira.cacheControl, "private, no-cache");
      assert.equal(segunda.cacheControl, "private, no-cache");
      assert.deepEqual(segunda.corpo, primeira.corpo);
    });
  }

  it("GET /filtros: o service só é chamado no MISS", async () => {
    await ler("/filtros");
    await ler("/filtros");
    await ler("/filtros");
    assert.equal(chamadas.filtros, 1);
  });

  it("GET /produtos: a ordem dos parâmetros não muda a chave", async () => {
    assert.equal((await ler("/produtos?tecnica=Cer%C3%A2mica&regiao=Caruaru")).xCache, "MISS");
    assert.equal((await ler("/produtos?regiao=Caruaru&tecnica=Cer%C3%A2mica")).xCache, "HIT");
    assert.equal(chamadas.produtos.length, 1);
  });

  it("GET /produtos: filtros diferentes têm entradas separadas", async () => {
    await ler("/produtos?categoria=Vasos");
    assert.equal((await ler("/produtos?categoria=Tapetes")).xCache, "MISS");
    assert.equal((await ler("/produtos?categoria=Vasos&busca=barro")).xCache, "MISS");
    assert.equal((await ler("/produtos")).xCache, "MISS");
    assert.equal(chamadas.produtos.length, 4);
  });

  it("GET /recomendacoes: separa por comprador da sessão e por limite", async () => {
    const comprador = await api.cookie(USUARIOS.comprador);
    const artesao = await api.cookie(USUARIOS.artesao);

    assert.equal((await ler("/recomendacoes")).xCache, "MISS");
    assert.equal((await ler("/recomendacoes", comprador)).xCache, "MISS", "comprador não usa o cold start");
    assert.equal((await ler("/recomendacoes", comprador)).xCache, "HIT");
    assert.equal((await ler("/recomendacoes", artesao)).xCache, "HIT", "outro perfil cai no anonimo");
    assert.equal((await ler("/recomendacoes?limite=2")).xCache, "MISS");
    assert.deepEqual(chamadas.recomendacoes, [
      { compradorId: undefined, limite: 4 },
      { compradorId: USUARIOS.comprador.id, limite: 4 },
      { compradorId: undefined, limite: 2 },
    ]);
  });

  it("GET /recomendacoes: o compradorId da resposta vem da chamada, não de quem encheu o cache", async () => {
    const comprador = await api.cookie(USUARIOS.comprador);
    assert.equal((await ler("/recomendacoes", comprador)).corpo.compradorId, USUARIOS.comprador.id);
    assert.equal((await ler("/recomendacoes")).corpo.compradorId, null);
  });
});

describe("invalidação nas escritas", () => {
  const MUTACOES = [
    { nome: "POST /produtos", metodo: "POST", caminho: "/produtos", perfil: "artesao" },
    { nome: "PATCH /produtos/:id", metodo: "PATCH", caminho: `/produtos/${PRODUTO}`, perfil: "artesao" },
    { nome: "POST /pedidos", metodo: "POST", caminho: "/pedidos", perfil: "comprador" },
    { nome: "PATCH /pedidos/:id", metodo: "PATCH", caminho: `/pedidos/${PEDIDO}`, perfil: "admin" },
  ] as const;

  async function encherCache(compradorCookie: string) {
    await ler("/filtros");
    await ler("/produtos?categoria=Vasos");
    await ler("/recomendacoes", compradorCookie);
    assert.equal((await ler("/filtros")).xCache, "HIT");
  }

  for (const m of MUTACOES) {
    it(`${m.nome} com sucesso apaga o cache: as três leituras voltam a ser MISS`, async () => {
      const comprador = await api.cookie(USUARIOS.comprador);
      await encherCache(comprador);

      assert.ok([200, 201].includes(await escrever(m.metodo, m.caminho, await api.cookie(USUARIOS[m.perfil]))));

      assert.equal((await ler("/filtros")).xCache, "MISS");
      assert.equal((await ler("/produtos?categoria=Vasos")).xCache, "MISS");
      assert.equal((await ler("/recomendacoes", comprador)).xCache, "MISS");
      assert.equal(chamadas.filtros, 2);
    });

    it(`${m.nome} que falha não apaga o cache`, async () => {
      const comprador = await api.cookie(USUARIOS.comprador);
      await encherCache(comprador);
      falharEscrita = true;

      assert.equal(await escrever(m.metodo, m.caminho, await api.cookie(USUARIOS[m.perfil])), 400);
      assert.equal((await ler("/filtros")).xCache, "HIT");
    });
  }

  it("escrita sem sessão (401) não apaga o cache", async () => {
    await ler("/filtros");
    const r = await fetch(`${api.url}/produtos`, { method: "POST", ...json({}) });
    assert.equal(r.status, 401);
    assert.equal((await ler("/filtros")).xCache, "HIT");
  });
});

describe("expiração pelo TTL nas rotas", () => {
  // Só o Date é falso: o cache lê Date.now(), e o resto (HTTP, timers) segue o relógio real.
  it(`GET /filtros: HIT até ${TTL_MS / 1000}s e MISS depois, consultando de novo`, async () => {
    mock.timers.enable({ apis: ["Date"], now: Date.now() });
    try {
      assert.equal((await ler("/filtros")).xCache, "MISS");
      mock.timers.tick(TTL_MS - 1);
      assert.equal((await ler("/filtros")).xCache, "HIT");
      mock.timers.tick(1);
      const expirado = await ler("/filtros");
      assert.equal(expirado.xCache, "MISS");
      assert.deepEqual(expirado.corpo.categorias, ["leitura-2"]);
    } finally {
      mock.timers.reset();
    }
  });
});

describe("openapi.yaml documenta o cache", () => {
  const spec = parse(readFileSync(join(__dirname, "..", "openapi.yaml"), "utf8")) as {
    paths: Record<string, Record<string, { responses: Record<string, { headers?: Record<string, { $ref?: string }> }> }>>;
    components: { headers: Record<string, { schema: { enum?: string[] } }> };
  };

  it("XCache só aceita HIT e MISS", () => {
    assert.deepEqual(spec.components.headers.XCache?.schema.enum, ["HIT", "MISS"]);
  });

  for (const caminho of ["/filtros", "/produtos", "/recomendacoes"]) {
    it(`GET ${caminho}: 200 declara X-Cache e Cache-Control`, () => {
      const headers = spec.paths[caminho]?.get?.responses["200"]?.headers ?? {};
      assert.equal(headers["X-Cache"]?.$ref, "#/components/headers/XCache");
      assert.equal(headers["Cache-Control"]?.$ref, "#/components/headers/CacheControlCatalogo");
    });
  }
});
