import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// PI4-143 (D4): GET /api/artesaos (só admin) e GET /api/filtros (público) existem no Express e
// também em app/api do Next, para o front não receber 404 quando roda sem API_URL. Este teste
// carrega os route handlers REAIS do Next e os services REAIS do Express com o mesmo dublê de
// banco e confere que os dois lados usam o mesmo SQL e respondem o mesmo formato, as mesmas
// mensagens de erro e os campos do openapi.yaml. Sem banco e sem servidor.

const require = createRequire(import.meta.url);
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.SESSION_SECRET = "segredo-descartavel-de-teste-com-mais-de-32-caracteres";
// Cache desligado: este arquivo troca os dados do dublê entre chamadas da mesma rota
// (o cache em si é testado em tests/cacheNext.test.mjs).
process.env.CACHE_TTL_SEGUNDOS = "0";

require.extensions[".ts"] = function (modulo, arquivo) {
  const { outputText } = ts.transpileModule(fs.readFileSync(arquivo, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  modulo._compile(outputText, arquivo);
};

// "@/x" é o alias do tsconfig do Next; "next/headers" só existe dentro de uma requisição do Next,
// então vira um dublê que lê o cookie da variável cookieAtual.
const NEXT_HEADERS = path.join(raiz, "tests", "duble-next-headers.virtual.js");
const resolverOriginal = Module._resolveFilename;
Module._resolveFilename = function (pedido, pai, ...resto) {
  if (pedido === "next/headers") return NEXT_HEADERS;
  if (pedido.startsWith("@/")) return resolverOriginal.call(this, path.join(raiz, pedido.slice(2)), pai, ...resto);
  return resolverOriginal.call(this, pedido, pai, ...resto);
};

function dublar(arquivo, exportados) {
  const modulo = new Module(arquivo);
  modulo.filename = arquivo;
  modulo.loaded = true;
  modulo.exports = exportados;
  require.cache[arquivo] = modulo;
}

// Usuários da carga db/05 (os mesmos do backend/test/ajudantes.ts).
const USUARIOS = {
  comprador: { id: "10000000-0000-4000-8000-000000000007", nome: "Ana Beatriz", tipo: "comprador" },
  artesao: { id: "10000000-0000-4000-8000-000000000002", nome: "Tacaratu", tipo: "artesao" },
  admin: { id: "10000000-0000-4000-8000-000000000009", nome: "Admin", tipo: "admin" },
};

const consultas = [];
let dados = { artesaos: [], regioes: [], categorias: [] };
let falharBanco = false;
let cookieAtual;

// Um executor por lado, para saber quem mandou cada SQL. Cada lado recebe a própria cópia
// das linhas, para um não enxergar o que o outro alterou.
function executor(lado) {
  return async (sql, valores = []) => {
    consultas.push({ lado, sql });
    if (falharBanco) throw new Error("banco fora do ar (dublê)");
    let rows;
    if (/FROM origem\.usuario WHERE id = \$1/.test(sql)) {
      const u = Object.values(USUARIOS).find((x) => x.id === valores[0]);
      rows = u ? [{ nome: u.nome, tipo: u.tipo }] : [];
    } else if (/GROUP BY a\.id, u\.id/.test(sql)) {
      rows = structuredClone(dados.artesaos);
    } else if (/SELECT DISTINCT a\.regiao_origem AS valor/.test(sql)) {
      rows = dados.regioes.map((valor) => ({ valor }));
    } else if (/SELECT DISTINCT p\.categoria AS valor/.test(sql)) {
      rows = dados.categorias.map((valor) => ({ valor }));
    } else {
      throw new Error(`SQL inesperado no dublê (${lado})`);
    }
    return { rows, rowCount: rows.length };
  };
}

dublar(NEXT_HEADERS, {
  cookies: async () => ({ get: (nome) => (nome === "raizes_sessao" && cookieAtual ? { value: cookieAtual } : undefined) }),
});
dublar(require.resolve(path.join(raiz, "lib", "db.ts")), { pool: { query: executor("next") } });
dublar(require.resolve(path.join(raiz, "backend", "src", "repositories", "transacao.ts")), {
  executorPadrao: () => ({ query: executor("express") }),
});

const back = (arquivo) => require(path.join(raiz, "backend", "src", ...arquivo.split("/")));
const front = (arquivo) => require(path.join(raiz, ...arquivo.split("/")));

const express = {
  artesaoService: back("services/artesaoService.ts"),
  filtroService: back("services/filtroService.ts"),
  artesaoRepository: back("repositories/artesaoRepository.ts"),
  produtoRepository: back("repositories/produtoRepository.ts"),
  ordenacao: back("utils/ordenacao.ts"),
  dominio: back("types/dominio.ts"),
};
const next = {
  rotaArtesaos: front("app/api/artesaos/route.ts"),
  rotaFiltros: front("app/api/filtros/route.ts"),
  artesaos: front("lib/servidor/artesaos.ts"),
  filtros: front("lib/servidor/filtros.ts"),
  ordenacao: front("lib/servidor/ordenacao.ts"),
  tipos: front("lib/tipos.ts"),
  sessao: front("lib/sessao.ts"),
};

// Mensagens que o Express usa, lidas do próprio código, para os dois lados não se separarem.
const codigoSessao = fs.readFileSync(path.join(raiz, "backend", "src", "middlewares", "sessao.ts"), "utf8");
const MSG_401 = /new ErroHttp\(401, "([^"]+)"\)/.exec(codigoSessao)[1];
const MSG_403 = /new ErroHttp\(403, "([^"]+)"\)/.exec(codigoSessao)[1];
const codigoErros = fs.readFileSync(path.join(raiz, "backend", "src", "middlewares", "erros.ts"), "utf8");
const MSG_500 = /status\(500\)\.json\(\{ ok: false, erro: "([^"]+)" \}\)/.exec(codigoErros)[1];

