import assert from "node:assert/strict";
import Module from "node:module";
import { after, before, beforeEach, describe, it } from "node:test";
import { TECNICAS } from "../src/types/dominio";
import { compararPtBr, normalizarOpcoes } from "../src/utils/ordenacao";
import { subirApi, USUARIOS, type Api } from "./ajudantes";

// GET /api/artesaos (só admin) e GET /api/filtros (público) da PI4-143, SEM banco. O módulo
// repositories/transacao é trocado por um dublê cujo executor responde ao SQL de cada
// repository; o resto (rota, middleware, controller, service e repository) é o código real.
// O conteúdo com banco de verdade fica em artesaosFiltros.test.ts.

interface Consulta {
  sql: string;
}
type Linhas = Record<string, unknown>[];

const consultas: Consulta[] = [];
let linhasArtesaos: Linhas = [];
let regioes: (string | null)[] = [];
let categorias: (string | null)[] = [];
let falharBanco = false;
let sql: { artesaos: string; regioes: string; categorias: string };

async function executar(texto: string, valores: unknown[] = []): Promise<{ rows: Linhas; rowCount: number }> {
  consultas.push({ sql: texto });
  if (falharBanco) throw new Error("banco fora do ar (dublê)");
  let rows: Linhas;
  if (/FROM origem\.usuario WHERE id = \$1/.test(texto)) {
    const u = Object.values(USUARIOS).find((x) => x.id === valores[0]);
    rows = u ? [{ nome: u.nome, tipo: u.tipo }] : [];
  } else if (texto === sql.artesaos) {
    rows = linhasArtesaos;
  } else if (texto === sql.regioes) {
    rows = regioes.map((valor) => ({ valor }));
  } else if (texto === sql.categorias) {
    rows = categorias.map((valor) => ({ valor }));
  } else {
    throw new Error(`SQL inesperado no dublê: ${texto.slice(0, 60)}`);
  }
  return { rows, rowCount: rows.length };
}

// Import dinâmico, como no subirApi: os repositories carregam o config/env, que só pode ser
// lido depois de o ajudantes preparar o ambiente de teste.
async function instalarDubleDoBanco(): Promise<void> {
  const caminho = require.resolve("../src/repositories/transacao");
  const duble = new Module(caminho);
  duble.filename = caminho;
  duble.loaded = true;
  duble.exports = {
    executorPadrao: () => ({ query: executar }),
    emTransacao: async (fn: (tx: unknown) => Promise<unknown>) => fn({ query: executar }),
  };
  require.cache[caminho] = duble;
  const artesaoRepository = await import("../src/repositories/artesaoRepository.js");
  const produtoRepository = await import("../src/repositories/produtoRepository.js");
  sql = {
    artesaos: artesaoRepository.SQL_ARTESAOS_ADMIN,
    regioes: artesaoRepository.SQL_REGIOES,
    categorias: produtoRepository.SQL_CATEGORIAS,
  };
}

const CAMPOS_ARTESAO = ["id", "usuarioId", "nome", "regiaoOrigem", "tecnicas", "totalProdutos", "temLogin", "ativo", "dataCadastro"];

function linhaArtesao(n: number, nome: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const hex = n.toString(16).padStart(2, "0");
  return {
    id: `20000000-0000-4000-8000-0000000000${hex}`,
    usuarioId: `10000000-0000-4000-8000-0000000000${hex}`,
    nome,
    regiaoOrigem: "Caruaru",
    tecnicas: [],
    totalProdutos: 0,
    temLogin: false,
    ativo: true,
    dataCadastro: "2025-05-10",
    ...extra,
  };
}

let api: Api;
before(async () => {
  await instalarDubleDoBanco();
  api = await subirApi();
});
after(() => api?.fechar()); // com --test-name-pattern o after pode rodar antes do before (ver subirApi)
beforeEach(() => {
  consultas.length = 0;
  falharBanco = false;
});

