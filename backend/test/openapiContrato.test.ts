import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import Module from "node:module";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import SwaggerParser from "@apidevtools/swagger-parser";
import { parse } from "yaml";
import { STATUS_PEDIDO, TECNICAS, type TipoUsuario } from "../src/types/dominio";
import { json, subirApi, USUARIOS, type Api } from "./ajudantes";

// Contrato do openapi.yaml sem banco (PI4-145): a segurança declarada bate com o middleware
// de cada rota, os erros que todo corpo pode gerar estão documentados e os limites escritos na
// spec são os mesmos que os services aplicam. Só o buscarNomeETipo é um dublê em memória.

interface Op {
  security?: Record<string, unknown>[];
  responses: Record<string, unknown>;
  "x-perfis"?: TipoUsuario[];
}
interface Esquema {
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  properties: Record<string, Esquema>;
}
interface Spec {
  paths: Record<string, Record<string, Op>>;
  components: { schemas: Record<string, Esquema> };
}

const raiz = join(__dirname, "..");
const arquivoSpec = join(raiz, "openapi.yaml");
const spec = parse(readFileSync(arquivoSpec, "utf8")) as Spec;
const schemas = spec.components.schemas;
const TODOS_OS_PERFIS: TipoUsuario[] = ["comprador", "artesao", "admin"];
const SO_COOKIE = [{ cookieSessao: [] }];
const COOKIE_OPCIONAL = [{}, { cookieSessao: [] }];

// Rotas cuja sessão é opcional e lida pelo próprio controller, sem middleware.
const SESSAO_NO_CONTROLLER = new Set(["GET /auth/me"]);

interface RotaExpress {
  chave: string;
  middleware: "exigirSessao" | "carregarSessao" | null;
  perfis: TipoUsuario[];
}

// Lê src/routes como o openapi.test.ts, guardando também o middleware de sessão de cada rota.
function rotasDoExpress(): RotaExpress[] {
  const pasta = join(raiz, "src", "routes");
  const prefixos = new Map(
    [...readFileSync(join(pasta, "index.ts"), "utf8").matchAll(/rotas\.use\("([^"]+)",\s*(\w+)\)/g)].map(([, p, r]) => [r!, p!])
  );
  const rotas: RotaExpress[] = [];
  for (const arquivo of readdirSync(pasta).filter((f) => f !== "index.ts")) {
    const codigo = readFileSync(join(pasta, arquivo), "utf8");
    const padrao = /(\w+)\.(get|post|put|patch|delete)\("([^"]*)",\s*(?:(exigirSessao)\(([^)]*)\)|(carregarSessao))?/g;
    for (const [, router, metodo, caminho, exigir, perfis, carregar] of codigo.matchAll(padrao)) {
      const completo = (prefixos.get(router!)! + (caminho === "/" ? "" : caminho)).replace(/:(\w+)/g, "{$1}");
      const lista = [...(perfis ?? "").matchAll(/"(\w+)"/g)].map(([, p]) => p as TipoUsuario);
      rotas.push({
        chave: `${metodo!.toUpperCase()} ${completo}`,
        middleware: exigir ? "exigirSessao" : carregar ? "carregarSessao" : null,
        perfis: lista.length > 0 ? lista : TODOS_OS_PERFIS,
      });
    }
  }
  return rotas;
}

function opDa(chave: string): Op {
  const [metodo, caminho] = chave.split(" ");
  const op = spec.paths[caminho!]?.[metodo!.toLowerCase()];
  assert.ok(op, `${chave} não está no openapi.yaml`);
  return op;
}

const ROTAS = rotasDoExpress();
const PROTEGIDAS = ROTAS.filter((r) => r.middleware === "exigirSessao");
const COM_CORPO = ROTAS.filter((r) => /^(POST|PATCH|PUT) /.test(r.chave));
const ID = "30000000-0000-4000-8000-000000000002";
const url = (chave: string) => chave.split(" ")[1]!.replace("{id}", ID);
const metodo = (chave: string) => chave.split(" ")[0]!;

describe("openapi.yaml: documento", () => {
  it("é um OpenAPI válido, com todas as referências resolvidas", async () => {
    await SwaggerParser.validate(parse(readFileSync(arquivoSpec, "utf8")) as never);
  });

  it("técnicas e status são os mesmos do domínio", () => {
    assert.deepEqual(schemas.Tecnica!.enum, [...TECNICAS]);
    assert.deepEqual(schemas.StatusPedido!.enum, [...STATUS_PEDIDO]);
  });
});

