import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PedidoComItens } from "../src/types/dominio";
import { FilaAssincrona } from "../src/utils/filaAssincrona";
import { CaixaNotificacoes, notificacaoDeStatus, notificacoesDoPedidoCriado } from "../src/utils/notificacoesPedido";
import "./ajudantes"; // prepara o env antes do import dinâmico do service

// Fila em memória e caixa de notificações, sem banco e sem servidor.

const COMPRADOR = "10000000-0000-4000-8000-000000000007";
const TACARATU = "10000000-0000-4000-8000-000000000002";
const VITALINO = "10000000-0000-4000-8000-000000000001";

function pedido(status: PedidoComItens["status"] = "pendente"): PedidoComItens {
  return {
    id: "4a1b2c3d-0000-4000-8000-000000000001",
    compradorId: COMPRADOR,
    compradorNome: "Ana Beatriz",
    dataPedido: "2026-11-19T12:00:00.000Z",
    status,
    valorTotal: 230,
    itens: [
      { id: "i1", pedidoId: "p", produtoId: "x1", quantidade: 2, precoUnitario: 40, produtoNome: "Tapete", produtoTecnica: "Têxtil", artesaoUsuarioId: TACARATU, artesaoNome: "Tacaratu" },
      { id: "i2", pedidoId: "p", produtoId: "x2", quantidade: 1, precoUnitario: 150, produtoNome: "Vaso", produtoTecnica: "Cerâmica", artesaoUsuarioId: VITALINO, artesaoNome: "Vitalino" },
    ],
  };
}

const semLog = { aoFalhar: () => {} };

describe("FilaAssincrona", () => {
  it("enfileirar devolve o job pendente na hora, sem rodar o processador no mesmo tick", async () => {
    const fila = new FilaAssincrona();
    let rodou = false;
    fila.registrar("teste", async () => {
      rodou = true;
    });

    const job = fila.enfileirar("teste", { x: 1 }, { referencia: "ref-1" });
    assert.equal(job.status, "pendente");
    assert.equal(job.tentativas, 0);
    assert.equal(job.referencia, "ref-1");
    assert.equal(rodou, false, "o processador não pode rodar antes de quem enfileirou terminar");

    await fila.aguardarOcioso();
    assert.equal(rodou, true);
    const final = fila.buscar(job.id)!;
    assert.equal(final.status, "concluido");
    assert.equal(final.tentativas, 1);
    assert.ok(final.iniciadoEm && final.concluidoEm);
  });

  it("não bloqueia: com o processador parado no meio, quem enfileira segue e o job fica 'processando'", async () => {
    const fila = new FilaAssincrona();
    let liberar!: () => void;
    const travado = new Promise<void>((ok) => (liberar = ok));
    fila.registrar("lento", () => travado);

    const inicio = performance.now();
    const job = fila.enfileirar("lento", null);
    assert.ok(performance.now() - inicio < 50, "enfileirar não espera o processamento");

    await new Promise((ok) => setImmediate(ok));
    assert.equal(fila.buscar(job.id)!.status, "processando");
    assert.equal(fila.ociosa, false);

    liberar();
    await fila.aguardarOcioso();
    assert.equal(fila.buscar(job.id)!.status, "concluido");
  });

  it("processa na ordem de chegada, um job por vez", async () => {
    const fila = new FilaAssincrona();
    const ordem: number[] = [];
    let emAndamento = 0;
    fila.registrar<number>("n", async (n) => {
      assert.equal(++emAndamento, 1, "dois jobs ao mesmo tempo");
      await new Promise((ok) => setTimeout(ok, 2));
      ordem.push(n);
      emAndamento--;
    });
    for (const n of [1, 2, 3, 4]) fila.enfileirar("n", n);
    await fila.aguardarOcioso();
    assert.deepEqual(ordem, [1, 2, 3, 4]);
  });

  it("falha volta para a fila e conclui numa nova tentativa", async () => {
    const fila = new FilaAssincrona({ atrasoBaseMs: 1, ...semLog });
    let chamadas = 0;
    fila.registrar("instavel", async () => {
      if (++chamadas < 3) throw new Error(`falha ${chamadas}`);
    });
    const job = fila.enfileirar("instavel", null);
    await fila.aguardarOcioso();
    const final = fila.buscar(job.id)!;
    assert.equal(final.status, "concluido");
    assert.equal(final.tentativas, 3);
    assert.equal(final.ultimoErro, null);
  });

  it("esgotadas as tentativas, fica em 'erro' com a mensagem e avisa aoFalhar uma vez", async () => {
    const falhas: string[] = [];
    const fila = new FilaAssincrona({ maxTentativas: 2, atrasoBaseMs: 1, aoFalhar: (job) => falhas.push(job.id) });
    fila.registrar("quebrado", async () => {
      throw new Error("banco fora do ar");
    });
    const job = fila.enfileirar("quebrado", null);
    await fila.aguardarOcioso();
    const final = fila.buscar(job.id)!;
    assert.equal(final.status, "erro");
    assert.equal(final.tentativas, 2);
    assert.equal(final.ultimoErro, "banco fora do ar");
    assert.deepEqual(falhas, [job.id]);
  });

  it("tipo sem processador vai direto para 'erro', sem novas tentativas", async () => {
    const fila = new FilaAssincrona(semLog);
    const job = fila.enfileirar("desconhecido", null);
    await fila.aguardarOcioso();
    assert.equal(fila.buscar(job.id)!.status, "erro");
    assert.equal(fila.buscar(job.id)!.tentativas, 1);
  });

  it("histórico limitado, mais recentes primeiro, filtro por usuário e sem o payload", async () => {
    const fila = new FilaAssincrona({ maxHistorico: 3 });
    fila.registrar("ok", async () => {});
    for (let i = 0; i < 5; i++) fila.enfileirar("ok", { segredo: i }, { referencia: `r${i}`, envolvidos: [i % 2 ? "par" : "impar"] });
    await fila.aguardarOcioso();

    const recentes = fila.jobsRecentes();
    assert.deepEqual(recentes.map((j) => j.referencia), ["r4", "r3", "r2"]);
    assert.deepEqual(fila.contagemPorStatus(), { pendente: 0, processando: 0, concluido: 3, erro: 0 });
    assert.deepEqual(fila.jobsRecentes(10, "par").map((j) => j.referencia), ["r3"]);
    for (const job of recentes) assert.equal("payload" in job, false);
  });

  it("registrar duas vezes o mesmo tipo é erro de programação", () => {
    const fila = new FilaAssincrona();
    fila.registrar("a", async () => {});
    assert.throws(() => fila.registrar("a", async () => {}), /Já existe processador/);
  });
});

