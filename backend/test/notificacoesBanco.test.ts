import assert from "node:assert/strict";
import { after, before, describe } from "node:test";
import { Pool } from "pg";
import { bancoDeTeste, itComBanco, json, PRODUTO_DO_ARTESAO, semBanco, subirApi, USUARIOS, type Api } from "./ajudantes";

// O fluxo da fila assíncrona com banco DESCARTÁVEL (pulado sem TEST_DATABASE_URL): checkout real
// grava o pedido, o worker avisa comprador e artesão, e o "enviado" do artesão chega ao comprador.
// No fim, apaga o pedido criado e devolve o estoque, como o pedidosProdutos.test.ts.

let api: Api;
let fila: typeof import("../src/services/filaAssincronaService.js")["filaAssincrona"];
before(async () => {
  api = await subirApi();
  ({ filaAssincrona: fila } = await import("../src/services/filaAssincronaService.js"));
});
after(() => api?.fechar());

describe("fila assíncrona: com banco", () => {
  const criados: string[] = [];
  let banco: Pool | undefined;
  let estoqueInicial: number | undefined;

  before(async () => {
    if (semBanco) return;
    banco = new Pool({ connectionString: bancoDeTeste });
    const { rows } = await banco.query<{ estoque: number }>("SELECT estoque_qtd AS estoque FROM origem.produto WHERE id = $1", [
      PRODUTO_DO_ARTESAO,
    ]);
    estoqueInicial = rows[0]?.estoque;
  });

  after(async () => {
    if (!banco) return;
    try {
      await banco.query("DELETE FROM origem.pedido WHERE id = ANY($1::uuid[])", [criados]);
      if (estoqueInicial !== undefined) {
        await banco.query("UPDATE origem.produto SET estoque_qtd = $2 WHERE id = $1", [PRODUTO_DO_ARTESAO, estoqueInicial]);
      }
    } finally {
      await banco.end();
    }
  });

  async function caixa(usuario: (typeof USUARIOS)[keyof typeof USUARIOS]) {
    const r = await fetch(`${api.url}/notificacoes`, { headers: { cookie: await api.cookie(usuario) } });
    assert.equal(r.status, 200);
    return (await r.json()) as { dados: { pedidoId: string; tipo: string; resumoWhatsapp?: string }[] };
  }

  itComBanco("checkout real gera avisos em background e o 'enviado' do artesão chega ao comprador", async () => {
    const r = await fetch(`${api.url}/pedidos`, {
      method: "POST",
      ...json({ itens: [{ produtoId: PRODUTO_DO_ARTESAO, quantidade: 1 }] }, await api.cookie(USUARIOS.comprador)),
    });
    assert.equal(r.status, 201);
    const pedido = (await r.json()) as { id: string };
    criados.push(pedido.id);

    await fila.aguardarOcioso();
    const doPedido = (dados: { pedidoId: string; tipo: string }[]) => dados.filter((n) => n.pedidoId === pedido.id).map((n) => n.tipo);
    assert.deepEqual(doPedido((await caixa(USUARIOS.comprador)).dados), ["pedido.recebido"]);
    const venda = (await caixa(USUARIOS.artesao)).dados.find((n) => n.pedidoId === pedido.id);
    assert.equal(venda?.tipo, "pedido.nova_venda");
    assert.match(venda?.resumoWhatsapp ?? "", /Ana Beatriz/);
    assert.equal(doPedido((await caixa(USUARIOS.outroArtesao)).dados).length, 0, "o pedido não tem peça do Vitalino");

    const patch = await fetch(`${api.url}/pedidos/${pedido.id}`, {
      method: "PATCH",
      ...json({ status: "enviado" }, await api.cookie(USUARIOS.artesao)),
    });
    assert.equal(patch.status, 200);
    await fila.aguardarOcioso();
    assert.deepEqual(doPedido((await caixa(USUARIOS.comprador)).dados), ["pedido.enviado", "pedido.recebido"]);

    const jobs = fila.jobsRecentes(10).filter((j) => j.referencia === pedido.id);
    assert.deepEqual(jobs.map((j) => [j.tipo, j.status]), [
      ["pedido.status_atualizado", "concluido"],
      ["pedido.criado", "concluido"],
    ]);
  });
});
