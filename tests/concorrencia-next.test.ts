import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";

const url = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL = url ?? "";
let pool: Pool;
let pedidos: typeof import("../lib/servidor/pedidos");
let produtos: typeof import("../lib/servidor/produtos");
let comprador: string;
let produto: string;
const dono = "10000000-0000-4000-8000-000000000001";
const artesao = "20000000-0000-4000-8000-000000000001";

describe("proteções do checkout e estoque nos handlers Next", { skip: !url && "defina TEST_DATABASE_URL descartável" }, () => {
  before(async () => {
    pool = new Pool({ connectionString: url });
    pedidos = await import("../lib/servidor/pedidos");
    produtos = await import("../lib/servidor/produtos");
    comprador = randomUUID();
    produto = randomUUID();
    await pool.query(`INSERT INTO origem.usuario (id, nome, email, tipo) VALUES ($1, 'Teste Next', $2, 'comprador')`, [comprador, `${comprador}@teste.invalid`]);
    await pool.query(`INSERT INTO origem.produto (id, artesao_id, nome, tecnica, categoria, descricao, preco, estoque_qtd) VALUES ($1, $2, 'Teste Next', 'Palha', 'Teste', 'Teste', 10, 3)`, [produto, artesao]);
  });
  after(async () => { await pool?.end(); const db = await import("../lib/db"); await db.pool.end(); });

  it("reutiliza o mesmo pedido e rejeita carrinho diferente", async () => {
    const chave = randomUUID();
    const itens = [{ produtoId: produto, quantidade: 1 }];
    const respostas = await Promise.all(Array.from({ length: 5 }, () => pedidos.criarPedido(comprador, itens, chave)));
    assert.equal(new Set(respostas.map((r) => r.id)).size, 1);
    await assert.rejects(pedidos.criarPedido(comprador, [{ produtoId: produto, quantidade: 2 }], chave), { status: 409 });
    const { rows } = await pool.query(`SELECT estoque_qtd FROM origem.produto WHERE id = $1`, [produto]);
    assert.equal(rows[0].estoque_qtd, 2);
  });

  it("não aceita estoque de versão anterior à venda", async () => {
    const sessao = { id: dono, nome: "Artesão", tipo: "artesao" as const, exp: 9999999999 };
    const dados = { nome: "Teste", descricao: "Teste", preco: 10, estoqueQtd: 3, estoqueVersao: "0" };
    await assert.rejects(produtos.editarProduto(produto, dados, sessao), { status: 409 });
    const { rows } = await pool.query(`SELECT estoque_qtd, xmin::text AS versao FROM origem.produto WHERE id = $1`, [produto]);
    assert.equal(rows[0].estoque_qtd, 2);
    const atualizado = await produtos.editarProduto(produto, { ...dados, estoqueQtd: 4, estoqueVersao: rows[0].versao }, sessao);
    assert.equal(atualizado.estoqueQtd, 4);
  });

  it("mantém checkout legado e exige releitura para editar saldo sem versão", async () => {
    const sessao = { id: dono, nome: "Artesão", tipo: "artesao" as const, exp: 9999999999 };
    const comprado = await pedidos.criarPedido(comprador, [{ produtoId: produto, quantidade: 1 }]);
    assert.ok(comprado.id);
    const dados = { nome: "Teste", descricao: "Teste", preco: 10, estoqueQtd: 4 };
    await assert.rejects(produtos.editarProduto(produto, dados, sessao), { status: 409 });
    const semAlterarSaldo = await produtos.editarProduto(produto, { ...dados, estoqueQtd: 3 }, sessao);
    assert.equal(semAlterarSaldo.estoqueQtd, 3);
  });
});
