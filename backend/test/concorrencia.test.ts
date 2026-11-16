import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { bancoDeTeste, json, semBanco, subirApi, USUARIOS, type Api } from "./ajudantes";

// Os dados criados aqui ficam no banco descartável para permitir auditoria posterior.
let api: Api;
let pool: Pool;
let cookie: string;
const artesaoId = "20000000-0000-4000-8000-000000000001";

async function produto(estoque: number): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO origem.produto (id, artesao_id, nome, tecnica, categoria, preco, estoque_qtd)
     VALUES ($1, $2, 'Teste de concorrência', 'Palha', 'Teste', 10, $3)`,
    [id, artesaoId, estoque]
  );
  return id;
}

async function comprar(itens: { produtoId: string; quantidade: number }[], chave: string = randomUUID()) {
  const opcoes = json({ itens }, cookie);
  const resposta = await fetch(`${api.url}/pedidos`, { method: "POST", ...opcoes, headers: { ...opcoes.headers, "Idempotency-Key": chave } });
  return { status: resposta.status, corpo: await resposta.json() };
}

async function estado(ids: string[]) {
  const estoques = await pool.query<{ id: string; estoque: number }>(
    `SELECT id, estoque_qtd AS estoque FROM origem.produto WHERE id = ANY($1::uuid[]) ORDER BY id`, [ids]
  );
  const itens = await pool.query<{ produtoId: string; quantidade: number; pedidoId: string }>(
    `SELECT produto_id AS "produtoId", quantidade, pedido_id AS "pedidoId"
       FROM origem.item_pedido WHERE produto_id = ANY($1::uuid[]) ORDER BY pedido_id, produto_id`, [ids]
  );
  return { estoques: estoques.rows, itens: itens.rows };
}

describe("checkout concorrente com PostgreSQL descartável", { skip: semBanco }, () => {
  before(async () => {
    pool = new Pool({ connectionString: bancoDeTeste });
    api = await subirApi();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO origem.usuario (id, nome, email, tipo) VALUES ($1, 'Comprador de teste', $2, 'comprador')`,
      [id, `${id}@teste.invalid`]
    );
    cookie = await api.cookie({ id, nome: "Comprador de teste", tipo: "comprador" });
  });
  after(async () => { await api?.fechar(); await pool?.end(); });

  it("uma unidade disputada por dez requisições gera apenas um pedido", async () => {
    const id = await produto(1);
    const respostas = await Promise.all(Array.from({ length: 10 }, () => comprar([{ produtoId: id, quantidade: 1 }])));
    const dados = await estado([id]);
    const status = respostas.map((r) => r.status).sort();
    assert.deepEqual(status, [201, ...Array(9).fill(409)]);
    assert.equal(dados.estoques[0]?.estoque, 0);
    assert.equal(dados.itens.length, 1);
    assert.equal(dados.itens[0]?.quantidade, 1);
    assert.equal(dados.itens[0]?.pedidoId, respostas.find((r) => r.status === 201)?.corpo.id);
    console.log("EVIDENCIA ultimo-item", JSON.stringify({ estoqueInicial: 1, status, ...dados }));
  });

  it("reconcilia estoque e itens quando a demanda ultrapassa o saldo", async () => {
    const id = await produto(7);
    const respostas = await Promise.all(Array.from({ length: 10 }, () => comprar([{ produtoId: id, quantidade: 2 }])));
    const dados = await estado([id]);
    const status = respostas.map((r) => r.status).sort();
    assert.deepEqual(status, [...Array(3).fill(201), ...Array(7).fill(409)]);
    assert.equal(dados.itens.reduce((s, i) => s + i.quantidade, 0), 6);
    assert.equal(dados.estoques[0]?.estoque, 1);
    assert.equal(new Set(dados.itens.map((i) => i.pedidoId)).size, 3);
    console.log("EVIDENCIA demanda-excedente", JSON.stringify({ estoqueInicial: 7, status, ...dados }));
  });

  it("não persiste pedido nem baixa parcial quando um item está esgotado", async () => {
    const disponivel = await produto(3);
    const esgotado = await produto(0);
    const respostas = await Promise.all(Array.from({ length: 5 }, () => comprar([
      { produtoId: disponivel, quantidade: 1 }, { produtoId: esgotado, quantidade: 1 },
    ])));
    const dados = await estado([disponivel, esgotado]);
    assert.ok(respostas.every((r) => r.status === 409));
    assert.equal(dados.estoques.find((p) => p.id === disponivel)?.estoque, 3);
    assert.equal(dados.estoques.find((p) => p.id === esgotado)?.estoque, 0);
    assert.equal(dados.itens.length, 0);
    console.log("EVIDENCIA rollback-carrinho", JSON.stringify({ disponivel, esgotado, status: respostas.map((r) => r.status), ...dados }));
  });

  it("carrinhos em ordens inversas concluem sem impasse nem venda excessiva", async () => {
    const a = await produto(2);
    const b = await produto(2);
    const respostas = await Promise.all(Array.from({ length: 6 }, (_, i) => comprar(
      (i % 2 ? [a, b] : [b, a]).map((produtoId) => ({ produtoId, quantidade: 1 }))
    )));
    const dados = await estado([a, b]);
    const status = respostas.map((r) => r.status).sort();
    assert.deepEqual(status, [201, 201, 409, 409, 409, 409]);
    assert.ok(dados.estoques.every((p) => p.estoque === 0));
    assert.equal(dados.itens.length, 4);
    assert.equal(new Set(dados.itens.map((i) => i.pedidoId)).size, 2);
    console.log("EVIDENCIA ordem-inversa", JSON.stringify({ estoqueInicialPorProduto: 2, status, ...dados }));
  });

  it("repetições simultâneas com a mesma chave criam um único pedido", async () => {
    const id = await produto(3);
    const chave = randomUUID();
    const respostas = await Promise.all(Array.from({ length: 10 }, () => comprar([{ produtoId: id, quantidade: 1 }], chave)));
    assert.ok(respostas.every((r) => r.status === 201));
    assert.equal(new Set(respostas.map((r) => r.corpo.id)).size, 1);
    assert.deepEqual(await comprar([{ produtoId: id, quantidade: 1 }], chave), respostas[0]);
    assert.equal((await comprar([{ produtoId: id, quantidade: 2 }], chave)).status, 409);
    const dados = await estado([id]);
    assert.equal(dados.estoques[0]?.estoque, 2);
    assert.equal(dados.itens.length, 1);
    console.log("EVIDENCIA idempotencia", JSON.stringify({ estoqueInicial: 3, status: respostas.map((r) => r.status), ...dados }));
  });

  it("chave inválida é rejeitada e falha de estoque não consome a chave", async () => {
    const id = await produto(0);
    const itens = [{ produtoId: id, quantidade: 1 }];
    assert.equal((await comprar(itens, "invalida")).status, 400);
    const chave = randomUUID();
    assert.equal((await comprar(itens, chave)).status, 409);
    await pool.query(`UPDATE origem.produto SET estoque_qtd = 1 WHERE id = $1`, [id]);
    const sucesso = await comprar(itens, chave);
    assert.equal(sucesso.status, 201);
    assert.equal((await comprar(itens, chave)).corpo.id, sucesso.corpo.id);
  });

  it("chave de um comprador não revela nem reutiliza o pedido de outro", async () => {
    const id = await produto(2);
    const chave = randomUUID();
    const primeiro = await comprar([{ produtoId: id, quantidade: 1 }], chave);
    const outroId = randomUUID();
    await pool.query(`INSERT INTO origem.usuario (id, nome, email, tipo) VALUES ($1, 'Outro comprador', $2, 'comprador')`, [outroId, `${outroId}@teste.invalid`]);
    const outroCookie = await api.cookie({ id: outroId, nome: "Outro comprador", tipo: "comprador" });
    const opcoes = json({ itens: [{ produtoId: id, quantidade: 1 }] }, outroCookie);
    const resposta = await fetch(`${api.url}/pedidos`, { method: "POST", ...opcoes, headers: { ...opcoes.headers, "Idempotency-Key": chave } });
    assert.equal(resposta.status, 201);
    assert.notEqual((await resposta.json()).id, primeiro.corpo.id);
    assert.equal((await estado([id])).estoques[0]?.estoque, 0);
  });

  it("rejeita edição desatualizada depois de venda e aceita após releitura", async () => {
    const id = await produto(3);
    const artesao = await api.cookie(USUARIOS.outroArtesao);
    const versao = (await (await fetch(`${api.url}/produtos/${id}`)).json()).estoqueVersao;
    assert.equal((await comprar([{ produtoId: id, quantidade: 1 }])).status, 201);
    const dados = { nome: "Peça editada", descricao: "Teste", preco: 10, estoqueQtd: 3, estoqueVersao: versao };
    const atrasado = await fetch(`${api.url}/produtos/${id}`, { method: "PATCH", ...json(dados, artesao) });
    assert.equal(atrasado.status, 409);
    const atual = await (await fetch(`${api.url}/produtos/${id}`)).json();
    assert.equal(atual.estoqueQtd, 2);
    assert.notEqual(atual.estoqueVersao, versao);
    const aceito = await fetch(`${api.url}/produtos/${id}`, { method: "PATCH", ...json({ ...dados, estoqueQtd: 4, estoqueVersao: atual.estoqueVersao }, artesao) });
    assert.equal(aceito.status, 200);
    const editado = await aceito.json();
    assert.equal(editado.estoqueQtd, 4);
    assert.notEqual(editado.estoqueVersao, atual.estoqueVersao);
    console.log("EVIDENCIA edicao-conflitante", JSON.stringify({ estoqueInicial: 3, aposVenda: atual.estoqueQtd, statusAtrasado: atrasado.status, statusAtual: aceito.status, estoqueFinal: editado.estoqueQtd }));
  });

  it("duas edições concorrentes da mesma versão não sobrescrevem o estoque", async () => {
    const id = await produto(3);
    const artesao = await api.cookie(USUARIOS.outroArtesao);
    const atual = await (await fetch(`${api.url}/produtos/${id}`)).json();
    const resposta = await Promise.all([4, 5].map((estoqueQtd) => fetch(`${api.url}/produtos/${id}`, {
      method: "PATCH", ...json({ nome: "Teste", descricao: "Teste", preco: 10, estoqueQtd, estoqueVersao: atual.estoqueVersao }, artesao),
    })));
    assert.deepEqual(resposta.map((r) => r.status).sort(), [200, 409]);
    const produtoFinal = await (await fetch(`${api.url}/produtos/${id}`)).json();
    assert.ok([4, 5].includes(produtoFinal.estoqueQtd));
  });

  it("detecta alteração mesmo quando estoque retorna ao valor anterior", async () => {
    const id = await produto(3);
    const artesao = await api.cookie(USUARIOS.outroArtesao);
    const antigo = await (await fetch(`${api.url}/produtos/${id}`)).json();
    assert.equal((await comprar([{ produtoId: id, quantidade: 1 }])).status, 201);
    await pool.query(`UPDATE origem.produto SET estoque_qtd = 3 WHERE id = $1`, [id]);
    const resposta = await fetch(`${api.url}/produtos/${id}`, {
      method: "PATCH", ...json({ nome: "Teste", descricao: "Teste", preco: 10, estoqueQtd: 4, estoqueVersao: antigo.estoqueVersao }, artesao),
    });
    assert.equal(resposta.status, 409);
    assert.equal((await estado([id])).estoques[0]?.estoque, 3);
  });

  it("catálogo e recomendação funcionam no schema original, sem script 08", async () => {
    const schema = await pool.query(`SELECT
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='origem' AND table_name='produto' AND column_name='estoque_versao') AS coluna_adicional,
      to_regclass('origem.checkout_idempotencia') IS NOT NULL AS tabela_adicional`);
    assert.deepEqual(schema.rows[0], { coluna_adicional: false, tabela_adicional: false });
    const catalogo = await fetch(`${api.url}/produtos`);
    assert.equal(catalogo.status, 200);
    const lista = await catalogo.json();
    assert.ok(lista.length > 0 && lista.every((p: { estoqueVersao: string }) => /^\d+$/.test(p.estoqueVersao)));
    const recomendacoes = await fetch(`${api.url}/recomendacoes?limite=2`);
    assert.equal(recomendacoes.status, 200);
    assert.equal((await recomendacoes.json()).origem, "baseline_ia_v1");
    console.log("EVIDENCIA schema-original", JSON.stringify({ ...schema.rows[0], catalogo: catalogo.status, recomendacoes: recomendacoes.status }));
  });

  it("checkout antigo sem chave continua transacional sob concorrência", async () => {
    const id = await produto(1);
    const respostas = await Promise.all(Array.from({ length: 5 }, () => fetch(`${api.url}/pedidos`, {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ itens: [{ produtoId: id, quantidade: 1 }] }),
    })));
    assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 409, 409, 409, 409]);
    const dados = await estado([id]);
    assert.equal(dados.estoques[0]?.estoque, 0);
    assert.equal(dados.itens.length, 1);
    console.log("EVIDENCIA cliente-antigo-checkout", JSON.stringify({ status: respostas.map((r) => r.status), ...dados }));
  });

  it("edição antiga só preserva saldo e pede atualização para alterá-lo", async () => {
    const id = await produto(3);
    const artesao = await api.cookie(USUARIOS.outroArtesao);
    const corpo = { nome: "Nome revisado", descricao: "Teste", preco: 10, estoqueQtd: 3 };
    const semAlterarSaldo = await fetch(`${api.url}/produtos/${id}`, { method: "PATCH", ...json(corpo, artesao) });
    assert.equal(semAlterarSaldo.status, 200);
    assert.equal((await comprar([{ produtoId: id, quantidade: 1 }])).status, 201);
    const antigo = await fetch(`${api.url}/produtos/${id}`, { method: "PATCH", ...json(corpo, artesao) });
    assert.equal(antigo.status, 409);
    assert.match((await antigo.json()).erro, /Recarregue a página/);
    const atual = await (await fetch(`${api.url}/produtos/${id}`)).json();
    assert.equal(atual.estoqueQtd, 2);
    const revisado = await fetch(`${api.url}/produtos/${id}`, { method: "PATCH", ...json({ ...corpo, estoqueVersao: atual.estoqueVersao }, artesao) });
    assert.equal(revisado.status, 200);
    assert.equal((await revisado.json()).estoqueQtd, 3);
    console.log("EVIDENCIA cliente-antigo-edicao", JSON.stringify({ preservarSaldo: semAlterarSaldo.status, conflito: antigo.status, aposReleitura: revisado.status }));
  });

  it("retry equivale a itens agrupados e consulta o mesmo pedido após mudança de status", async () => {
    const id = await produto(4);
    const chave = randomUUID();
    const primeiro = await comprar([{ produtoId: id, quantidade: 1 }, { produtoId: id, quantidade: 1 }], chave);
    assert.equal(primeiro.status, 201);
    await pool.query(`UPDATE origem.pedido SET status = 'pago' WHERE id = $1`, [primeiro.corpo.id]);
    const retry = await comprar([{ produtoId: id.toUpperCase(), quantidade: 2 }], chave.toUpperCase());
    assert.equal(retry.status, 201);
    assert.equal(retry.corpo.id, primeiro.corpo.id);
    assert.equal(retry.corpo.status, "pago");
    assert.equal((await estado([id])).estoques[0]?.estoque, 2);
  });
});
