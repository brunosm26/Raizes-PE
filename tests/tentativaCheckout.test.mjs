import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const arquivo = fileURLToPath(new URL("../lib/tentativaCheckout.ts", import.meta.url));
const codigo = ts.transpileModule(readFileSync(arquivo, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;
const modulo = new Module(arquivo);
modulo._compile(codigo, arquivo);
const { criarControleCheckout } = modulo.exports;
const itens = [{ produtoId: "p1", quantidade: 1 }];
const novaChave = () => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
};
function storage() {
  let valor = null;
  return { getItem: () => valor, setItem: (_k, v) => { valor = v; }, removeItem: () => { valor = null; } };
}

for (const falha of ["acesso", "leitura", "escrita"]) {
  test(`checkout mantém a chave em memória após falha de ${falha} do storage`, () => {
    const s = storage();
    if (falha !== "acesso") s[falha === "leitura" ? "getItem" : "setItem"] = () => { throw new Error("Storage bloqueado"); };
    const controle = criarControleCheckout(() => {
      if (falha === "acesso") throw new Error("SecurityError");
      return s;
    }, novaChave());
    const chave = controle.obterChave("u1", itens);
    assert.equal(controle.obterChave("u1", itens), chave);
    controle.concluir();
    assert.notEqual(controle.obterChave("u1", itens), chave);
  });
}

test("recarregar a aba recupera a chave e concluir permite uma nova compra igual", () => {
  const s = storage();
  const gerar = novaChave();
  const primeiro = criarControleCheckout(() => s, gerar);
  const chave = primeiro.obterChave("u1", itens);
  const recarregado = criarControleCheckout(() => s, gerar);
  assert.equal(recarregado.obterChave("u1", itens), chave);
  recarregado.concluir();
  assert.notEqual(recarregado.obterChave("u1", itens), chave);
});

test("JSON ou UUID inválido no storage não bloqueia a compra", () => {
  const s = storage();
  s.setItem("", "{invalido");
  const controle = criarControleCheckout(() => s, novaChave());
  assert.match(controle.obterChave("u1", itens), /^[0-9a-f-]{36}$/);
  const salvo = JSON.parse(s.getItem(""));
  s.setItem("", JSON.stringify({ ...salvo, chave: "invalida" }));
  const recarregado = criarControleCheckout(() => s, novaChave());
  assert.notEqual(recarregado.obterChave("u1", itens), "invalida");
});

test("falha ao remover chave concluída não reutiliza o pedido nesta sessão", () => {
  const s = storage();
  s.removeItem = () => { throw new Error("Storage bloqueado"); };
  const controle = criarControleCheckout(() => s, novaChave());
  const chave = controle.obterChave("u1", itens);
  controle.concluir();
  assert.notEqual(controle.obterChave("u1", itens), chave);
});

test("falha ao persistir carrinho vazio preserva a recuperação após recarga", () => {
  const s = storage();
  const gerar = novaChave();
  const controle = criarControleCheckout(() => s, gerar);
  const chave = controle.obterChave("u1", itens);
  controle.concluir(true);
  const recarregado = criarControleCheckout(() => s, gerar);
  assert.equal(recarregado.obterChave("u1", itens), chave);
  assert.notEqual(controle.obterChave("u1", itens), chave);
});

test("mudar comprador ou carrinho cria uma nova tentativa", () => {
  const controle = criarControleCheckout(() => storage(), novaChave());
  const chave = controle.obterChave("u1", itens);
  assert.notEqual(controle.obterChave("u2", itens), chave);
  assert.notEqual(controle.obterChave("u1", [{ produtoId: "p1", quantidade: 2 }]), chave);
});
