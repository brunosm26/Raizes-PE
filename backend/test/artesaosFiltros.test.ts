import assert from "node:assert/strict";
import { after, before, describe } from "node:test";
import { TECNICAS } from "../src/types/dominio";
import { compararPtBr, normalizarOpcoes } from "../src/utils/ordenacao";
import { itComBanco, subirApi, USUARIOS, type Api } from "./ajudantes";

// Conteúdo de GET /api/artesaos (só admin) e GET /api/filtros (público) da PI4-143 com o
// banco descartável da carga db/01, 04, 05, 06 e 07. Só leitura: nada é gravado.
// Sessão, perfis, formato e normalização sem banco ficam em artesaosFiltrosSemBanco.test.ts.

interface ArtesaoAdmin {
  id: string;
  usuarioId: string;
  nome: string;
  regiaoOrigem: string;
  tecnicas: string[];
  totalProdutos: number;
  temLogin: boolean;
  dataCadastro: string;
}
interface Perfil {
  nome: string;
  regiaoOrigem: string;
  produtos: { tecnica: string; categoria: string; artesaoUsuarioId: string }[];
}

let api: Api;
before(async () => {
  api = await subirApi();
});
after(() => api?.fechar()); // com --test-name-pattern o after pode rodar antes do before (ver subirApi)

async function listarComoAdmin(): Promise<ArtesaoAdmin[]> {
  const r = await fetch(`${api.url}/artesaos`, { headers: { cookie: await api.cookie(USUARIOS.admin) } });
  assert.equal(r.status, 200);
  return (await r.json()) as ArtesaoAdmin[];
}

describe("GET /artesaos e GET /filtros: com banco", () => {
  itComBanco("comprador e artesão recebem 403 com a sessão revalidada no banco", async () => {
    for (const perfil of ["comprador", "artesao"] as const) {
      const r = await fetch(`${api.url}/artesaos`, { headers: { cookie: await api.cookie(USUARIOS[perfil]) } });
      assert.equal(r.status, 403);
      assert.equal(((await r.json()) as { ok: boolean }).ok, false);
    }
  });

  itComBanco("admin recebe todos os artesãos, em ordem pt-BR, batendo com o perfil público de cada um", async () => {
    const lista = await listarComoAdmin();
    assert.ok(lista.length > 0);
    const nomes = lista.map((a) => a.nome);
    assert.deepEqual(nomes, [...nomes].sort(compararPtBr));

    const usuarios = lista.map((a) => a.usuarioId);
    assert.ok(usuarios.includes(USUARIOS.artesao.id) && usuarios.includes(USUARIOS.outroArtesao.id));
    assert.equal(new Set(lista.map((a) => a.id)).size, lista.length);

    for (const a of lista) {
      assert.match(a.dataCadastro, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(typeof a.temLogin, "boolean");
      const r = await fetch(`${api.url}/artesaos/${a.id}`);
      assert.equal(r.status, 200);
      const perfil = (await r.json()) as Perfil;
      assert.equal(a.nome, perfil.nome);
      assert.equal(a.regiaoOrigem, perfil.regiaoOrigem);
      assert.equal(a.totalProdutos, perfil.produtos.length);
      const tecnicas = [...new Set(perfil.produtos.map((p) => p.tecnica).filter((t) => t?.trim()))].sort(compararPtBr);
      assert.deepEqual(a.tecnicas, tecnicas);
      for (const p of perfil.produtos) assert.equal(p.artesaoUsuarioId, a.usuarioId);
    }
  });

  itComBanco("temLogin é true para o artesão com login de demonstração", async () => {
    const lista = await listarComoAdmin();
    const demo = lista.find((a) => a.usuarioId === USUARIOS.artesao.id);
    assert.equal(demo?.temLogin, true);
  });

  itComBanco("filtros: técnicas do domínio, regiões dos artesãos e categorias dos produtos", async () => {
    const r = await fetch(`${api.url}/filtros`);
    assert.equal(r.status, 200);
    const filtros = (await r.json()) as { tecnicas: string[]; regioes: string[]; categorias: string[] };
    assert.deepEqual(Object.keys(filtros).sort(), ["categorias", "regioes", "tecnicas"]);
    assert.deepEqual(filtros.tecnicas, [...TECNICAS]);

    const produtos = (await (await fetch(`${api.url}/produtos`)).json()) as { categoria: string }[];
    assert.ok(filtros.categorias.length > 0);
    assert.deepEqual(filtros.categorias, normalizarOpcoes(produtos.map((p) => p.categoria)));

    const artesaos = await listarComoAdmin();
    assert.ok(filtros.regioes.length > 0);
    assert.deepEqual(filtros.regioes, normalizarOpcoes(artesaos.map((a) => a.regiaoOrigem)));
  });
});
