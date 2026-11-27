import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { itComBanco, subirApi, USUARIOS, type Api } from "./ajudantes";
import type { PedidoComItens } from "../src/types/dominio";

let api: Api;
before(async () => { api = await subirApi(); });
after(() => api?.fechar());

async function consultar(query: string, usuario: typeof USUARIOS.admin | typeof USUARIOS.comprador | typeof USUARIOS.artesao) {
  const cookie = await api.cookie(usuario);
  return fetch(api.url + "/pedidos" + query, { headers: { cookie } });
}

describe("filtro administrativo por data do pedido", () => {
  it("exige sessão para consultas com período", async () => {
    assert.equal((await fetch(api.url + "/pedidos?inicio=2026-01-01")).status, 401);
  });

  itComBanco("restringe os filtros à sessão administrativa", async () => {
    for (const usuario of [USUARIOS.comprador, USUARIOS.artesao]) {
      assert.equal((await consultar("?inicio=2026-01-01", usuario)).status, 403);
    }
  });

  itComBanco("rejeita data inexistente, valor duplicado e intervalo invertido", async () => {
    for (const query of [
      "?inicio=2026-02-29",
      "?fim=2026-02-31",
      "?inicio=2026-01-01&inicio=2026-01-02",
      "?inicio=2026-01-02&fim=2026-01-01",
      "?inicio=",
    ]) {
      assert.equal((await consultar(query, USUARIOS.admin)).status, 400, query);
    }
  });

  itComBanco("aplica ambos os limites inclusivos e aceita limites avulsos", async () => {
    async function listar(query: string): Promise<PedidoComItens[]> {
      const resposta = await consultar(query, USUARIOS.admin);
      assert.equal(resposta.status, 200);
      return resposta.json();
    }
    const pedidos = await listar("");
    const datas = [...new Set(pedidos.map((pedido) => pedido.dataPedido))].sort();
    const [primeira, segunda] = datas;
    assert.ok(primeira && segunda, "A carga deve ter pedidos de pelo menos duas datas.");
    assert.deepEqual(await listar(`?inicio=${primeira}&fim=${primeira}`), pedidos.filter((p) => p.dataPedido === primeira));
    assert.deepEqual(await listar(`?inicio=${segunda}`), pedidos.filter((p) => p.dataPedido >= segunda));
    assert.deepEqual(await listar(`?fim=${primeira}`), pedidos.filter((p) => p.dataPedido <= primeira));
    assert.deepEqual(await listar("?inicio=9999-01-01"), []);
  });
});
