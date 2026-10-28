import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Sessão em JWT do front (lib/sessao.ts, PI4-130), com um segredo descartável.
// A compatibilidade com o Express fica em backend/test/tokenSessao.test.ts.
const SEGREDO = "segredo-descartavel-de-teste-com-mais-de-32-caracteres";
process.env.SESSION_SECRET = SEGREDO;

const arquivo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "sessao.ts");
const codigo = ts.transpileModule(fs.readFileSync(arquivo, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const modulo = new Module(arquivo);
modulo.filename = arquivo;
modulo.paths = Module._nodeModulePaths(path.dirname(arquivo));
modulo._compile(codigo, arquivo);
const { criarToken, lerToken, DURACAO_SESSAO_SEG, COOKIE_SESSAO } = modulo.exports;

const usuario = { id: "10000000-0000-4000-8000-000000000007", nome: "Ana Beatriz", tipo: "comprador" };
const b64url = (texto) => Buffer.from(texto).toString("base64url");
const decodificar = (parte) => JSON.parse(Buffer.from(parte, "base64url").toString());

test("cria e lê o JWT com sub, nome, tipo, iat e exp de 7 dias no cookie raizes_sessao", async () => {
  assert.equal(COOKIE_SESSAO, "raizes_sessao");
  const token = await criarToken(usuario);
  const [cabecalho, corpo] = token.split(".");
  assert.deepEqual(decodificar(cabecalho), { alg: "HS256", typ: "JWT" });
  const claims = decodificar(corpo);
  assert.equal(claims.sub, usuario.id);
  assert.equal(claims.exp - claims.iat, DURACAO_SESSAO_SEG);
  assert.deepEqual(await lerToken(token), { ...usuario, exp: claims.exp });
});

test("recusa token adulterado, expirado e sem token", async () => {
  const [cabecalho, corpo, assinatura] = (await criarToken(usuario)).split(".");
  const adulterado = `${cabecalho}.${b64url(JSON.stringify({ ...decodificar(corpo), tipo: "admin" }))}.${assinatura}`;
  assert.equal(await lerToken(adulterado), null);
  assert.equal(await lerToken(await criarToken(usuario, -60)), null);
  assert.equal(await lerToken(undefined), null);
});

test('recusa alg "none"', async () => {
  const agora = Math.floor(Date.now() / 1000);
  const claims = { sub: usuario.id, nome: usuario.nome, tipo: usuario.tipo, iat: agora, exp: agora + 3600 };
  const semAssinatura = `${b64url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}.`;
  assert.equal(await lerToken(semAssinatura), null);
});

test("recusa o cookie no formato antigo (HMAC) sem lançar erro", async () => {
  const corpo = b64url(JSON.stringify({ ...usuario, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const antigo = `${corpo}.${createHmac("sha256", SEGREDO).update(corpo).digest("base64url")}`;
  assert.equal(await lerToken(antigo), null);
});

test("sem SESSION_SECRET: criar lança erro e ler devolve null (como antes)", async () => {
  const token = await criarToken(usuario);
  process.env.SESSION_SECRET = "curto";
  try {
    await assert.rejects(() => criarToken(usuario), /SESSION_SECRET/);
    assert.equal(await lerToken(token), null);
  } finally {
    process.env.SESSION_SECRET = SEGREDO;
  }
});
