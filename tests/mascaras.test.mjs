import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const arquivo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "mascaras.ts");
const codigo = ts.transpileModule(fs.readFileSync(arquivo, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;
const modulo = new Module(arquivo);
modulo.filename = arquivo;
modulo.paths = Module._nodeModulePaths(path.dirname(arquivo));
modulo._compile(codigo, arquivo);
const { completarPreco, formatarPreco, formatarPrecoAoRetomar } = modulo.exports;

test("cola preço em reais com milhar e sem centavos sem reduzir o valor", () => {
  assert.equal(formatarPreco("R$ 1.234"), "1234");
  assert.equal(completarPreco(formatarPreco("R$ 1.234")), "1234,00");
  assert.equal(Number(formatarPreco("R$ 1.234").replace(",", ".")), 1234);
});

test("mantém a colagem com milhar e centavos", () => {
  assert.equal(formatarPreco("R$ 1.234,56"), "1234,56");
});

test("mantém o ponto digitado como separador decimal", () => {
  assert.equal(formatarPreco("12.34"), "12,34");
  assert.equal(formatarPreco("1.234"), "1,23");
});

test("permite substituir centavos ao voltar a um preço completo", () => {
  assert.equal(formatarPrecoAoRetomar("12,00", "12,003"), "12,3");
  assert.equal(formatarPreco("12,34"), "12,34");
  assert.equal(formatarPrecoAoRetomar("12,00", "12,0034"), "12,34");
  assert.equal(formatarPrecoAoRetomar("12,00", "12,00,"), "12,");
  assert.equal(formatarPreco("12,345"), "12,34");
});
