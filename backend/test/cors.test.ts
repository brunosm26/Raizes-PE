import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import { cors } from "../src/middlewares/cors";

// Req/res mínimos: o middleware só lê origin, método e dois cabeçalhos, e escreve cabeçalhos/status.
function simular(metodo: string, cabecalhos: Record<string, string>, origens: readonly string[]) {
  const enviados = new Map<string, string>();
  let status: number | undefined;
  let terminou = false;
  let chamouNext = false;

  const req = { method: metodo, headers: cabecalhos } as unknown as Request;
  const res = {
    setHeader: (nome: string, valor: string) => enviados.set(nome.toLowerCase(), valor),
    append: (nome: string, valor: string) => {
      const chave = nome.toLowerCase();
      const atual = enviados.get(chave);
      enviados.set(chave, atual ? `${atual}, ${valor}` : valor);
    },
    status(codigo: number) {
      status = codigo;
      return res;
    },
    end() {
      terminou = true;
    },
  } as unknown as Response;

  cors(origens)(req, res, () => {
    chamouNext = true;
  });
  return { enviados, status, terminou, chamouNext };
}

const FRONT = "http://localhost:3000";

describe("CORS com credenciais (PI4-132)", () => {
  it("sem CORS_ORIGIN não mexe na resposta", () => {
    const r = simular("GET", { origin: FRONT }, []);
    assert.equal(r.chamouNext, true);
    assert.equal(r.enviados.size, 0);
  });

  it("requisição sem Origin (mesma origem, curl, proxy do Next) passa direto", () => {
    const r = simular("GET", {}, [FRONT]);
    assert.equal(r.chamouNext, true);
    assert.equal(r.enviados.size, 0);
  });

  it("origem permitida recebe a própria origem e Allow-Credentials (nunca *)", () => {
    const r = simular("GET", { origin: FRONT }, [FRONT]);
    assert.equal(r.chamouNext, true);
    assert.equal(r.enviados.get("access-control-allow-origin"), FRONT);
    assert.equal(r.enviados.get("access-control-allow-credentials"), "true");
    assert.match(r.enviados.get("vary") ?? "", /Origin/);
  });

  it("origem fora da lista não recebe cabeçalho de liberação", () => {
    const r = simular("GET", { origin: "http://malicioso.example" }, [FRONT]);
    assert.equal(r.chamouNext, true);
    assert.equal(r.enviados.has("access-control-allow-origin"), false);
    assert.equal(r.enviados.has("access-control-allow-credentials"), false);
  });

  it("preflight de origem permitida responde 204 sem chegar nas rotas", () => {
    const r = simular(
      "OPTIONS",
      {
        origin: FRONT,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
      [FRONT]
    );
    assert.equal(r.status, 204);
    assert.equal(r.terminou, true);
    assert.equal(r.chamouNext, false);
    assert.equal(r.enviados.get("access-control-allow-origin"), FRONT);
    assert.equal(r.enviados.get("access-control-allow-credentials"), "true");
    assert.match(r.enviados.get("access-control-allow-methods") ?? "", /POST/);
    assert.equal(r.enviados.get("access-control-allow-headers"), "content-type");
  });

  it("preflight de origem não permitida não é respondido pelo CORS", () => {
    const r = simular(
      "OPTIONS",
      { origin: "http://malicioso.example", "access-control-request-method": "POST" },
      [FRONT]
    );
    assert.equal(r.terminou, false);
    assert.equal(r.chamouNext, true);
    assert.equal(r.enviados.has("access-control-allow-origin"), false);
  });
});