async function pedir(caminho: string, cookie?: string) {
  const r = await fetch(`${api.url}${caminho}`, { headers: cookie ? { cookie } : {} });
  return { status: r.status, corpo: (await r.json()) as unknown };
}

const consultouArtesaos = () => consultas.some((c) => c.sql === sql.artesaos);

describe("GET /artesaos: só admin", () => {
  it("sem cookie responde 401, sem consultar os artesãos", async () => {
    const r = await pedir("/artesaos");
    assert.equal(r.status, 401);
    assert.deepEqual(r.corpo, { ok: false, erro: "Faça login para continuar." });
    assert.equal(consultouArtesaos(), false);
  });

  for (const perfil of ["comprador", "artesao"] as const) {
    it(`com ${perfil} responde 403, sem consultar os artesãos`, async () => {
      const r = await pedir("/artesaos", await api.cookie(USUARIOS[perfil]));
      assert.equal(r.status, 403);
      assert.deepEqual(r.corpo, { ok: false, erro: "Seu perfil não tem permissão para esta ação." });
      assert.equal(consultouArtesaos(), false);
    });
  }

  it("o perfil público GET /artesaos/:id continua sem exigir sessão", async () => {
    const r = await pedir("/artesaos/nao-e-uuid");
    assert.equal(r.status, 404);
    assert.deepEqual(r.corpo, { ok: false, erro: "Artesão não encontrado" });
  });
});

describe("GET /artesaos: formato e ordem", () => {
  it("admin recebe só os 8 campos, em ordem de nome pt-BR, com técnicas ordenadas", async () => {
    linhasArtesaos = [
      linhaArtesao(1, "Zé da Palha", { tecnicas: ["Palha"], totalProdutos: 1, temLogin: true }),
      linhaArtesao(2, "Ângela", { tecnicas: ["Têxtil", "Cerâmica", "Madeira"], totalProdutos: 4 }),
      linhaArtesao(3, "bruno"),
      // Campos que não fazem parte do contrato nunca saem, mesmo que o SQL mudasse e os trouxesse.
      linhaArtesao(4, "Álvaro", { email: "nao-pode-sair@exemplo.com", senhaHash: "nao-pode-sair" }),
      linhaArtesao(5, "Carla"),
    ];
    const r = await pedir("/artesaos", await api.cookie(USUARIOS.admin));
    assert.equal(r.status, 200);
    const lista = r.corpo as Record<string, unknown>[];
    assert.deepEqual(
      lista.map((a) => a.nome),
      ["Álvaro", "Ângela", "bruno", "Carla", "Zé da Palha"]
    );
    for (const a of lista) assert.deepEqual(Object.keys(a).sort(), [...CAMPOS_ARTESAO].sort());
    assert.deepEqual(lista[1]!.tecnicas, ["Cerâmica", "Madeira", "Têxtil"]);
    assert.equal(JSON.stringify(lista).includes("nao-pode-sair"), false);
  });

  it("temLogin é sempre booleano e totalProdutos, inteiro", async () => {
    linhasArtesaos = [
      linhaArtesao(1, "Com login", { temLogin: true, totalProdutos: 2 }),
      linhaArtesao(2, "Sem login", { temLogin: false }),
    ];
    const r = await pedir("/artesaos", await api.cookie(USUARIOS.admin));
    const lista = r.corpo as { nome: string; temLogin: unknown; totalProdutos: unknown }[];
    assert.deepEqual(
      lista.map((a) => [a.nome, a.temLogin, a.totalProdutos]),
      [
        ["Com login", true, 2],
        ["Sem login", false, 0],
      ]
    );
  });

  it("a consulta não seleciona e-mail nem o hash: senha_hash só aparece no IS NOT NULL", () => {
    assert.doesNotMatch(sql.artesaos, /email/i);
    assert.equal(sql.artesaos.match(/senha_hash/g)?.length, 1);
    assert.match(sql.artesaos, /\(u\.senha_hash IS NOT NULL\)\s+AS "temLogin"/);
  });

  it("nomes iguais desempatam pelo id", async () => {
    linhasArtesaos = [linhaArtesao(9, "Maria"), linhaArtesao(3, "Maria"), linhaArtesao(5, "maria")];
    const r = await pedir("/artesaos", await api.cookie(USUARIOS.admin));
    const lista = r.corpo as { id: string; nome: string }[];
    const esperado = [...lista].sort((x, y) => compararPtBr(x.nome, y.nome) || (x.id < y.id ? -1 : 1));
    assert.deepEqual(lista, esperado);
    assert.deepEqual(
      lista.filter((a) => a.nome === "Maria").map((a) => a.id.slice(-2)),
      ["03", "09"]
    );
  });
});