// Campos obrigatórios dos schemas da spec (o yaml é lido como texto: a raiz não tem parser de yaml).
// O checkout no Windows pode trazer CRLF; as quebras são normalizadas antes de procurar.
const spec = fs.readFileSync(path.join(raiz, "backend", "openapi.yaml"), "utf8").replace(/\r\n/g, "\n");
function camposDoSchema(nome) {
  const bloco = new RegExp(`\\n    ${nome}:\\n[\\s\\S]*?required: \\[([^\\]]+)\\]`).exec(spec);
  assert.ok(bloco, `schema ${nome} não encontrado no openapi.yaml`);
  return bloco[1].split(",").map((c) => c.trim()).sort();
}

const semEspacos = (sql) => sql.replace(/\s+/g, " ").trim();

function linhaArtesao(n, nome, extra = {}) {
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

const DADOS = {
  artesaos: [
    linhaArtesao(1, "Zé da Palha", { tecnicas: ["Palha"], totalProdutos: 1, temLogin: true }),
    linhaArtesao(2, "Ângela", { tecnicas: ["Têxtil", "Cerâmica"], totalProdutos: 3 }),
    linhaArtesao(3, "bruno", { regiaoOrigem: "" }),
    linhaArtesao(4, "Álvaro", { email: "nao-pode-sair@exemplo.com", senhaHash: "nao-pode-sair" }),
    linhaArtesao(6, "Maria"),
    linhaArtesao(5, "Maria"),
  ],
  regioes: [" Caruaru ", "caruaru", "", "Tacaratu", "Ávila", "Agreste"],
  categorias: ["Decoração", "decoração ", "Utilidades", "bolsas", "Bolsas", "Árvore", "Ceramica", "Cerâmica"],
};

async function chamar(rota, usuario) {
  cookieAtual = usuario ? await next.sessao.criarToken(usuario) : undefined;
  const resposta = await rota.GET();
  return { status: resposta.status, corpo: await resposta.json() };
}

async function semLogDeErro(fn) {
  const original = console.error;
  console.error = () => undefined;
  try {
    return await fn();
  } finally {
    console.error = original;
  }
}

beforeEach(() => {
  consultas.length = 0;
  falharBanco = false;
  dados = structuredClone(DADOS);
});

describe("Express e Next: mesmas regras", () => {
  it("a lista de técnicas é a mesma, na mesma ordem", () => {
    assert.deepEqual([...next.tipos.TECNICAS], [...express.dominio.TECNICAS]);
  });

  it("o SQL das duas rotas é o mesmo nos dois lados", () => {
    assert.equal(semEspacos(next.artesaos.SQL_ARTESAOS_ADMIN), semEspacos(express.artesaoRepository.SQL_ARTESAOS_ADMIN));
    assert.equal(semEspacos(next.filtros.SQL_REGIOES), semEspacos(express.artesaoRepository.SQL_REGIOES));
    assert.equal(semEspacos(next.filtros.SQL_CATEGORIAS), semEspacos(express.produtoRepository.SQL_CATEGORIAS));
  });

  it("a consulta dos artesãos não lê e-mail nem devolve o hash", () => {
    const sql = next.artesaos.SQL_ARTESAOS_ADMIN;
    assert.doesNotMatch(sql, /email/i);
    assert.equal(sql.match(/senha_hash/g).length, 1);
    assert.match(sql, /\(u\.senha_hash IS NOT NULL\)\s+AS "temLogin"/);
  });

  it("normalizarOpcoes e compararPtBr dão o mesmo resultado", () => {
    const casos = [
      [" Casa ", "casa", "CASA", "", "  ", null, undefined],
      ["Cerâmica", "Ceramica", "cerâmica"],
      ["Zona da Mata", "Águas Belas", "Sertão", "agreste", "Ébano"],
      DADOS.regioes,
      DADOS.categorias,
    ];
    for (const valores of casos) {
      assert.deepEqual(next.ordenacao.normalizarOpcoes(valores), express.ordenacao.normalizarOpcoes(valores));
    }
    const pares = [["Ângela", "Bruno"], ["Maria", "maria"], ["Álvaro", "Alvaro"], ["b", "a"]];
    for (const [a, b] of pares) {
      assert.equal(Math.sign(next.ordenacao.compararPtBr(a, b)), Math.sign(express.ordenacao.compararPtBr(a, b)));
    }
  });
});

describe("GET /api/artesaos no Next (fallback)", () => {
  it("sem sessão responde 401 e, para comprador e artesão, 403, com as mensagens do Express", async () => {
    assert.deepEqual(await chamar(next.rotaArtesaos), { status: 401, corpo: { ok: false, erro: MSG_401 } });
    for (const perfil of ["comprador", "artesao"]) {
      assert.deepEqual(await chamar(next.rotaArtesaos, USUARIOS[perfil]), { status: 403, corpo: { ok: false, erro: MSG_403 } });
    }
    assert.equal(consultas.some((c) => /GROUP BY/.test(c.sql)), false, "consultou os artesãos sem ser admin");
  });

  it("admin recebe exatamente o que o Express devolve, com os campos do schema ArtesaoAdmin", async () => {
    const r = await chamar(next.rotaArtesaos, USUARIOS.admin);
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo, await express.artesaoService.listarParaAdmin());
    assert.deepEqual(
      r.corpo.map((a) => a.nome),
      ["Álvaro", "Ângela", "bruno", "Maria", "Maria", "Zé da Palha"]
    );
    const campos = camposDoSchema("ArtesaoAdmin");
    for (const item of r.corpo) assert.deepEqual(Object.keys(item).sort(), campos);
    assert.equal(JSON.stringify(r.corpo).includes("nao-pode-sair"), false);
    assert.equal(typeof r.corpo[0].temLogin, "boolean");
  });

  it("erro no banco responde 500 no formato do Express", async () => {
    falharBanco = true;
    const r = await semLogDeErro(() => chamar(next.rotaArtesaos, USUARIOS.admin));
    assert.deepEqual(r, { status: 500, corpo: { ok: false, erro: MSG_500 } });
  });
});

