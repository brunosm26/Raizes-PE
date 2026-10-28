import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { SignJWT } from "jose";
import { cookieFormatoAntigo, subirApi, tokenFormatoAntigo, USUARIOS, type Api } from "./ajudantes";

// Sessão em JWT (PI4-130). Nada aqui toca o banco. O ajudantes.ts já definiu um
// SESSION_SECRET descartável antes de o código da API ser carregado.

const SEGREDO = process.env.SESSION_SECRET as string;
const COMPRADOR = USUARIOS.comprador;

function b64url(texto: string): string {
  return Buffer.from(texto).toString("base64url");
}

describe("token de sessão (JWT HS256)", () => {
  it("cria e lê o token com sub, nome, tipo, iat e exp de 7 dias", async () => {
    const { criarToken, lerToken, DURACAO_SESSAO_SEG } = await import("../src/utils/tokenSessao.js");
    const token = await criarToken(COMPRADOR);
    assert.equal(token.split(".").length, 3);

    const [cabecalho, corpo] = token.split(".");
    assert.deepEqual(JSON.parse(Buffer.from(cabecalho!, "base64url").toString()), { alg: "HS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(corpo!, "base64url").toString());
    assert.equal(claims.sub, COMPRADOR.id);
    assert.equal(claims.exp - claims.iat, DURACAO_SESSAO_SEG);

    const dados = await lerToken(token);
    assert.deepEqual(dados, { id: COMPRADOR.id, nome: COMPRADOR.nome, tipo: COMPRADOR.tipo, exp: claims.exp });
  });

  it("recusa token adulterado (troca do perfil sem nova assinatura)", async () => {
    const { criarToken, lerToken } = await import("../src/utils/tokenSessao.js");
    const [cabecalho, corpo, assinatura] = (await criarToken(COMPRADOR)).split(".");
    const claims = JSON.parse(Buffer.from(corpo!, "base64url").toString());
    const adulterado = `${cabecalho}.${b64url(JSON.stringify({ ...claims, tipo: "admin" }))}.${assinatura}`;
    assert.equal(await lerToken(adulterado), null);
  });

  it("recusa token expirado", async () => {
    const { criarToken, lerToken } = await import("../src/utils/tokenSessao.js");
    assert.equal(await lerToken(await criarToken(COMPRADOR, -60)), null);
  });

  it('recusa alg "none" e outro algoritmo (HS512), mesmo com o segredo certo', async () => {
    const { lerToken } = await import("../src/utils/tokenSessao.js");
    const agora = Math.floor(Date.now() / 1000);
    const claims = { sub: COMPRADOR.id, nome: COMPRADOR.nome, tipo: COMPRADOR.tipo, iat: agora, exp: agora + 3600 };
    const semAssinatura = `${b64url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}.`;
    assert.equal(await lerToken(semAssinatura), null);

    const hs512 = await new SignJWT({ nome: COMPRADOR.nome, tipo: COMPRADOR.tipo })
      .setProtectedHeader({ alg: "HS512" })
      .setSubject(COMPRADOR.id)
      .setIssuedAt(agora)
      .setExpirationTime(agora + 3600)
      .sign(new TextEncoder().encode(SEGREDO));
    assert.equal(await lerToken(hs512), null);
  });

  it("recusa token assinado com outro segredo", async () => {
    const { lerToken } = await import("../src/utils/tokenSessao.js");
    const agora = Math.floor(Date.now() / 1000);
    const outro = await new SignJWT({ nome: COMPRADOR.nome, tipo: COMPRADOR.tipo })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(COMPRADOR.id)
      .setIssuedAt(agora)
      .setExpirationTime(agora + 3600)
      .sign(new TextEncoder().encode("outro-segredo-qualquer-com-mais-de-32-caracteres"));
    assert.equal(await lerToken(outro), null);
  });

  it("recusa o cookie no formato antigo (HMAC) sem lançar erro", async () => {
    const { lerToken } = await import("../src/utils/tokenSessao.js");
    assert.equal(await lerToken(tokenFormatoAntigo()), null);
  });

  it("recusa perfil fora de comprador, artesao e admin", async () => {
    const { criarToken, lerToken } = await import("../src/utils/tokenSessao.js");
    const token = await criarToken({ ...COMPRADOR, tipo: "root" as never });
    assert.equal(await lerToken(token), null);
  });
});

// O mesmo cookie precisa valer nos dois lados enquanto o Next e o Express convivem.
// Este teste carrega o lib/sessao.ts do front (precisa do `npm install` na raiz).
describe("compatibilidade com o front (lib/sessao.ts)", () => {
  it("token do Express é aceito pelo Next e token do Next é aceito pelo Express", async () => {
    const express = await import("../src/utils/tokenSessao.js");
    const next = await import("../../lib/sessao.js");

    const doExpress = await express.criarToken(COMPRADOR);
    assert.equal((await next.lerToken(doExpress))?.id, COMPRADOR.id);

    const doNext = await next.criarToken(COMPRADOR);
    assert.equal((await express.lerToken(doNext))?.id, COMPRADOR.id);

    assert.equal(next.COOKIE_SESSAO, express.COOKIE_SESSAO);
    assert.equal(next.DURACAO_SESSAO_SEG, express.DURACAO_SESSAO_SEG);
  });

  it("os dois lados recusam o cookie antigo e o token expirado", async () => {
    const express = await import("../src/utils/tokenSessao.js");
    const next = await import("../../lib/sessao.js");
    assert.equal(await next.lerToken(tokenFormatoAntigo()), null);
    assert.equal(await next.lerToken(await express.criarToken(COMPRADOR, -60)), null);
    assert.equal(await express.lerToken(await next.criarToken(COMPRADOR, -60)), null);
  });
});

describe("rotas com o cookie antigo", () => {
  let api: Api;
  before(async () => {
    api = await subirApi();
  });
  after(() => api.fechar());

  it("cookie no formato antigo conta como visitante (401 em rota protegida)", async () => {
    const r = await fetch(`${api.url}/pedidos`, { headers: { cookie: cookieFormatoAntigo() } });
    assert.equal(r.status, 401);
  });
});