describe("openapi.yaml: segurança x middleware", () => {
  for (const rota of ROTAS) {
    it(`${rota.chave} declara a sessão e os perfis que o middleware aplica`, () => {
      const op = opDa(rota.chave);
      if (rota.middleware === "exigirSessao") {
        assert.deepEqual(op.security, SO_COOKIE);
        assert.deepEqual(op["x-perfis"], rota.perfis);
      } else {
        const esperado = rota.middleware === "carregarSessao" || SESSAO_NO_CONTROLLER.has(rota.chave) ? COOKIE_OPCIONAL : [];
        assert.deepEqual(op.security, esperado);
        assert.equal(op["x-perfis"], undefined);
      }
    });
  }

  for (const rota of PROTEGIDAS) {
    it(`${rota.chave} documenta 401 e, se limita perfis, 403`, () => {
      const op = opDa(rota.chave);
      assert.ok(op.responses["401"], "sem 401");
      const limitaPerfis = rota.perfis.length < TODOS_OS_PERFIS.length;
      assert.equal(Boolean(op.responses["403"]), limitaPerfis);
    });
  }

  for (const rota of COM_CORPO) {
    it(`${rota.chave} documenta 400 e 413, que vêm da leitura do corpo`, () => {
      const op = opDa(rota.chave);
      assert.ok(op.responses["400"], "sem 400");
      assert.ok(op.responses["413"], "sem 413");
    });
  }
});

// Igual ao de escritaSemBanco.test.ts: import dinâmico para o env do ajudantes valer antes.
async function instalarDubleDeUsuarios(): Promise<void> {
  const caminho = require.resolve("../src/repositories/usuarioRepository");
  const real = await import("../src/repositories/usuarioRepository.js");
  const duble = new Module(caminho);
  duble.filename = caminho;
  duble.loaded = true;
  duble.exports = {
    ...real,
    async buscarNomeETipo(id: string) {
      const u = Object.values(USUARIOS).find((x) => x.id === id);
      return u ? { nome: u.nome, tipo: u.tipo } : null;
    },
  };
  require.cache[caminho] = duble;
}