describe("GET /filtros: público", () => {
  it("responde sem cookie e com qualquer perfil, com regiões e categorias normalizadas", async () => {
    regioes = [" Caruaru ", "caruaru", "", "   ", "Tacaratu", "Ávila", "Agreste", null];
    categorias = ["Decoração", "decoração ", "Utilidades", "bolsas", "Bolsas", "Árvore", "Ceramica", "Cerâmica"];
    const esperado = {
      tecnicas: [...TECNICAS],
      regioes: ["Agreste", "Ávila", "Caruaru", "Tacaratu"],
      categorias: ["Árvore", "Bolsas", "Ceramica", "Cerâmica", "Decoração", "Utilidades"],
    };
    for (const cookie of [undefined, await api.cookie(USUARIOS.comprador), await api.cookie(USUARIOS.admin)]) {
      const r = await pedir("/filtros", cookie);
      assert.equal(r.status, 200);
      assert.deepEqual(r.corpo, esperado);
    }
  });

  it("sem regiões nem categorias cadastradas devolve listas vazias", async () => {
    regioes = [];
    categorias = [null, " "];
    const r = await pedir("/filtros");
    assert.deepEqual(r.corpo, { tecnicas: [...TECNICAS], regioes: [], categorias: [] });
  });

  it("com o banco fora do ar responde 500 no formato de erro comum", async () => {
    falharBanco = true;
    const erroOriginal = console.error;
    console.error = () => undefined; // o tratador de erros registra o erro inesperado
    try {
      const r = await pedir("/filtros");
      assert.equal(r.status, 500);
      assert.deepEqual(r.corpo, { ok: false, erro: "Erro interno do servidor" });
    } finally {
      console.error = erroOriginal;
    }
  });
});

describe("normalizarOpcoes e compararPtBr", () => {
  it("tira espaços, descarta vazias e nulas e junta maiúsculas/minúsculas", () => {
    assert.deepEqual(normalizarOpcoes([" Casa ", "casa", "CASA", "", "  ", null, undefined]), ["CASA"]);
    assert.deepEqual(normalizarOpcoes(["casa", "Casa"]), ["Casa"]);
  });

  it("acentos continuam diferenciando (só maiúsculas/minúsculas são juntadas)", () => {
    assert.deepEqual(normalizarOpcoes(["Cerâmica", "Ceramica", "cerâmica"]), ["Ceramica", "Cerâmica"]);
  });

  it("ordena em pt-BR: letra acentuada junto da sem acento, não depois do z", () => {
    assert.deepEqual(normalizarOpcoes(["Zona da Mata", "Águas Belas", "Sertão", "agreste", "Ébano"]), [
      "agreste",
      "Águas Belas",
      "Ébano",
      "Sertão",
      "Zona da Mata",
    ]);
    assert.ok(compararPtBr("Ângela", "Bruno") < 0);
    assert.ok(compararPtBr("Álvaro", "Ângela") < 0);
  });

  it("não altera a lista recebida", () => {
    const original = ["b", "a"];
    normalizarOpcoes(original);
    assert.deepEqual(original, ["b", "a"]);
  });
});
