import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Aceite da PI4-143 (PR #52) e da PI4-144: os dados de exemplo saíram do código. Nenhum arquivo
// de código do repositório (front, backend, scripts e testes) importa os dois módulos mock, e os
// arquivos não existem mais. Este é o único arquivo de código que ainda cita os nomes deles.

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOCKS = ["apiFalsa", "dadosFalsos"];
const EXTENSOES = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const IGNORAR = new Set(["node_modules", ".next", ".git", "dist", "coverage", ".vercel", ".venv", "venv", "__pycache__"]);
const ESTE_ARQUIVO = fileURLToPath(import.meta.url);

function arquivosDeCodigo(pasta) {
  const lista = [];
  for (const entrada of fs.readdirSync(pasta, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) lista.push(...arquivosDeCodigo(caminho));
    else if (EXTENSOES.has(path.extname(entrada.name)) && caminho !== ESTE_ARQUIVO) lista.push(caminho);
  }
  return lista;
}

// Origens de import/export ... from, import(...), import "..." e require(...).
function origens(codigo) {
  const padroes = [
    /\b(?:import|export)\s[^'"`;]*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\brequire\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ];
  return padroes.flatMap((padrao) => [...codigo.matchAll(padrao)].map((m) => m[1]));
}

const arquivos = arquivosDeCodigo(raiz);

test("a varredura enxerga o front, o backend e os testes", () => {
  const relativos = arquivos.map((a) => path.relative(raiz, a).replace(/\\/g, "/"));
  for (const esperado of ["components/VisaoVitrine.tsx", "lib/apiCatalogo.ts", "backend/src/app.ts", "tests/catalogo.test.mjs"]) {
    assert.ok(relativos.includes(esperado), `${esperado} deveria estar na varredura`);
  }
});

test("nenhum arquivo de código importa os módulos mock", () => {
  const achados = [];
  for (const arquivo of arquivos) {
    const codigo = fs.readFileSync(arquivo, "utf8");
    // path.join(..., "lib", "<mock>.ts") era como os testes antigos carregavam os mocks.
    const caminhoMontado = MOCKS.some((mock) => new RegExp(`["'\`]${mock}(\\.ts)?["'\`]`).test(codigo));
    const importados = origens(codigo).filter((origem) => MOCKS.some((mock) => origem.includes(mock)));
    if (importados.length > 0 || caminhoMontado) {
      achados.push(`${path.relative(raiz, arquivo)}: ${importados.join(", ") || "caminho montado"}`);
    }
  }
  assert.deepEqual(achados, []);
});

test("os arquivos mock foram apagados", () => {
  for (const mock of MOCKS) {
    assert.equal(fs.existsSync(path.join(raiz, "lib", `${mock}.ts`)), false, `lib/${mock}.ts ainda existe`);
  }
});
