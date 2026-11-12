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
  ehCaractereDePreco,
  formatarCep,
  formatarPreco,
  formatarTelefone,
  somenteDigitos,
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

test("remove zeros à esquerda na parte inteira do preço preservando zero único", () => {
  assert.equal(formatarPreco("0045,90"), "45,90");
  assert.equal(formatarPreco("0,50"), "0,50");
  assert.equal(completarPreco(""), "");
  assert.equal(completarPreco(",5"), "0,50");
});

test("identifica corretamente caracteres significativos de preço", () => {
  assert.equal(ehCaractereDePreco("9"), true);
  assert.equal(ehCaractereDePreco(","), true);
  assert.equal(ehCaractereDePreco("."), true);
  assert.equal(ehCaractereDePreco("R"), false);
  assert.equal(ehCaractereDePreco("$"), false);
});

test("extrai somente dígitos de entradas alfanuméricas e com símbolos", () => {
  assert.equal(somenteDigitos("(81) 98877-6655"), "81988776655");
  assert.equal(somenteDigitos("CEP: 50030-230"), "50030230");
  assert.equal(somenteDigitos("abc-def"), "");
});

test("formata telefone fixo (10 dígitos) e celular (11 dígitos) com DDD", () => {
  assert.equal(formatarTelefone("8133224455"), "(81) 3322-4455");
  assert.equal(formatarTelefone("81988776655"), "(81) 98877-6655");
});

test("remove prefixo internacional +55 ao colar telefone do WhatsApp e limita a 11 dígitos", () => {
  assert.equal(formatarTelefone("+55 81 98877-6655"), "(81) 98877-6655");
  assert.equal(formatarTelefone("81988776655999"), "(81) 98877-6655");
  assert.equal(formatarTelefone(""), "");
  assert.equal(formatarTelefone("81"), "(81");
  assert.equal(formatarTelefone("81988"), "(81) 988");
});

test("formata CEP com 8 dígitos, preserva digitação parcial e trunca excesso", () => {
  assert.equal(formatarCep("50030230"), "50030-230");
  assert.equal(formatarCep("50030"), "50030");
  assert.equal(formatarCep("CEP 55.000-12399"), "55000-123");
  assert.equal(formatarCep(""), "");
});

test("campo de preço rejeita letras e caracteres não numéricos", () => {
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

test("campo Valor valida entrada e mantém o comportamento de salvar como number", () => {
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

test("campos numéricos com máscara no checkout (telefone, CEP) rejeitam letras", () => {
  assert.equal(somenteDigitos("abc123xyz456"), "123456");
  assert.equal(somenteDigitos("telefone: (81) 98888-7777"), "81988887777");
  assert.equal(formatarTelefone("81a98888b7777"), "(81) 98888-7777");
  assert.equal(formatarCep("50a000b000"), "50000-000");
});
