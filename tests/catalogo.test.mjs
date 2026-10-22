import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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

const {
  categorias,
  getEstatisticasPainel,
  getPerfilArtesao,
  getProdutoPorId,
  getProdutos,
  getProdutosDoArtesao,
  getProdutosRelacionados,
  getResumoAvaliacoes,
  regioes,
  tecnicas,
} = require(path.join(rootDir, "lib", "apiFalsa.ts"));

const {
  ARTE_POR_TECNICA,
  PADRAO_RENDA,
  estiloFundoProduto,
} = require(path.join(rootDir, "lib", "arteProduto.ts"));

test("Lista todos os produtos da vitrine enriquecidos com nome e região do artesão", async () => {
  const lista = await getProdutos();
  assert.equal(lista.length, 7, "Catálogo base deve conter 7 produtos");
  for (const item of lista) {
    assert.ok(item.id, "Produto deve possuir id");
    assert.ok(item.artesaoNome && item.artesaoNome !== "Artesão desconhecido", "Deve resolver nome do artesão");
    assert.ok(item.artesaoRegiao && item.artesaoRegiao.length > 0, "Deve resolver região do artesão");
  }
});

test("Filtra produtos corretamente por técnica artesanal, região e categoria", async () => {
  const ceramicas = await getProdutos("Cerâmica");
  assert.equal(ceramicas.length, 2);
  assert.ok(ceramicas.every((p) => p.tecnica === "Cerâmica"));

  const caruaruDecoracao = await getProdutos(undefined, undefined, "Alto do Moura, Caruaru", "Decoração");
  assert.equal(caruaruDecoracao.length, 2);
  assert.ok(caruaruDecoracao.every((p) => p.artesaoRegiao === "Alto do Moura, Caruaru" && p.categoria === "Decoração"));
});

test("Realiza busca textual insensível a acentos e maiúsculas/minúsculas", async () => {
  const buscaSemAcento = await getProdutos(undefined, "ceramica");
  assert.equal(buscaSemAcento.length, 2, "Busca por 'ceramica' sem acento deve retornar os 2 produtos de Cerâmica");

  const buscaPorArtesao = await getProdutos(undefined, "VITALINO");
  assert.equal(buscaPorArtesao.length, 1);
  assert.equal(buscaPorArtesao[0].id, "p1");

  const buscaPorRegiao = await getProdutos(undefined, "tracunhaem");
  assert.equal(buscaPorRegiao.length, 1);
  assert.equal(buscaPorRegiao[0].id, "p4");
});

test("Consulta produto por ID existente e retorna undefined para ID inexistente", async () => {
  const vaso = await getProdutoPorId("p1");
  assert.ok(vaso);
  assert.equal(vaso.nome, "Vaso de Cerâmica Maragogi");
  assert.equal(vaso.artesaoNome, "Vitalino Neto");

  const inexistente = await getProdutoPorId("p999");
  assert.equal(inexistente, undefined);
});

test("Retorna produtos relacionados da mesma técnica excluindo o próprio produto", async () => {
  const relacionados = await getProdutosRelacionados("p1", 3);
  assert.equal(relacionados.length, 1);
  assert.equal(relacionados[0].id, "p6");
  assert.equal(relacionados[0].tecnica, "Cerâmica");

  const relInexistente = await getProdutosRelacionados("p999");
  assert.deepEqual(relInexistente, []);
});

test("Calcula média e quantidade de avaliações por produto com exatidão", async () => {
  const resumoP1 = await getResumoAvaliacoes("p1");
  assert.equal(resumoP1.quantidade, 2);
  assert.equal(resumoP1.media, 4.5);

  const resumoP4 = await getResumoAvaliacoes("p4");
  assert.equal(resumoP4.quantidade, 2);
  assert.equal(resumoP4.media, 5.0);

  const semAvaliacao = await getResumoAvaliacoes("p3");
  assert.deepEqual(semAvaliacao, { media: 0, quantidade: 0 });
});

test("Recupera perfil público do artesão com seus produtos vinculados", async () => {
  const perfil = await getPerfilArtesao("a2");
  assert.ok(perfil);
  assert.equal(perfil.nome, "Cooperativa de Tacaratu");
  assert.equal(perfil.regiaoOrigem, "Tacaratu");
  assert.equal(perfil.produtos.length, 2);

  const perfilInexistente = await getPerfilArtesao("a999");
  assert.equal(perfilInexistente, undefined);
});

test("Calcula produtos e estatísticas financeiras do painel do artesão", async () => {
  const produtosArtesao = await getProdutosDoArtesao("u2");
  assert.equal(produtosArtesao.length, 2);

  const estatisticas = await getEstatisticasPainel("u2");
  assert.equal(estatisticas.vendasDoMes, 320.0);
  assert.equal(estatisticas.pedidosPendentes, 1);
  assert.equal(estatisticas.historicoMensal.length, 6);
  assert.equal(estatisticas.vendasPorTecnica.length, 3);
});

test("Expõe domínios válidos de filtros e aplica fallback visual por técnica", () => {
  assert.deepEqual(tecnicas, ["Cerâmica", "Têxtil", "Madeira", "Renda e Bordado", "Palha"]);
  assert.ok(regioes.includes("Alto do Moura, Caruaru"));
  assert.ok(categorias.includes("Decoração"));

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