describe("CaixaNotificacoes", () => {
  const aviso = (usuarioId: string, chave = "c1") => ({ chave, usuarioId, pedidoId: "p", tipo: "pedido.enviado" as const, mensagem: "m" });

  it("cada usuário vê só as próprias, mais recentes primeiro", () => {
    let relogio = 1_000;
    const caixa = new CaixaNotificacoes({ agora: () => relogio++ });
    caixa.registrar(aviso("a", "1"));
    caixa.registrar(aviso("b", "1"));
    caixa.registrar(aviso("a", "2"));
    const deA = caixa.listar("a");
    assert.equal(deA.total, 2);
    assert.equal(deA.naoLidas, 2);
    assert.ok(deA.dados.every((n) => n.usuarioId === "a"));
    assert.ok(deA.dados[0]!.data > deA.dados[1]!.data);
    assert.equal("chave" in deA.dados[0]!, false);
    assert.deepEqual(caixa.listar("ninguem"), { naoLidas: 0, total: 0, dados: [] });
  });

  it("a mesma chave não entra duas vezes (job repetido)", () => {
    const caixa = new CaixaNotificacoes();
    assert.equal(caixa.registrar(aviso("a")), true);
    assert.equal(caixa.registrar(aviso("a")), false);
    assert.equal(caixa.listar("a").total, 1);
  });

  it("marcar como lidas não toca na caixa de outro usuário, nem com o id dele", () => {
    const caixa = new CaixaNotificacoes();
    caixa.registrar(aviso("a"));
    caixa.registrar(aviso("b"));
    const idDeB = caixa.listar("b").dados[0]!.id;
    assert.equal(caixa.marcarComoLidas("a", [idDeB]), 0);
    assert.equal(caixa.marcarComoLidas("a"), 1);
    assert.equal(caixa.marcarComoLidas("a"), 0);
    assert.equal(caixa.listar("b").naoLidas, 1);
  });

  it("guarda no máximo maxPorUsuario, descartando as mais antigas", () => {
    const caixa = new CaixaNotificacoes({ maxPorUsuario: 2 });
    for (const c of ["1", "2", "3"]) caixa.registrar({ ...aviso("a", c), mensagem: c });
    assert.deepEqual(caixa.listar("a").dados.map((n) => n.mensagem), ["3", "2"]);
  });
});