describe("GET /api/filtros no Next (fallback)", () => {
  it("é público e responde o mesmo que o Express, com os campos do schema OpcoesFiltros", async () => {
    const esperado = await express.filtroService.obterOpcoes();
    assert.deepEqual(esperado, {
      tecnicas: [...express.dominio.TECNICAS],
      regioes: ["Agreste", "Ávila", "Caruaru", "Tacaratu"],
      categorias: ["Árvore", "Bolsas", "Ceramica", "Cerâmica", "Decoração", "Utilidades"],
    });
    for (const usuario of [undefined, USUARIOS.comprador, USUARIOS.admin]) {
      assert.deepEqual(await chamar(next.rotaFiltros, usuario), { status: 200, corpo: esperado });
    }
    assert.deepEqual(Object.keys(esperado).sort(), camposDoSchema("OpcoesFiltros"));
    assert.equal(consultas.some((c) => c.lado === "next" && /FROM origem\.usuario WHERE id = \$1/.test(c.sql)), false, "filtros não lê sessão");
  });

  it("erro no banco responde 500 no formato do Express", async () => {
    falharBanco = true;
    const r = await semLogDeErro(() => chamar(next.rotaFiltros));
    assert.deepEqual(r, { status: 500, corpo: { ok: false, erro: MSG_500 } });
  });
});
