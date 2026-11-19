import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import SwaggerParser from "@apidevtools/swagger-parser";
import { Ajv } from "ajv";
import { parse } from "yaml";
import { camposNaoDocumentados } from "../scripts/conferir-openapi";
import type { PedidoComItens, StatusPedido } from "../src/types/dominio";
import { json, subirApi, USUARIOS, type Api } from "./ajudantes";

// Fila assíncrona de ponta a ponta pela API, SEM banco: o pedidoService (que grava no banco), o
// recomendacaoService (que lê) e o buscarNomeETipo da sessão viram dublês em memória. O resto é
// o real: rotas, controllers, fila, worker e caixa de notificações.
// O mesmo fluxo com banco de verdade fica em notificacoesBanco.test.ts.

const PEDIDO_ID = "4a1b2c3d-0000-4000-8000-000000000001";

function pedidoFalso(status: StatusPedido = "pendente"): PedidoComItens {
  return {
    id: PEDIDO_ID,
    compradorId: USUARIOS.comprador.id,
    compradorNome: USUARIOS.comprador.nome,
    dataPedido: "2026-11-19T12:00:00.000Z",
    status,
    valorTotal: 230,
    itens: [
      { id: "i1", pedidoId: PEDIDO_ID, produtoId: "x1", quantidade: 2, precoUnitario: 40, produtoNome: "Tapete", produtoTecnica: "Têxtil", artesaoUsuarioId: USUARIOS.artesao.id, artesaoNome: USUARIOS.artesao.nome },
      { id: "i2", pedidoId: PEDIDO_ID, produtoId: "x2", quantidade: 1, precoUnitario: 150, produtoNome: "Vaso", produtoTecnica: "Cerâmica", artesaoUsuarioId: USUARIOS.outroArtesao.id, artesaoNome: USUARIOS.outroArtesao.nome },
    ],
  };
}

// O recálculo das recomendações demora de propósito: se o controller esperasse o job, a
// resposta do POST também demoraria, e o job nunca estaria "concluido" na hora da resposta.
const recomendacoes = { atrasoMs: 150, falhar: false, chamadas: [] as (string | undefined)[] };

function dublar(caminhoRelativo: string, exportados: Record<string, unknown>): void {
  const caminho = require.resolve(caminhoRelativo);
  const duble = new Module(caminho);
  duble.filename = caminho;
  duble.loaded = true;
  duble.exports = exportados;
  require.cache[caminho] = duble;
}

// Import dinâmico: os módulos carregam o config/env, que o ajudantes prepara antes.
async function instalarDubles(): Promise<void> {
  const usuarios = await import("../src/repositories/usuarioRepository.js");
  dublar("../src/repositories/usuarioRepository", {
    ...usuarios,
    async buscarNomeETipo(id: string) {
      const u = Object.values(USUARIOS).find((x) => x.id === id);
      return u ? { nome: u.nome, tipo: u.tipo } : null;
    },
  });
  const pedidos = await import("../src/services/pedidoService.js");
  dublar("../src/services/pedidoService", {
    ...pedidos,
    criarPedido: async () => pedidoFalso(),
    atualizarStatus: async (_id: string, status: StatusPedido) => pedidoFalso(status),
  });
  const recomendacao = await import("../src/services/recomendacaoService.js");
  dublar("../src/services/recomendacaoService", {
    ...recomendacao,
    async calcularRecomendacoes(compradorId: string | undefined) {
      recomendacoes.chamadas.push(compradorId);
      await new Promise((ok) => setTimeout(ok, recomendacoes.atrasoMs));
      if (recomendacoes.falhar) throw new Error("recomendações indisponíveis");
      return [];
    },
  });
}

type Fila = typeof import("../src/services/filaAssincronaService.js");
type Usuario = (typeof USUARIOS)[keyof typeof USUARIOS];

let api: Api;
let servico: Fila;
before(async () => {
  await instalarDubles();
  api = await subirApi();
  servico = await import("../src/services/filaAssincronaService.js");
});
after(() => api?.fechar());