describe("mensagens dos jobs de pedido", () => {
  it("pedido.criado avisa o comprador e cada artesão só com as peças dele", () => {
    const avisos = notificacoesDoPedidoCriado(pedido());
    assert.deepEqual(avisos.map((a) => [a.usuarioId, a.tipo]), [
      [COMPRADOR, "pedido.recebido"],
      [TACARATU, "pedido.nova_venda"],
      [VITALINO, "pedido.nova_venda"],
    ]);
    assert.match(avisos[0]!.mensagem, /#4A1B2C3D \(R\$ 230,00\)/);
    const tacaratu = avisos[1]!;
    assert.match(tacaratu.mensagem, /Ana Beatriz, 2 peça\(s\), R\$ 80,00/);
    assert.match(tacaratu.resumoWhatsapp!, /^Olá, Ana Beatriz! Aqui é Tacaratu/);
    assert.match(tacaratu.resumoWhatsapp!, /- 2x Tapete \(R\$ 40,00 cada\)/);
    assert.doesNotMatch(tacaratu.resumoWhatsapp!, /Vaso/, "o artesão não vê as peças dos outros");
    assert.equal(avisos[0]!.resumoWhatsapp, undefined);
  });

  it("pedido.status_atualizado avisa o comprador; 'pendente' não gera aviso", () => {
    assert.equal(notificacaoDeStatus(pedido("pendente"), "job-1"), null);
    const enviado = notificacaoDeStatus(pedido("enviado"), "job-1")!;
    assert.equal(enviado.usuarioId, COMPRADOR);
    assert.equal(enviado.tipo, "pedido.enviado");
    assert.match(enviado.mensagem, /enviado pelo artesão/);
    assert.notEqual(enviado.chave, notificacaoDeStatus(pedido("enviado"), "job-2")!.chave);
  });
});

describe("processadores do filaAssincronaService", () => {
  it("pedido.criado: avisos uma vez só, mesmo quando o pré-aquecimento falha e o job repete", async () => {
    const { registrarProcessadores, TIPO_PEDIDO_CRIADO, TIPO_STATUS_ATUALIZADO } = await import(
      "../src/services/filaAssincronaService.js"
    );
    const fila = new FilaAssincrona({ atrasoBaseMs: 1, ...semLog });
    const caixa = new CaixaNotificacoes();
    const preaquecidos: string[] = [];
    registrarProcessadores(fila, {
      caixa,
      preaquecerRecomendacoes: async (compradorId) => {
        preaquecidos.push(compradorId);
        if (preaquecidos.length === 1) throw new Error("timeout no banco");
      },
    });

    const criado = fila.enfileirar(TIPO_PEDIDO_CRIADO, pedido());
    const status = fila.enfileirar(TIPO_STATUS_ATUALIZADO, pedido("enviado"));
    await fila.aguardarOcioso();

    assert.equal(fila.buscar(criado.id)!.status, "concluido");
    assert.equal(fila.buscar(criado.id)!.tentativas, 2);
    assert.deepEqual(preaquecidos, [COMPRADOR, COMPRADOR]);
    assert.deepEqual(caixa.listar(COMPRADOR).dados.map((n) => n.tipo), ["pedido.enviado", "pedido.recebido"]);
    assert.equal(caixa.listar(TACARATU).total, 1);
    assert.equal(caixa.listar(VITALINO).total, 1);
    assert.equal(fila.buscar(status.id)!.status, "concluido");
  });
});
