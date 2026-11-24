import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before } from "node:test";
import { itComBanco, json, subirApi, USUARIOS, type Api } from "./ajudantes";

const senha = "qa-artesao-1234";
let api: Api;
before(async () => {
  api = await subirApi();
});
after(() => api?.fechar());

itComBanco("TC03 e TC04: artesão fica pendente até a aprovação persistida pelo administrador", async () => {
  const { obterPool } = await import("../src/config/db.js");
  const email = `artesao-${randomUUID()}@example.test`;
  const conta = { nome: "Artesão em curadoria", email, senha, perfil: "artesao" };
  const admin = await api.cookie(USUARIOS.admin);
  const comprador = await api.cookie(USUARIOS.comprador);
  const listar = async () => {
    const r = await fetch(`${api.url}/artesaos`, { headers: { cookie: await api.cookie(USUARIOS.admin) } });
    assert.equal(r.status, 200);
    return (await r.json()) as { id: string; usuarioId: string; temLogin: boolean; aprovado: boolean }[];
  };
  const login = () => fetch(`${api.url}/auth/login`, {
    method: "POST",
    ...json({ email, senha, perfil: "artesao" }),
  });

  try {
    const cadastro = await fetch(`${api.url}/auth/cadastro`, { method: "POST", ...json(conta) });
    const { usuario } = await cadastro.json() as { usuario?: { id: string; tipo: string } };
    assert.equal(cadastro.status, 201);
    assert.ok(usuario);
    assert.equal(usuario.tipo, "artesao");
    assert.equal(cadastro.headers.get("set-cookie"), null);

    const pendente = (await listar()).find((perfil) => perfil.usuarioId === usuario.id);
    assert.ok(pendente);
    assert.equal(pendente.temLogin, true);
    assert.equal(pendente.aprovado, false);
    const legado = (await listar()).find((perfil) => perfil.usuarioId === USUARIOS.outroArtesao.id);
    assert.ok(legado);
    assert.equal(legado.aprovado, false);

    const bloqueado = await login();
    assert.equal(bloqueado.status, 403);
    assert.equal(bloqueado.headers.get("set-cookie"), null);
    assert.match(((await bloqueado.json()) as { erro: string }).erro, /aguarda aprovação/);

    const aprovacao = `${api.url}/artesaos/${pendente.id}/aprovacao`;
    assert.equal((await fetch(aprovacao, { method: "PATCH" })).status, 401);
    assert.equal((await fetch(aprovacao, { method: "PATCH", headers: { cookie: comprador } })).status, 403);
    assert.equal((await fetch(aprovacao, { method: "PATCH", headers: { cookie: admin } })).status, 204);
    assert.equal((await fetch(aprovacao, { method: "PATCH", headers: { cookie: admin } })).status, 204);
    assert.equal((await listar()).find((perfil) => perfil.id === pendente.id)?.aprovado, true);
    const aprovado = await login();
    assert.equal(aprovado.status, 200);
    assert.match(aprovado.headers.get("set-cookie") ?? "", /^raizes_sessao=/);
  } finally {
    const pool = obterPool();
    await pool.query("DELETE FROM origem.artesao WHERE usuario_id IN (SELECT id FROM origem.usuario WHERE email = $1)", [email]);
    await pool.query("DELETE FROM origem.usuario WHERE email = $1", [email]);
  }
});

itComBanco("TC03: o cadastro público recusa o perfil administrativo sem criar uma conta", async () => {
  const { obterPool } = await import("../src/config/db.js");
  const email = `admin-${randomUUID()}@example.test`;
  for (const campo of [{ perfil: "admin" }, { tipo: "admin" }]) {
    const cadastro = await fetch(`${api.url}/auth/cadastro`, {
      method: "POST",
      ...json({ nome: "Cadastro inválido", email, senha, ...campo }),
    });
    assert.equal(cadastro.status, 400);
    assert.equal(cadastro.headers.get("set-cookie"), null);
  }
  const resultado = await obterPool().query("SELECT id FROM origem.usuario WHERE email = $1", [email]);
  assert.equal(resultado.rowCount, 0);
});