async function caixaDe(usuario: Usuario) {
  const r = await fetch(`${api.url}/notificacoes`, { headers: { cookie: await api.cookie(usuario) } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  return (await r.json()) as {
    naoLidas: number;
    total: number;
    dados: { id: string; usuarioId: string; tipo: string; resumoWhatsapp?: string }[];
    fila?: { contagem: Record<string, number>; jobsRecentes: Record<string, unknown>[] };
  };
}

async function ler(usuario: Usuario, corpo: unknown) {
  const r = await fetch(`${api.url}/notificacoes/ler`, { method: "POST", ...json(corpo, await api.cookie(usuario)) });
  return { status: r.status, corpo: (await r.json()) as { marcadas: number; naoLidas: number; erro?: string } };
}

function ultimoJob(tipo: string) {
  return servico.filaAssincrona.jobsRecentes(50).find((j) => j.tipo === tipo);
}

describe("fila assíncrona pela API (sem banco)", () => {
  it("POST /pedidos responde 201 antes do worker terminar o job pedido.criado", async () => {
    const inicio = performance.now();
    const r = await fetch(`${api.url}/pedidos`, {
      method: "POST",
      ...json({ itens: [{ produtoId: "x1", quantidade: 2 }] }, await api.cookie(USUARIOS.comprador)),
    });
    const duracao = performance.now() - inicio;
    assert.equal(r.status, 201);

    const job = ultimoJob("pedido.criado");
    assert.ok(job, "o controller não enfileirou o job");
    assert.equal(job.referencia, PEDIDO_ID);
    assert.notEqual(job.status, "concluido", "a resposta esperou o job");
    assert.ok(duracao < recomendacoes.atrasoMs, `a resposta levou ${duracao.toFixed(0)} ms: esperou o recálculo`);

    await servico.filaAssincrona.aguardarOcioso();
    assert.equal(servico.filaAssincrona.buscar(job.id)!.status, "concluido");
    assert.deepEqual(recomendacoes.chamadas, [USUARIOS.comprador.id], "o worker pré-aquece as recomendações do comprador");
  });

  it("depois do worker: comprador vê o pedido recebido e cada artesão a sua venda com o resumo do WhatsApp", async () => {
    const comprador = await caixaDe(USUARIOS.comprador);
    assert.deepEqual(comprador.dados.map((n) => n.tipo), ["pedido.recebido"]);
    assert.equal(comprador.fila, undefined, "só o admin vê a fila");

    for (const artesao of [USUARIOS.artesao, USUARIOS.outroArtesao]) {
      const caixa = await caixaDe(artesao);
      assert.equal(caixa.total, 1);
      assert.equal(caixa.dados[0]!.tipo, "pedido.nova_venda");
      assert.equal(caixa.dados[0]!.usuarioId, artesao.id);
      assert.match(caixa.dados[0]!.resumoWhatsapp ?? "", new RegExp(`Aqui é ${artesao.nome}`));
    }
    assert.equal((await caixaDe(USUARIOS.admin)).total, 0);
  });

  it("PATCH /pedidos/:id enfileira pedido.status_atualizado e o comprador recebe o 'enviado'", async () => {
    const r = await fetch(`${api.url}/pedidos/${PEDIDO_ID}`, {
      method: "PATCH",
      ...json({ status: "enviado" }, await api.cookie(USUARIOS.artesao)),
    });
    assert.equal(r.status, 200);
    assert.ok(ultimoJob("pedido.status_atualizado"), "o controller não enfileirou o job");

    await servico.filaAssincrona.aguardarOcioso();
    const comprador = await caixaDe(USUARIOS.comprador);
    assert.deepEqual(comprador.dados.map((n) => n.tipo), ["pedido.enviado", "pedido.recebido"]);
    assert.equal(comprador.naoLidas, 2);
    assert.equal((await caixaDe(USUARIOS.artesao)).total, 1, "o aviso de envio é só do comprador");
  });

  it("admin vê o resumo da fila, com os jobs recentes e sem o payload do pedido", async () => {
    const admin = await caixaDe(USUARIOS.admin);
    assert.ok(admin.fila);
    assert.equal(admin.fila.contagem.concluido, 2);
    assert.deepEqual(admin.fila.jobsRecentes.map((j) => j.tipo), ["pedido.status_atualizado", "pedido.criado"]);
    for (const job of admin.fila.jobsRecentes) {
      assert.equal("payload" in job, false);
      assert.equal("envolvidos" in job, false);
    }
  });

  it("POST /notificacoes/ler marca só as do usuário logado, mesmo com o id de outro", async () => {
    const idDoArtesao = (await caixaDe(USUARIOS.artesao)).dados[0]!.id;
    assert.deepEqual((await ler(USUARIOS.comprador, { ids: [idDoArtesao] })).corpo, { marcadas: 0, naoLidas: 2 });

    const idDoComprador = (await caixaDe(USUARIOS.comprador)).dados[0]!.id;
    assert.deepEqual((await ler(USUARIOS.comprador, { ids: [idDoComprador] })).corpo, { marcadas: 1, naoLidas: 1 });
    assert.deepEqual((await ler(USUARIOS.comprador, {})).corpo, { marcadas: 1, naoLidas: 0 });

    assert.equal((await caixaDe(USUARIOS.artesao)).naoLidas, 1, "a caixa do artesão não mudou");
  });

  it("POST /notificacoes/ler sem corpo marca todas; ids fora do formato respondem 400", async () => {
    const r = await fetch(`${api.url}/notificacoes/ler`, { method: "POST", headers: { cookie: await api.cookie(USUARIOS.artesao) } });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { marcadas: 1, naoLidas: 0 });

    for (const ids of ["tudo", [1], [""], Array.from({ length: 101 }, (_, i) => `id-${i}`)]) {
      const { status, corpo } = await ler(USUARIOS.artesao, { ids });
      assert.equal(status, 400, JSON.stringify(ids).slice(0, 40));
      assert.ok(corpo.erro);
    }
  });

  it("sem sessão, as duas rotas respondem 401", async () => {
    assert.equal((await fetch(`${api.url}/notificacoes`)).status, 401);
    assert.equal((await fetch(`${api.url}/notificacoes/ler`, { method: "POST" })).status, 401);
  });

  it("job que falha no worker não muda a resposta do checkout e termina em 'erro'", async () => {
    recomendacoes.falhar = true;
    recomendacoes.atrasoMs = 1;
    const erroOriginal = console.error;
    console.error = () => {}; // o aoFalhar da fila loga o erro esperado
    try {
      const r = await fetch(`${api.url}/pedidos`, {
        method: "POST",
        ...json({ itens: [{ produtoId: "x1", quantidade: 1 }] }, await api.cookie(USUARIOS.comprador)),
      });
      assert.equal(r.status, 201);
      const job = ultimoJob("pedido.criado")!;
      await servico.filaAssincrona.aguardarOcioso();
      const final = servico.filaAssincrona.buscar(job.id)!;
      assert.equal(final.status, "erro");
      assert.equal(final.tentativas, final.maxTentativas);
      assert.equal(final.ultimoErro, "recomendações indisponíveis");
    } finally {
      console.error = erroOriginal;
      recomendacoes.falhar = false;
    }
  });
});

describe("respostas de /notificacoes x openapi.yaml", () => {
  it("as caixas de comprador, artesão e admin seguem o schema e não têm campo fora da spec", async () => {
    const spec = (await SwaggerParser.dereference(parse(readFileSync(join(__dirname, "..", "openapi.yaml"), "utf8")) as never)) as unknown as {
      paths: Record<string, Record<string, { responses: Record<string, { content: Record<string, { schema: object }> }> }>>;
    };
    const esquema = spec.paths["/notificacoes"]!.get!.responses["200"]!.content["application/json"]!.schema;
    const ajv = new Ajv({ strict: false, allErrors: true });
    ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    ajv.addFormat("date-time", (v: string) => !Number.isNaN(Date.parse(v)));
    const validar = ajv.compile(esquema);

    for (const usuario of [USUARIOS.comprador, USUARIOS.artesao, USUARIOS.admin]) {
      const caixa = await caixaDe(usuario);
      assert.ok(validar(caixa), `${usuario.tipo}: ${ajv.errorsText(validar.errors)}`);
      assert.deepEqual(camposNaoDocumentados(esquema as never, caixa), [], usuario.tipo);
    }
  });
});
