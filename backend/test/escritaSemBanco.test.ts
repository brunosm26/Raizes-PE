import assert from "node:assert/strict";
import Module from "node:module";
import { after, before, describe, it } from "node:test";
import { cookieFormatoAntigo, json, subirApi, USUARIOS, type Api } from "./ajudantes";

// Rotas de escrita e do painel (PI4-131) SEM banco. O exigirSessao revalida o usuário no
// banco a cada requisição; aqui só o buscarNomeETipo do usuarioRepository é trocado por um
// dublê em memória (o resto do módulo é o real), para provar sessão, perfil e validação de
// entrada, que acontecem antes de qualquer SQL.
// O que grava (pedido, produto, dono) fica em pedidosProdutos.test.ts, com banco descartável.

const SEM_CONTA = { id: "10000000-0000-4000-8000-0000000000ff", nome: "Removido", tipo: "comprador" } as const;
const PERFIL_TROCADO = { id: "10000000-0000-4000-8000-0000000000fe", nome: "Ex-comprador", tipo: "comprador" } as const;

// O import é dinâmico, como no subirApi: o repository carrega o config/env, que só pode ser
// lido depois de o ajudantes preparar o ambiente de teste.
async function instalarDubleDeUsuarios(): Promise<void> {
  const caminho = require.resolve("../src/repositories/usuarioRepository");
  const real = await import("../src/repositories/usuarioRepository.js");
  const duble = new Module(caminho);
  duble.filename = caminho;
  duble.loaded = true;
  duble.exports = {
    ...real,
    async buscarNomeETipo(id: string) {
      if (id === PERFIL_TROCADO.id) return { nome: PERFIL_TROCADO.nome, tipo: "artesao" };
      const u = Object.values(USUARIOS).find((x) => x.id === id);
      return u ? { nome: u.nome, tipo: u.tipo } : null;
    },
  };
  require.cache[caminho] = duble;
}

const PRODUTO = "30000000-0000-4000-8000-000000000002";
const PEDIDO = "40000000-0000-4000-8000-000000000001";

// As seis rotas de escrita e do painel, com um corpo válido para cada uma.
const ROTAS = {
  listarPedidos: { nome: "GET /pedidos", metodo: "GET", caminho: "/pedidos" },
  criarPedido: { nome: "POST /pedidos", metodo: "POST", caminho: "/pedidos", corpo: { itens: [{ produtoId: PRODUTO, quantidade: 1 }] } },
  atualizarPedido: { nome: "PATCH /pedidos/:id", metodo: "PATCH", caminho: `/pedidos/${PEDIDO}`, corpo: { status: "enviado" } },
  criarProduto: {
    nome: "POST /produtos",
    metodo: "POST",
    caminho: "/produtos",
    corpo: { nome: "Vaso", descricao: "D", tecnica: "Cerâmica", categoria: "Casa", preco: 10, estoqueQtd: 1 },
  },
  editarProduto: {
    nome: "PATCH /produtos/:id",
    metodo: "PATCH",
    caminho: `/produtos/${PRODUTO}`,
    corpo: { nome: "V", descricao: "D", preco: 10, estoqueQtd: 1 },
  },
  painel: { nome: "GET /painel/estatisticas", metodo: "GET", caminho: "/painel/estatisticas" },
} as const;

type Rota = (typeof ROTAS)[keyof typeof ROTAS];

let api: Api;
before(async () => {
  await instalarDubleDeUsuarios();
  api = await subirApi();
});
after(() => api?.fechar()); // com --test-name-pattern o after pode rodar antes do before (ver subirApi)

async function chamar(rota: Rota, cookie?: string, corpo?: unknown) {
  const enviado = corpo ?? ("corpo" in rota ? rota.corpo : undefined);
  const init: RequestInit =
    enviado === undefined
      ? { method: rota.metodo, headers: cookie ? { cookie } : {} }
      : { method: rota.metodo, ...json(enviado, cookie) };
  const r = await fetch(`${api.url}${rota.caminho}`, init);
  return { status: r.status, corpo: await r.json() };
}

async function esperarErro(p: ReturnType<typeof chamar>, status: number, erro?: string | RegExp) {
  const r = await p;
  assert.equal(r.status, status);
  assert.equal(r.corpo.ok, false);
  assert.equal(typeof r.corpo.erro, "string");
  if (typeof erro === "string") assert.equal(r.corpo.erro, erro);
  else if (erro) assert.match(r.corpo.erro, erro);
}

describe("escrita e painel: sessão obrigatória (401)", () => {
  // GET /pedidos e o painel sem cookie, e GET /pedidos com cookie antigo, já são testados
  // em pedidosProdutos, catalogoAuthPainel e tokenSessao.
  for (const rota of [ROTAS.criarPedido, ROTAS.atualizarPedido, ROTAS.criarProduto, ROTAS.editarProduto]) {
    it(`${rota.nome} sem cookie e com cookie no formato antigo responde 401`, async () => {
      await esperarErro(chamar(rota), 401, "Faça login para continuar.");
      await esperarErro(chamar(rota, cookieFormatoAntigo()), 401, "Faça login para continuar.");
    });
  }

  it("GET /painel/estatisticas com cookie no formato antigo responde 401", async () => {
    await esperarErro(chamar(ROTAS.painel, cookieFormatoAntigo()), 401, "Faça login para continuar.");
  });

  it("sessão de conta que não existe mais, ou cujo perfil mudou, responde 401 (revalidação)", async () => {
    await esperarErro(chamar(ROTAS.painel, await api.cookie(SEM_CONTA)), 401);
    await esperarErro(chamar(ROTAS.listarPedidos, await api.cookie(PERFIL_TROCADO)), 401);
  });
});

