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
const {
  completarPreco,
  formatarPreco,
  ehCaractereDePreco,
  somenteDigitos,
  formatarTelefone,
  formatarCep,
} = modulo.exports;

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

test("PI4-91: campo de preço rejeita letras e caracteres não numéricos", () => {
  assert.equal(formatarPreco("abc"), "");
  assert.equal(formatarPreco("texto livre"), "");
  assert.equal(formatarPreco("12a3b4"), "1234");
  assert.equal(formatarPreco("R$ 85,90 teste"), "85,90");
  assert.equal(ehCaractereDePreco("a"), false);
  assert.equal(ehCaractereDePreco("Z"), false);
  assert.equal(ehCaractereDePreco("@"), false);
  assert.equal(ehCaractereDePreco("5"), true);
  assert.equal(ehCaractereDePreco(","), true);
  assert.equal(ehCaractereDePreco("."), true);
});

test("PI4-91: campo Valor valida entrada e mantém o comportamento de salvar como number", () => {
  const precoDigitado = formatarPreco("150,50");
  const valorNumerico = Number(precoDigitado.replace(",", "."));
  assert.equal(typeof valorNumerico, "number");
  assert.equal(Number.isFinite(valorNumerico), true);
  assert.equal(valorNumerico, 150.5);
  assert.equal(valorNumerico > 0, true);

  const precoFormatado = completarPreco(formatarPreco("89"));
  assert.equal(precoFormatado, "89,00");
  assert.equal(Number(precoFormatado.replace(",", ".")), 89);
});

test("PI4-91: campos numéricos com máscara no checkout (telefone, CEP) rejeitam letras", () => {
  assert.equal(somenteDigitos("abc123xyz456"), "123456");
  assert.equal(somenteDigitos("telefone: (81) 98888-7777"), "81988887777");
  assert.equal(formatarTelefone("81a98888b7777"), "(81) 98888-7777");
  assert.equal(formatarCep("50a000b000"), "50000-000");
});