describe("openapi.yaml: comportamento sem banco", () => {
  let api: Api;
  before(async () => {
    await instalarDubleDeUsuarios();
    api = await subirApi();
  });
  after(() => api?.fechar());

  async function erro(chave: string, init: RequestInit, status: number, mensagem?: string | RegExp) {
    const r = await fetch(`${api.url}${url(chave)}`, { method: metodo(chave), ...init });
    const corpo = (await r.json()) as { ok: boolean; erro: string };
    assert.equal(r.status, status, `${chave}: ${corpo.erro}`);
    assert.equal(corpo.ok, false);
    if (mensagem) assert.match(corpo.erro, mensagem instanceof RegExp ? mensagem : new RegExp(mensagem));
  }

  for (const rota of PROTEGIDAS) {
    it(`${rota.chave} responde 401 sem cookie e 403 para quem não está em x-perfis`, async () => {
      await erro(rota.chave, {}, 401);
      for (const perfil of TODOS_OS_PERFIS.filter((p) => !opDa(rota.chave)["x-perfis"]!.includes(p))) {
        await erro(rota.chave, { headers: { cookie: await api.cookie(USUARIOS[perfil]) } }, 403);
      }
    });
  }

  for (const rota of COM_CORPO) {
    it(`${rota.chave} responde 400 e 413 pelo corpo, antes da sessão`, async () => {
      const headers = { "content-type": "application/json" };
      await erro(rota.chave, { headers, body: "{invalido" }, 400, "Corpo da requisição inválido.");
      const acimaDoLimite = JSON.stringify({ x: "a".repeat(4 * 1024 * 1024) });
      await erro(rota.chave, { headers, body: acimaDoLimite }, 413, "Corpo da requisição grande demais.");
    });
  }

  it("o limite do corpo é de 4 MB: logo abaixo dele a requisição chega à sessão", async () => {
    const dentro = JSON.stringify({ x: "a".repeat(4 * 1024 * 1024 - 20) });
    await erro("POST /produtos", { headers: { "content-type": "application/json" }, body: dentro }, 401);
  });

  it("corpo com outro Content-Type é tratado como vazio", async () => {
    await erro("POST /auth/login", { headers: { "content-type": "text/plain" }, body: "{}" }, 400, "Informe e-mail e senha.");
  });

  it("logout apaga o cookie como a spec descreve", async () => {
    const r = await fetch(`${api.url}/auth/logout`, { method: "POST" });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("set-cookie") ?? "", /^raizes_sessao=; Max-Age=0; Path=\/; Expires=[^;]+; HttpOnly; SameSite=Lax$/);
  });

  it("id de pedido em formato inválido responde 404, não 400", async () => {
    const init = { ...json({ status: "pago" }, await api.cookie(USUARIOS.admin)), method: "PATCH" };
    const r = await fetch(`${api.url}/pedidos/nao-e-uuid`, init);
    assert.equal(r.status, 404);
  });

  describe("limites da spec x validação dos services", () => {
    const campos = schemas.CamposEditaveisProduto!.properties;
    const base = { nome: "Vaso", descricao: "D", tecnica: "Cerâmica", categoria: "Casa", preco: 10, estoqueQtd: 1 };

    // Um corpo com técnica inválida só chega a essa mensagem depois de passar pelos outros campos,
    // o que prova o lado válido do limite sem gravar nada.
    const PASSOU = "Escolha uma técnica válida.";
    async function produto(mudanca: Record<string, unknown>, mensagem: string | RegExp) {
      const cookie = await api.cookie(USUARIOS.artesao);
      await erro("POST /produtos", json({ ...base, ...mudanca }, cookie), 400, mensagem);
    }

    it("imagemUrl: maxLength", async () => {
      const prefixo = "data:image/png;base64,";
      const limite = campos.imagemUrl!.maxLength!;
      const imagem = (tamanho: number) => prefixo + "A".repeat(tamanho - prefixo.length);
      await produto({ tecnica: "x", imagemUrl: imagem(limite) }, PASSOU);
      await produto({ tecnica: "x", imagemUrl: imagem(limite + 1) }, "A imagem precisa ter até 2MB.");
    });

    it("nome: maxLength e minLength", async () => {
      const limite = campos.nome!.maxLength!;
      await produto({ tecnica: "x", nome: "n".repeat(limite) }, PASSOU);
      await produto({ nome: "n".repeat(limite + 1) }, /nome/);
      await produto({ nome: "   " }, /nome/);
    });

    it("preco: acima de zero e até o maximum", async () => {
      await produto({ tecnica: "x", preco: campos.preco!.maximum! }, PASSOU);
      await produto({ preco: 100_000_000 }, "Informe um preço válido.");
      await produto({ preco: campos.preco!.minimum! }, "Informe um preço válido.");
    });

    it("estoqueQtd: minimum e maximum", async () => {
      await produto({ tecnica: "x", estoqueQtd: campos.estoqueQtd!.maximum! }, PASSOU);
      await produto({ tecnica: "x", estoqueQtd: campos.estoqueQtd!.minimum! }, PASSOU);
      await produto({ estoqueQtd: campos.estoqueQtd!.maximum! + 1 }, "Informe um estoque válido.");
      await produto({ estoqueQtd: campos.estoqueQtd!.minimum! - 1 }, "Informe um estoque válido.");
    });

    it("quantidade: 1 a 99", async () => {
      const post = opDa("POST /pedidos") as unknown as {
        requestBody: { content: { "application/json": { schema: { properties: { itens: { items: Esquema } } } } } };
      };
      const quantidade = post.requestBody.content["application/json"].schema.properties.itens.items.properties.quantidade!;
      assert.deepEqual([quantidade.minimum, quantidade.maximum], [1, 99]);
      const cookie = await api.cookie(USUARIOS.comprador);
      for (const valor of [quantidade.minimum! - 1, quantidade.maximum! + 1]) {
        const corpo = { itens: [{ produtoId: ID, quantidade: valor }] };
        await erro("POST /pedidos", json(corpo, cookie), 400, "Quantidade inválida no pedido.");
      }
    });

    it("cadastro: limites de nome, e-mail e senha", async () => {
      const post = opDa("POST /auth/cadastro") as unknown as {
        requestBody: { content: { "application/json": { schema: Esquema } } };
      };
      const p = post.requestBody.content["application/json"].schema.properties;
      const valido = { nome: "Maria", email: "m@exemplo.com", senha: "12345678" };
      const cadastro = (mudanca: object, mensagem: string) =>
        erro("POST /auth/cadastro", json({ ...valido, ...mudanca }), 400, mensagem);
      await cadastro({ nome: "n".repeat(p.nome!.maxLength! + 1) }, "Informe seu nome");
      await cadastro({ email: `${"e".repeat(p.email!.maxLength!)}@a.co` }, "Informe um e-mail válido.");
      await cadastro({ senha: "s".repeat(p.senha!.minLength! - 1) }, "A senha precisa ter de 8 a 200 caracteres.");
      await cadastro({ senha: "s".repeat(p.senha!.maxLength! + 1) }, "A senha precisa ter de 8 a 200 caracteres.");
    });
  });
});