describe("escrita e painel: perfil certo (403)", () => {
  const casos: [keyof typeof ROTAS, keyof typeof USUARIOS][] = [
    ["criarPedido", "artesao"], // só comprador
    ["criarPedido", "admin"],
    ["atualizarPedido", "comprador"], // artesão ou admin
    ["criarProduto", "comprador"], // só artesão
    ["criarProduto", "admin"],
    ["editarProduto", "comprador"], // artesão ou admin
    ["painel", "comprador"], // artesão ou admin
  ];
  for (const [chave, perfil] of casos) {
    it(`${ROTAS[chave].nome} com ${perfil} responde 403`, async () => {
      await esperarErro(chamar(ROTAS[chave], await api.cookie(USUARIOS[perfil])), 403, "Seu perfil não tem permissão para esta ação.");
    });
  }

  it("artesão só pode marcar pedido como enviado (403 para outro status, antes do banco)", async () => {
    await esperarErro(
      chamar(ROTAS.atualizarPedido, await api.cookie(USUARIOS.artesao), { status: "pago" }),
      403,
      "Seu perfil não pode alterar o pedido para este status."
    );
  });
});

describe("escrita: validação de entrada (400, antes do banco)", () => {
  it("pedido: itens vazios, produto inválido e quantidade fora de 1 a 99 ou não inteira", async () => {
    const comprador = await api.cookie(USUARIOS.comprador);
    const pedido = (itens: unknown) => chamar(ROTAS.criarPedido, comprador, { itens });
    await esperarErro(pedido([]), 400, "O pedido precisa ter ao menos um item.");
    await esperarErro(pedido("x"), 400, "O pedido precisa ter ao menos um item.");
    await esperarErro(pedido([{ produtoId: "nao-existe", quantidade: 1 }]), 400, "Produto inválido no pedido.");
    for (const quantidade of [0, -1, 100, 1.5, "abc", null]) {
      await esperarErro(pedido([{ produtoId: PRODUTO, quantidade }]), 400, "Quantidade inválida no pedido.");
    }
  });

  it("status de pedido inválido responde 400", async () => {
    await esperarErro(chamar(ROTAS.atualizarPedido, await api.cookie(USUARIOS.admin), { status: "cancelado" }), 400, "Status inválido.");
  });

  it("produto: nome, descrição, preço, estoque, técnica e categoria", async () => {
    const artesao = await api.cookie(USUARIOS.artesao);
    const base = ROTAS.criarProduto.corpo;
    const criar = (mudanca: Record<string, unknown>) => chamar(ROTAS.criarProduto, artesao, { ...base, ...mudanca });
    await esperarErro(criar({ nome: "" }), 400, /nome/);
    await esperarErro(criar({ nome: "x".repeat(151) }), 400, /nome/);
    await esperarErro(criar({ descricao: " " }), 400, /descrição/);
    await esperarErro(criar({ preco: 0 }), 400, "Informe um preço válido.");
    await esperarErro(criar({ preco: "abc" }), 400, "Informe um preço válido.");
    await esperarErro(criar({ estoqueQtd: -1 }), 400, "Informe um estoque válido.");
    await esperarErro(criar({ estoqueQtd: 1.5 }), 400, "Informe um estoque válido.");
    await esperarErro(criar({ tecnica: "Plástico" }), 400, "Escolha uma técnica válida.");
    await esperarErro(criar({ categoria: "" }), 400, "Informe uma categoria.");
    await esperarErro(chamar(ROTAS.editarProduto, artesao, { nome: "V", descricao: "D", preco: -5, estoqueQtd: 1 }), 400, "Informe um preço válido.");
  });

  it("foto: formato inválido e data URL acima de ~2 MB respondem 400; corpo acima de 4 MB responde 413", async () => {
    const artesao = await api.cookie(USUARIOS.artesao);
    const rota = ROTAS.criarProduto;
    const base = rota.corpo;
    await esperarErro(chamar(rota, artesao, { ...base, imagemUrl: "javascript:alert(1)" }), 400, "Formato de imagem inválido.");
    const grande = `data:image/png;base64,${"A".repeat(2_800_000)}`;
    await esperarErro(chamar(rota, artesao, { ...base, imagemUrl: grande }), 400, "A imagem precisa ter até 2MB.");
    const gigante = `data:image/png;base64,${"A".repeat(4_300_000)}`;
    await esperarErro(chamar(rota, artesao, { ...base, imagemUrl: gigante }), 413, "Corpo da requisição grande demais.");
  });
});
