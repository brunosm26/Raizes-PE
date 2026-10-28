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

// Desde o PR #23 as funções de lib/apiFalsa.ts chamam as rotas /api (PostgreSQL) via fetch.
// Nestes testes unitários não há servidor nem banco, então o fetch é trocado por um
// simulador em memória que responde como as rotas, usando os dados de lib/dadosFalsos.ts.
// As rotas em si são cobertas pelos testes de integração com banco real.
const dados = require(path.join(rootDir, "lib", "dadosFalsos.ts"));

function normalizar(texto) {
  return String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function comArtesao(p) {
  const artesao = dados.artesaos.find((a) => a.id === p.artesaoId);
  const usuario = dados.usuarios.find((u) => u.id === artesao?.usuarioId);
  return { ...p, artesaoNome: usuario?.nome ?? "Artesão desconhecido", artesaoRegiao: artesao?.regiaoOrigem ?? "" };
}

function json(corpo, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo };
}

globalThis.fetch = async (entrada) => {
  const url = new URL(String(entrada), "http://teste.local");
  const partes = url.pathname.split("/").filter(Boolean).slice(1); // remove "api"
  const q = url.searchParams;

  if (partes[0] === "produtos" && partes.length === 1) {
    const termo = q.get("busca") ? normalizar(q.get("busca")) : "";
    const lista = dados.produtos.map(comArtesao).filter(
      (p) =>
        (!q.get("tecnica") || p.tecnica === q.get("tecnica")) &&
        (!q.get("regiao") || p.artesaoRegiao === q.get("regiao")) &&
        (!q.get("categoria") || p.categoria === q.get("categoria")) &&
        (!termo ||
          [p.nome, p.tecnica, p.categoria, p.artesaoNome, p.artesaoRegiao].some((c) => normalizar(c).includes(termo)))
    );
    return json(lista);
  }

  if (partes[0] === "produtos") {
    const produto = dados.produtos.find((p) => p.id === decodeURIComponent(partes[1]));
    if (partes[2] === "relacionados") {
      if (!produto) return json([]);
      const limite = Number(q.get("limite") ?? 3);
      return json(
        dados.produtos.filter((p) => p.id !== produto.id && p.tecnica === produto.tecnica).slice(0, limite).map(comArtesao)
      );
    }
    if (partes[2] === "avaliacoes") {
      const notas = dados.avaliacoes.filter((a) => a.produtoId === decodeURIComponent(partes[1])).map((a) => a.nota);
      const media = notas.length ? notas.reduce((x, y) => x + y, 0) / notas.length : 0;
      return json({ media, quantidade: notas.length });
    }
    return produto ? json(comArtesao(produto)) : json({ erro: "Produto não encontrado." }, 404);
  }

  if (partes[0] === "artesaos") {
    const artesao = dados.artesaos.find((a) => a.id === decodeURIComponent(partes[1]));
    if (!artesao) return json({ erro: "Artesão não encontrado." }, 404);
    const usuario = dados.usuarios.find((u) => u.id === artesao.usuarioId);
    return json({
      id: artesao.id,
      nome: usuario?.nome ?? "",
      regiaoOrigem: artesao.regiaoOrigem,
      biografia: artesao.biografia ?? "",
      produtos: dados.produtos.filter((p) => p.artesaoId === artesao.id).map(comArtesao),
    });
  }

  return json({ erro: "Rota não simulada." }, 404);
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
