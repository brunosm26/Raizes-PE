import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conferirBancoDeTeste, type UrlDoTime } from "./ajudantes";

// Trava que impede os testes com banco de gravar no Neon do time. Só a função pura: nada
// aqui toca banco nem lê arquivo .env. As URLs são fictícias.

const POOLED = "postgresql://dono:senha@ep-azul-123-pooler.sa-east-1.aws.neon.tech/raizes?sslmode=require&channel_binding=require";
const DIRETA = "postgresql://dono:senha@ep-azul-123.sa-east-1.aws.neon.tech/raizes?sslmode=require";
const LOCAL = "postgresql://postgres@127.0.0.1:5432/raizes_teste";

const doTime = (valor: string): UrlDoTime[] => [{ fonte: "backend/.env", variavel: "DATABASE_URL", valor }];
const bloqueia = (teste: string, time: UrlDoTime[], remoto = true) =>
  assert.throws(() => conferirBancoDeTeste(teste, time, remoto), /mesmo banco da DATABASE_URL de backend\/\.env/);

describe("trava do banco de teste", () => {
  it("URL idêntica à do time aborta", () => {
    bloqueia(POOLED, doTime(POOLED));
  });

  it("pooled x direta do mesmo banco aborta, nos dois sentidos", () => {
    bloqueia(DIRETA, doTime(POOLED));
    bloqueia(POOLED, doTime(DIRETA));
  });

  it("parâmetros em outra ordem ou channel_binding removido abortam", () => {
    bloqueia(
      "postgresql://dono:senha@ep-azul-123-pooler.sa-east-1.aws.neon.tech/raizes?channel_binding=require&sslmode=require",
      doTime(POOLED)
    );
    bloqueia("postgresql://dono:senha@ep-azul-123-pooler.sa-east-1.aws.neon.tech/raizes?sslmode=require", doTime(POOLED));
  });

  it("host em maiúsculas e porta 5432 explícita contam como o mesmo banco", () => {
    bloqueia("postgres://dono:senha@EP-AZUL-123-POOLER.sa-east-1.aws.neon.tech:5432/raizes", doTime(POOLED));
  });

  it("banco com nome diferente no mesmo host passa (com o host remoto liberado)", () => {
    conferirBancoDeTeste(
      "postgresql://dono:senha@ep-azul-123-pooler.sa-east-1.aws.neon.tech/raizes_teste?sslmode=require",
      doTime(POOLED),
      true
    );
  });

  it("host local passa sem precisar de TEST_DB_REMOTO_DESCARTAVEL", () => {
    conferirBancoDeTeste(LOCAL, doTime(POOLED), false);
    conferirBancoDeTeste("postgresql://postgres@localhost/raizes_teste", doTime(POOLED), false);
    conferirBancoDeTeste("postgresql://postgres@[::1]:5432/raizes_teste", doTime(POOLED), false);
  });

  it("host remoto sem TEST_DB_REMOTO_DESCARTAVEL=1 aborta", () => {
    assert.throws(
      () => conferirBancoDeTeste("postgresql://dono:senha@ep-verde-9.sa-east-1.aws.neon.tech/raizes", doTime(POOLED), false),
      /TEST_DB_REMOTO_DESCARTAVEL=1/
    );
  });

  it("URL inválida aborta, seja a de teste ou a do time", () => {
    assert.throws(() => conferirBancoDeTeste("nao-e-url", doTime(POOLED), true), /Não foi possível analisar a TEST_DATABASE_URL/);
    assert.throws(() => conferirBancoDeTeste("https://exemplo.com/raizes", doTime(POOLED), true), /TEST_DATABASE_URL/);
    assert.throws(() => conferirBancoDeTeste(LOCAL, doTime("lixo"), false), /analisar a DATABASE_URL de backend\/\.env/);
  });

  it("variável do time vazia ou ausente é ignorada", () => {
    conferirBancoDeTeste(LOCAL, [...doTime(""), { fonte: ".env (raiz)", variavel: "DIRECT_URL", valor: undefined }], false);
  });

  it("a mensagem diz a fonte e a variável, nunca o valor", () => {
    const time: UrlDoTime[] = [{ fonte: ".env.local (raiz)", variavel: "DIRECT_URL", valor: DIRETA }];
    assert.throws(
      () => conferirBancoDeTeste(POOLED, time, true),
      (erro: Error) => {
        assert.match(erro.message, /DIRECT_URL de \.env\.local \(raiz\)/);
        assert.doesNotMatch(erro.message, /senha|ep-azul|neon\.tech|raizes\?/);
        return true;
      }
    );
  });
});
