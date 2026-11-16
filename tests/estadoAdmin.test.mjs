import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// PI4-143, PR2 (D2): a aprovação de artesãos e a moderação de produtos do admin ficam no
// localStorage, agora pelo UUID do banco, com as chaves antigas do mock convertidas ou
// descartadas. Também confere a contagem de produtos por categoria de /admin/categorias.
// Sem navegador: o localStorage é um dublê em memória.

const require = createRequire(import.meta.url);
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

require.extensions[".ts"] = function (modulo, arquivo) {
  const { outputText } = ts.transpileModule(fs.readFileSync(arquivo, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  modulo._compile(outputText, arquivo);
};

const estado = require(path.join(raiz, "lib", "estadoAdmin.ts"));
const { contarPorCategoria } = require(path.join(raiz, "lib", "contagemCategorias.ts"));
const { resolverId } = require(path.join(raiz, "lib", "idsLegados.ts"));

class ArmazenamentoFalso {
  constructor(inicial = {}) {
    this.dados = new Map(Object.entries(inicial));
    this.escritas = 0;
  }
  getItem(chave) {
    return this.dados.has(chave) ? this.dados.get(chave) : null;
  }
  setItem(chave, valor) {
    this.escritas += 1;
    this.dados.set(chave, String(valor));
  }
  removeItem(chave) {
    this.dados.delete(chave);
  }
  json(chave) {
    return JSON.parse(this.getItem(chave));
  }
}

// Navegador que bloqueia o localStorage (ex.: cookies de terceiros desligados).
const armazenamentoQueFalha = {
  getItem() {
    throw new Error("bloqueado");
  },
  setItem() {
    throw new Error("bloqueado");
  },
  removeItem() {
    throw new Error("bloqueado");
  },
};

const UUID_A1 = "20000000-0000-4000-8000-000000000001";
const UUID_A3 = "20000000-0000-4000-8000-000000000003";
const UUID_P1 = "30000000-0000-4000-8000-000000000001";
const UUID_P5 = "30000000-0000-4000-8000-000000000005";
const UUID_NOVO = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

describe("aprovação de artesãos (por artesao.id)", () => {
  it("sem nada salvo: ninguém aprovado e nada é gravado", () => {
    const ls = new ArmazenamentoFalso();
    assert.deepEqual(estado.lerAprovacoes(ls), {});
    assert.equal(ls.escritas, 0);
  });

  it("pendente é quem não tem login; quem tem login já aparece aprovado", () => {
    assert.equal(estado.statusArtesao({ id: UUID_A1, temLogin: false }, {}), "pendente");
    assert.equal(estado.statusArtesao({ id: UUID_A1, temLogin: true }, {}), "com-login");
  });

  it("aprovar grava pelo UUID e sobrevive a uma nova leitura", () => {
    const ls = new ArmazenamentoFalso();
    const aprovacoes = estado.aprovarArtesao(estado.lerAprovacoes(ls), UUID_A3);
    estado.salvarAprovacoes(ls, aprovacoes);
    assert.deepEqual(ls.json(estado.CHAVE_APROVACOES), { [UUID_A3]: true });
    const relidas = estado.lerAprovacoes(ls);
    assert.equal(estado.statusArtesao({ id: UUID_A3, temLogin: false }, relidas), "aprovado-navegador");
    assert.equal(estado.statusArtesao({ id: UUID_A1, temLogin: false }, relidas), "pendente");
  });

  it("aprovar um id do mock guarda o UUID; um id que não vira UUID é ignorado", () => {
    assert.deepEqual(estado.aprovarArtesao({}, "a3"), { [UUID_A3]: true });
    assert.deepEqual(estado.aprovarArtesao({}, "qualquer"), {});
  });

  it("ter login vence a aprovação do navegador", () => {
    assert.equal(estado.statusArtesao({ id: UUID_A3, temLogin: true }, { [UUID_A3]: true }), "com-login");
  });

  it('migra a chave antiga "true" para o UUID do primeiro artesão do mock (a1) e a apaga', () => {
    assert.equal(estado.ARTESAO_DA_CHAVE_ANTIGA, UUID_A1);
    const ls = new ArmazenamentoFalso({ [estado.CHAVE_APROVACAO_ANTIGA]: "true" });
    const aprovacoes = estado.lerAprovacoes(ls);
    assert.deepEqual(aprovacoes, { [UUID_A1]: true });
    assert.equal(ls.getItem(estado.CHAVE_APROVACAO_ANTIGA), null);
    assert.deepEqual(ls.json(estado.CHAVE_APROVACOES), { [UUID_A1]: true });
    // Segunda leitura: nada mais a migrar.
    const escritas = ls.escritas;
    assert.deepEqual(estado.lerAprovacoes(ls), { [UUID_A1]: true });
    assert.equal(ls.escritas, escritas);
  });

  it("junta a chave antiga com aprovações novas já salvas", () => {
    const ls = new ArmazenamentoFalso({
      [estado.CHAVE_APROVACAO_ANTIGA]: "true",
      [estado.CHAVE_APROVACOES]: JSON.stringify({ [UUID_A3]: true }),
    });
    assert.deepEqual(estado.lerAprovacoes(ls), { [UUID_A3]: true, [UUID_A1]: true });
  });

  it('a chave antiga "false" (ou lixo) só é apagada', () => {
    for (const valor of ["false", "", "x"]) {
      const ls = new ArmazenamentoFalso({ [estado.CHAVE_APROVACAO_ANTIGA]: valor });
      assert.deepEqual(estado.lerAprovacoes(ls), {});
      assert.equal(ls.getItem(estado.CHAVE_APROVACAO_ANTIGA), null);
    }
  });

  it("descarta entradas inválidas e converte ids do mock na chave nova", () => {
    const ls = new ArmazenamentoFalso({
      [estado.CHAVE_APROVACOES]: JSON.stringify({ a3: true, [UUID_A1]: "sim", lixo: true, [UUID_NOVO]: true }),
    });
    assert.deepEqual(estado.lerAprovacoes(ls), { [UUID_A3]: true, [UUID_NOVO]: true });
    assert.deepEqual(ls.json(estado.CHAVE_APROVACOES), { [UUID_A3]: true, [UUID_NOVO]: true });
  });

  it("JSON quebrado ou que não é objeto vira lista vazia", () => {
    for (const valor of ["{", "[1,2]", "null", "42"]) {
      const ls = new ArmazenamentoFalso({ [estado.CHAVE_APROVACOES]: valor });
      assert.deepEqual(estado.lerAprovacoes(ls), {});
    }
  });

  it("localStorage bloqueado não quebra a tela", () => {
    assert.deepEqual(estado.lerAprovacoes(armazenamentoQueFalha), {});
    assert.doesNotThrow(() => estado.salvarAprovacoes(armazenamentoQueFalha, { [UUID_A1]: true }));
  });
});

describe("moderação de produtos (por produto.id)", () => {
  const hoje = new Date(2026, 10, 15, 21, 30); // 15/11/2026, hora local
  const comFoto = (dataCadastro, extra = {}) => ({ id: UUID_P1, imagemUrl: "/produtos/p1.svg", dataCadastro, ...extra });

  it('converte as entradas antigas (p1, "removido") e descarta o que não vira UUID', () => {
    const ls = new ArmazenamentoFalso({
      [estado.CHAVE_MODERACAO]: JSON.stringify({
        p1: "aprovado",
        p5: "removido",
        lixo: "aprovado",
        p2: "outra-coisa",
        [UUID_NOVO]: "oculto",
      }),
    });
    const moderacao = estado.lerModeracao(ls);
    assert.deepEqual(moderacao, { [UUID_P1]: "aprovado", [UUID_P5]: "oculto", [UUID_NOVO]: "oculto" });
    assert.deepEqual(ls.json(estado.CHAVE_MODERACAO), moderacao);
    assert.equal(resolverId("p5"), UUID_P5);
  });

  it("mapa já em UUID não é regravado", () => {
    const ls = new ArmazenamentoFalso({ [estado.CHAVE_MODERACAO]: JSON.stringify({ [UUID_P1]: "aprovado" }) });
    assert.deepEqual(estado.lerModeracao(ls), { [UUID_P1]: "aprovado" });
    assert.equal(ls.escritas, 0);
  });

  it("em revisão não é mais fixo em p1/p5: produto da carga com foto e data antiga está aprovado", () => {
    assert.equal(estado.motivoRevisao(comFoto("2025-06-01"), hoje), null);
    assert.equal(estado.estaEmRevisao(comFoto("2025-06-01"), {}, hoje), false);
  });

  it("produto sem foto fica em revisão, seja qual for a data", () => {
    for (const imagemUrl of [undefined, null, "", "   "]) {
      assert.equal(estado.motivoRevisao({ imagemUrl, dataCadastro: "2025-01-01" }, hoje), "sem-foto");
    }
  });

  it("cadastro nos últimos 7 dias, contando hoje, fica em revisão", () => {
    assert.equal(estado.DIAS_EM_REVISAO, 7);
    assert.equal(estado.motivoRevisao(comFoto("2026-11-15"), hoje), "recente");
    assert.equal(estado.motivoRevisao(comFoto("2026-11-09"), hoje), "recente");
    assert.equal(estado.motivoRevisao(comFoto("2026-11-08"), hoje), null);
    // O servidor (UTC) pode já estar no dia seguinte ao do navegador.
    assert.equal(estado.motivoRevisao(comFoto("2026-11-16"), hoje), "recente");
    // Data que não dá para ler: decide só pela foto.
    assert.equal(estado.motivoRevisao(comFoto("ontem"), hoje), null);
  });

  it("aprovar tira da revisão; ocultar tira da lista do admin; reexibir devolve", () => {
    const produto = { id: UUID_NOVO, dataCadastro: "2026-11-15" };
    let moderacao = {};
    assert.equal(estado.estaEmRevisao(produto, moderacao, hoje), true);

    moderacao = estado.moderarProduto(moderacao, produto.id, "aprovado");
    assert.equal(estado.estaEmRevisao(produto, moderacao, hoje), false);
    assert.equal(estado.estaOculto(produto, moderacao), false);

    moderacao = estado.moderarProduto(moderacao, produto.id, "oculto");
    assert.equal(estado.estaOculto(produto, moderacao), true);
    // Ocultar não é aprovar: se voltar a aparecer, volta em revisão.
    moderacao = estado.reexibirOcultos(moderacao);
    assert.deepEqual(moderacao, {});
    assert.equal(estado.estaEmRevisao(produto, moderacao, hoje), true);
  });

  it("reexibir só os produtos informados mantém os outros ocultos e as aprovações", () => {
    const moderacao = { [UUID_P1]: "oculto", [UUID_P5]: "oculto", [UUID_NOVO]: "aprovado" };
    assert.deepEqual(estado.reexibirOcultos(moderacao, [UUID_P1]), { [UUID_P5]: "oculto", [UUID_NOVO]: "aprovado" });
    assert.deepEqual(estado.reexibirOcultos(moderacao, ["p5"]), { [UUID_P1]: "oculto", [UUID_NOVO]: "aprovado" });
  });

  it("moderar um id do mock guarda o UUID; um id inválido não muda nada", () => {
    assert.deepEqual(estado.moderarProduto({}, "p1", "aprovado"), { [UUID_P1]: "aprovado" });
    assert.deepEqual(estado.moderarProduto({}, "???", "oculto"), {});
  });

  it("localStorage bloqueado não quebra a tela", () => {
    assert.deepEqual(estado.lerModeracao(armazenamentoQueFalha), {});
    assert.doesNotThrow(() => estado.salvarModeracao(armazenamentoQueFalha, { [UUID_P1]: "oculto" }));
  });
});

describe("categorias do admin", () => {
  it("conta os produtos por categoria, na ordem da lista e com zero para a que não tem produto", () => {
    const categorias = ["Casa", "Decoração", "Vestuário"];
    const produtos = [
      { categoria: "Casa" },
      { categoria: "Decoração" },
      { categoria: "Casa" },
      { categoria: "Decoração" },
      { categoria: "Decoração" },
    ];
    assert.deepEqual(contarPorCategoria(categorias, produtos), [
      { categoria: "Casa", totalProdutos: 2 },
      { categoria: "Decoração", totalProdutos: 3 },
      { categoria: "Vestuário", totalProdutos: 0 },
    ]);
  });

  it("compara como o GET /api/filtros junta: sem espaços nas pontas e sem diferença de maiúsculas", () => {
    const produtos = [{ categoria: " casa" }, { categoria: "CASA " }, { categoria: "Casa" }, { categoria: "" }, { categoria: null }];
    assert.deepEqual(contarPorCategoria(["Casa"], produtos), [{ categoria: "Casa", totalProdutos: 3 }]);
  });

  it("produto de categoria fora da lista não entra; lista vazia dá contagem vazia", () => {
    assert.deepEqual(contarPorCategoria(["Casa"], [{ categoria: "Brinquedos" }]), [{ categoria: "Casa", totalProdutos: 0 }]);
    assert.deepEqual(contarPorCategoria([], [{ categoria: "Casa" }]), []);
  });

  it("apaga a lista editável antiga do localStorage e não mexe nas outras chaves", () => {
    const ls = new ArmazenamentoFalso({
      [estado.CHAVE_CATEGORIAS_ANTIGA]: JSON.stringify(["Casa", "Inventada"]),
      [estado.CHAVE_MODERACAO]: "{}",
    });
    estado.apagarCategoriasAntigas(ls);
    assert.equal(ls.getItem(estado.CHAVE_CATEGORIAS_ANTIGA), null);
    assert.equal(ls.getItem(estado.CHAVE_MODERACAO), "{}");
    assert.doesNotThrow(() => estado.apagarCategoriasAntigas(armazenamentoQueFalha));
  });
});
