import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Configura o carregamento sob demanda de arquivos TypeScript para o runtime Node.js
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Hook para permitir require('./...ts')
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

const motorPath = path.join(rootDir, "lib", "motorRecomendacao.ts");
const { calcularRecomendacoes } = require(motorPath);

test("Garante que nenhum produto com estoque zerado é recomendado (PI4-82)", async () => {
  const recomendacoes = await calcularRecomendacoes(undefined, 20);
  assert.ok(recomendacoes.length > 0, "Deve retornar produtos");
  for (const prod of recomendacoes) {
    assert.ok(
      prod.estoqueQtd > 0,
      `Produto ${prod.nome} tem estoque ${prod.estoqueQtd}, mas não deveria ser recomendado`
    );
  }
});

test("Respeita o limite máximo de recomendações solicitado", async () => {
  const recomendacoes = await calcularRecomendacoes("u7", 2);
  assert.equal(recomendacoes.length, 2, "Deveria retornar exatamente 2 itens");
});

test("Personaliza recomendações por técnica para comprador com histórico (u7 - Ana Beatriz) (PI4-83)", async () => {
  const recomendacoes = await calcularRecomendacoes("u7", 4);
  const tecnicasNoTopo = recomendacoes.slice(0, 2).map((p) => p.tecnica);

  // Ana Beatriz comprou Cerâmica e Têxtil no histórico
  assert.ok(
    tecnicasNoTopo.includes("Cerâmica") || tecnicasNoTopo.includes("Têxtil"),
    "O topo das recomendações deve refletir a técnica comprada anteriormente"
  );

  const primeiro = recomendacoes[0];
  assert.equal(primeiro.criterio, "historico_tecnica");
  assert.match(primeiro.motivo, /Inspirado no seu apreço por/);
});

test("Desprioriza produtos que o comprador já adquiriu para evitar repetição (PI4-83)", async () => {
  const recomendacoes = await calcularRecomendacoes("u7", 10);
  const produtoInedito = recomendacoes.find((p) => p.id === "p6"); // Jarro Cerâmica Fosco (não comprado)
  const produtoJaComprado = recomendacoes.find((p) => p.id === "p1"); // Vaso Cerâmica Maragogi (comprado)

  assert.ok(produtoInedito, "Produto inédito de cerâmica deve estar presente");
  assert.ok(produtoJaComprado, "Produto já comprado pode estar presente no final");
  assert.ok(
    produtoInedito.score > produtoJaComprado.score,
    `O produto inédito (${produtoInedito.score}) deve ter pontuação superior ao já comprado (${produtoJaComprado.score})`
  );
});

test("Aplica estratégia de Cold Start para novos visitantes sem histórico (PI4-84)", async () => {
  const recomendacoes = await calcularRecomendacoes(undefined, 4);
  assert.ok(recomendacoes.length > 0);

  // Deve priorizar peças com excelente avaliação coletiva
  const primeira = recomendacoes[0];
  assert.ok(
    primeira.criterio === "popularidade" || primeira.criterio === "novidade",
    "Cold start deve usar popularidade ou novidade"
  );
});

test("Explicabilidade (XAI): Todos os itens possuem justificativa textual legível e dados do artesão", async () => {
  const recomendacoes = await calcularRecomendacoes("u7", 5);
  for (const item of recomendacoes) {
    assert.ok(item.motivo && item.motivo.length > 10, "Motivo deve ser detalhado e legível");
    assert.ok(item.artesaoNome, "Nome do artesão deve estar preenchido");
    assert.ok(item.artesaoRegiao, "Região do artesão deve estar preenchida");
    assert.ok(typeof item.score === "number", "Score numérico deve estar presente");
  }
});
