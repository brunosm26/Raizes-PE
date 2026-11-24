import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before } from "node:test";
import { Pool } from "pg";
import type { AtividadeAdmin } from "../src/services/atividadeAdminService";
import { bancoDeTeste, itComBanco, json, subirApi, USUARIOS, type Api } from "./ajudantes";

let api: Api;
before(async () => { api = await subirApi(); });
after(() => api?.fechar());

itComBanco("TC42 persiste atividade, aplica permissões e mantém o histórico de pedidos", async () => {
  const db = new Pool({ connectionString: bancoDeTeste });
  const compradorId = randomUUID();
  const artesaoUsuarioId = randomUUID();
  const artesaoId = randomUUID();
  const produtoId = randomUUID();
  const email = `tc42-${compradorId}@example.test`;
  const admin = await api.cookie(USUARIOS.admin);
  const comprador = await api.cookie({ id: compradorId, nome: "Comprador TC42", tipo: "comprador" });
  const artesao = await api.cookie({ id: artesaoUsuarioId, nome: "Artesão TC42", tipo: "artesao" });
  const atividade = "/admin/atividade";
  const get = (caminho: string, cookie?: string) =>
    fetch(api.url + caminho, { headers: cookie ? { cookie } : undefined });
  const patch = (tipo: "usuarios" | "produtos", id: string, ativo: unknown, cookie?: string) =>
    fetch(`${api.url}${atividade}/${tipo}/${id}`, { method: "PATCH", ...json({ ativo }, cookie) });
  const pedido = () => fetch(`${api.url}/pedidos`, {
    method: "POST", ...json({ itens: [{ produtoId, quantidade: 1 }] }, comprador),
  });

  try {
    const { hashSenha } = await import("../src/utils/senha.js");
    await db.query(
      `INSERT INTO origem.usuario (id, nome, email, tipo, senha_hash) VALUES
       ($1, 'Comprador TC42', $2, 'comprador', $5), ($3, 'Artesão TC42', $4, 'artesao', $5)`,
      [compradorId, email, artesaoUsuarioId, `tc42-${artesaoUsuarioId}@example.test`, await hashSenha("Senha-local-tc42")]
    );
    await db.query("INSERT INTO origem.artesao (id, usuario_id, regiao_origem) VALUES ($1, $2, $3)", [artesaoId, artesaoUsuarioId, "Região TC42"]);
    await db.query(
      "INSERT INTO origem.produto (id, artesao_id, nome, tecnica, categoria, preco, estoque_qtd) VALUES ($1, $2, 'Produto TC42', 'Madeira', 'Categoria TC42', 30, 3)",
      [produtoId, artesaoId]
    );

    const login = () => fetch(`${api.url}/auth/login`, {
      method: "POST", ...json({ email, senha: "Senha-local-tc42" }),
    });
    assert.equal((await login()).status, 200);
    assert.equal((await get(atividade)).status, 401);
    assert.equal((await get(atividade, comprador)).status, 403);
    assert.equal((await patch("produtos", produtoId, false, comprador)).status, 403);
    assert.equal((await patch("usuarios", USUARIOS.admin.id, false, admin)).status, 403);
    assert.equal((await patch("produtos", produtoId, "false", admin)).status, 400);
    assert.equal((await patch("produtos", randomUUID(), false, admin)).status, 404);

    const criado = await pedido();
    assert.equal(criado.status, 201);
    const anterior = (await criado.json()).id;

    assert.equal((await patch("produtos", produtoId, false, admin)).status, 204);
    const listagem: AtividadeAdmin = await (await get(atividade, admin)).json();
    assert.equal(listagem.produtos.find((p) => p.id === produtoId)?.ativo, false);
    assert.equal((await get(`/produtos/${produtoId}`)).status, 404);
    assert.deepEqual(await (await get("/produtos?categoria=Categoria%20TC42")).json(), []);
    assert.equal((await pedido()).status, 409);
    assert.ok((await (await get("/pedidos", comprador)).json()).some((p: { id: string }) => p.id === anterior));

    assert.equal((await patch("produtos", produtoId, true, admin)).status, 204);
    assert.equal((await get(`/produtos/${produtoId}`)).status, 200);
    assert.equal((await patch("usuarios", artesaoUsuarioId, false, admin)).status, 204);
    assert.equal((await get("/pedidos", artesao)).status, 401);
    assert.equal((await get(`/artesaos/${artesaoId}`)).status, 404);
    assert.equal((await get(`/produtos/${produtoId}`)).status, 404);
    assert.equal((await pedido()).status, 409);
    const listaArtesaos = await (await get("/artesaos", admin)).json();
    assert.equal(listaArtesaos.find((a: { id: string }) => a.id === artesaoId)?.ativo, false);

    assert.equal((await patch("usuarios", artesaoUsuarioId, true, admin)).status, 204);
    assert.equal((await get(`/produtos/${produtoId}`)).status, 200);
    assert.equal((await patch("usuarios", compradorId, false, admin)).status, 204);
    assert.equal((await login()).status, 401);
    assert.equal((await get("/pedidos", comprador)).status, 401);
    assert.equal((await patch("usuarios", compradorId, true, admin)).status, 204);
    assert.equal((await login()).status, 200);
    assert.equal((await get("/pedidos", comprador)).status, 200);
  } finally {
    await db.query("DELETE FROM origem.pedido WHERE comprador_id = $1", [compradorId]);
    await db.query("DELETE FROM origem.produto WHERE id = $1", [produtoId]);
    await db.query("DELETE FROM origem.artesao WHERE id = $1", [artesaoId]);
    await db.query("DELETE FROM origem.usuario WHERE id IN ($1, $2)", [compradorId, artesaoUsuarioId]);
    await db.end();
  }
});
