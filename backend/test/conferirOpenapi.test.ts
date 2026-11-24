import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { camposNaoDocumentados, CONTAS_DEMO, conferir, exigirHostLocal, lerRotas, type Perfil } from "../scripts/conferir-openapi";

// Testa o próprio conferir-openapi contra um servidor falso (PI4-145): ele precisa reprovar
// uma API que foge da spec, ficar só na leitura e não imprimir valores.

const ID = "30000000-0000-4000-8000-000000000001";
const ARTESAO = "20000000-0000-4000-8000-000000000001";
const SEGREDO = "valor-que-nao-pode-aparecer";
const PRODUTO = {
  id: ID,
  artesaoId: ARTESAO,
  nome: "Vaso",
  descricao: "D",
  tecnica: "Cerâmica",
  categoria: "Vasos",
  preco: 10,
  estoqueQtd: 1,
  statusCuradoria: "aprovado",
  dataCadastro: "2025-05-10",
  artesaoNome: "Artesã",
  artesaoRegiao: "Caruaru",
  artesaoUsuarioId: "10000000-0000-4000-8000-000000000001",
};

let caminhosDaSpec: Record<string, unknown>;
let produtoServido: Record<string, unknown>;
// Perfis que o servidor falso deixa ver o painel, e contas cujo login ele recusa.
let perfisDoPainel: Perfil[];
let loginsRecusados: Set<string>;
const recebidas: { metodo: string; url: string; cookie?: string; bytes: number; corpo: string }[] = [];
const TOKEN = (perfil: string) => `tok-${perfil}-${SEGREDO}`;
const ESTATISTICAS = {
  vendasDoMes: 0,
  vendasDeltaPct: 0,
  pedidosPendentes: 0,
  historicoMensal: Array.from({ length: 6 }, () => ({ mes: "Out", faturamento: 0, pedidos: 0 })),
  vendasPorTecnica: [],
};

function perfilDoCookie(cookie: string | undefined): Perfil | null {
  const perfil = /raizes_sessao=tok-(\w+)-/.exec(cookie ?? "")?.[1];
  return (["comprador", "artesao", "admin"] as const).find((p) => p === perfil) ?? null;
}

function responder(req: IncomingMessage, corpoRecebido: string): { status: number; corpo: unknown; cookie?: string } {
  const [caminho, query = ""] = (req.url ?? "").split("?");
  const metodo = req.method ?? "";
  const naoEncontrado = { status: 404, corpo: { ok: false, erro: "Não encontrado" } };
  if (caminho === "/api-docs.json") return { status: 200, corpo: { paths: caminhosDaSpec } };

  if (metodo === "POST" && caminho === "/api/auth/login") {
    const { email, perfil } = JSON.parse(corpoRecebido) as { email: string; perfil: Perfil };
    if (loginsRecusados.has(email)) return { status: 401, corpo: { ok: false, erro: "E-mail ou senha incorretos." } };
    const usuario = { id: "10000000-0000-4000-8000-000000000009", nome: "Demo", tipo: perfil };
    return { status: 200, corpo: { usuario }, cookie: `raizes_sessao=${TOKEN(perfil)}; Path=/; HttpOnly` };
  }

  const perfil = metodo === "GET" ? perfilDoCookie(req.headers.cookie) : null;
  const protegida =
    (metodo !== "GET" && /^\/api\/(produtos|pedidos|notificacoes)/.test(caminho!)) ||
    caminho === "/api/pedidos" ||
    caminho === "/api/notificacoes" ||
    caminho === "/api/painel/estatisticas" ||
    caminho === "/api/artesaos";
  if (protegida && !perfil) return { status: 401, corpo: { ok: false, erro: "Faça login para continuar." } };
  if (caminho === "/api/pedidos") return { status: 200, corpo: [] };
  if (caminho === "/api/notificacoes") {
    const caixa = { naoLidas: 0, total: 0, dados: [] };
    const fila = { contagem: { pendente: 0, processando: 0, concluido: 0, erro: 0 }, jobsRecentes: [] };
    return { status: 200, corpo: perfil === "admin" ? { ...caixa, fila } : caixa };
  }
  if (caminho === "/api/painel/estatisticas") {
    return perfisDoPainel.includes(perfil!)
      ? { status: 200, corpo: ESTATISTICAS }
      : { status: 403, corpo: { ok: false, erro: "Seu perfil não tem permissão para esta ação." } };
  }
  if (caminho === "/api/artesaos") {
    return perfil === "admin"
      ? { status: 200, corpo: [] }
      : { status: 403, corpo: { ok: false, erro: "Seu perfil não tem permissão para esta ação." } };
  }

  if (caminho === "/api/saude") return { status: 200, corpo: { ok: true } };
  if (caminho === "/api/saude-bd") return { status: 200, corpo: { ok: true, produtos: 1 } };
  if (caminho === "/api/auth/me") {
    return { status: 200, corpo: { usuario: perfil ? { id: "10000000-0000-4000-8000-000000000009", nome: "Demo", tipo: perfil } : null } };
  }
  if (caminho === "/api/filtros") {
    return { status: 200, corpo: { tecnicas: ["Cerâmica"], regioes: ["Caruaru"], categorias: ["Vasos"] } };
  }
  if (caminho === "/api/recomendacoes") {
    const compradorId = perfil === "comprador" ? "10000000-0000-4000-8000-000000000009" : null;
    return { status: 200, corpo: { sucesso: true, origem: "x", compradorId, total: 0, dados: [] } };
  }
  if (caminho === "/api/produtos") {
    const semResultado = query.includes("valor-que-nao-existe") || query.includes("%00");
    return { status: 200, corpo: semResultado ? [] : [produtoServido] };
  }
  if (caminho === `/api/produtos/${ID}`) return { status: 200, corpo: produtoServido };
  if (caminho === `/api/artesaos/${ARTESAO}`) {
    return { status: 200, corpo: { id: ARTESAO, nome: "A", regiaoOrigem: "R", biografia: "B", produtos: [produtoServido] } };
  }
  if (/^\/api\/produtos\/[^/]+\/relacionados$/.test(caminho!)) return { status: 200, corpo: [] };
  if (/^\/api\/produtos\/[^/]+\/avaliacoes$/.test(caminho!)) return { status: 200, corpo: { media: 0, quantidade: 0 } };
  return naoEncontrado;
}

describe("conferir-openapi", () => {
  let servidor: Server;
  let base: string;

  before(async () => {
    const rotas = await lerRotas();
    caminhosDaSpec = Object.fromEntries(rotas.map((r) => [r.caminho, {}]));
    servidor = createServer((req, res) => {
      const pedacos: Buffer[] = [];
      req.on("data", (pedaco: Buffer) => pedacos.push(pedaco));
      req.on("end", () => {
        const corpoRecebido = Buffer.concat(pedacos).toString("utf8");
        recebidas.push({
          metodo: req.method ?? "",
          url: req.url ?? "",
          cookie: req.headers.cookie,
          bytes: corpoRecebido.length,
          corpo: corpoRecebido,
        });
        if (req.url === "/api-docs/") {
          res.setHeader("content-type", "text/html");
          res.end("<html></html>");
          return;
        }
        const { status, corpo, cookie } = responder(req, corpoRecebido);
        if (cookie) res.setHeader("set-cookie", cookie);
        res.statusCode = status;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(corpo));
      });
    });
    await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;
  });
  after(() => new Promise((ok) => servidor.close(ok)));

  async function rodar(
    produto: Record<string, unknown>,
    { comLogin = false, painel = ["artesao", "admin"] as Perfil[], recusar = [] as string[] } = {}
  ) {
    produtoServido = produto;
    perfisDoPainel = painel;
    loginsRecusados = new Set(recusar);
    recebidas.length = 0;
    const linhas: string[] = [];
    const resumo = await conferir(base, (l) => linhas.push(l), comLogin ? CONTAS_DEMO : []);
    return { resumo, saida: linhas.join("\n") };
  }
  const logins = () => recebidas.filter((r) => r.url === "/api/auth/login");

  it("aprova uma API igual à spec", async () => {
    const { resumo, saida } = await rodar(PRODUTO);
    assert.equal(resumo.falhas, 0, saida);
    assert.equal(resumo.divergenciasDeCodigo, 0, saida);
  });

  it("não manda cookie nem corpo, e só sai do GET nas rotas protegidas", async () => {
    await rodar(PRODUTO);
    assert.deepEqual(recebidas.filter((r) => r.cookie !== undefined || r.bytes > 0), []);
    const escritas = recebidas.filter((r) => r.metodo !== "GET").map((r) => `${r.metodo} ${r.url.replace(/\/[0-9a-f-]{36}(?=\/|$)/, "/{id}")}`);
    assert.deepEqual(escritas.sort(), [
      "PATCH /api/pedidos/{id}",
      "PATCH /api/produtos/{id}",
      "PATCH /api/produtos/{id}/curadoria",
      "POST /api/notificacoes/ler",
      "POST /api/pedidos",
      "POST /api/produtos",
    ]);
    assert.equal(recebidas.some((r) => r.url.includes("/auth/login") || r.url.includes("/auth/cadastro")), false);
  });

  it("reprova campo a mais, sem imprimir o valor", async () => {
    const { resumo, saida } = await rodar({ ...PRODUTO, senhaHash: SEGREDO });
    assert.ok(resumo.falhas > 0);
    assert.match(saida, /senhaHash não documentado/);
    assert.equal(saida.includes(SEGREDO), false);
  });

  it("reprova campo obrigatório ausente e valor fora do schema, sem imprimir o valor", async () => {
    const semNome: Record<string, unknown> = { ...PRODUTO, dataCadastro: SEGREDO };
    delete semNome.nome;
    const { resumo, saida } = await rodar(semNome);
    assert.ok(resumo.falhas > 0);
    assert.match(saida, /nome/);
    assert.match(saida, /dataCadastro must match format "date"/);
    assert.equal(saida.includes(SEGREDO), false);
  });

  describe("com login nas contas de demonstração", () => {
    it("aprova uma API igual à spec, com 200 ou 403 conforme o x-perfis", async () => {
      const { resumo, saida } = await rodar(PRODUTO, { comLogin: true });
      assert.equal(resumo.falhas, 0, saida);
      assert.match(saida, /\| GET \/painel\/estatisticas \(com cookie\) \| comprador \| 403 \| OK \|/);
      assert.match(saida, /\| GET \/painel\/estatisticas \(com cookie\) \| artesao \| 200 \| OK \|/);
      assert.match(saida, /\| GET \/pedidos \(com cookie\) \| admin \| 200 \| OK \|/);
    });

    it("entra uma vez por conta e só manda o cookie em GET, sem outras escritas", async () => {
      await rodar(PRODUTO, { comLogin: true });
      assert.deepEqual(logins().map((r) => (JSON.parse(r.corpo) as { email: string }).email).sort(), CONTAS_DEMO.map((c) => c.email).sort());
      assert.deepEqual(recebidas.filter((r) => r.cookie !== undefined && r.metodo !== "GET"), []);
      const escritas = recebidas.filter((r) => r.metodo !== "GET" && r.url !== "/api/auth/login");
      assert.equal(escritas.every((r) => r.cookie === undefined && r.bytes === 0), true);
      assert.equal(escritas.length, 6);
      assert.equal(recebidas.some((r) => r.url.includes("/auth/cadastro") || r.url.includes("/auth/logout")), false);
    });

    it("reprova 200 onde a spec diz 403", async () => {
      const { resumo, saida } = await rodar(PRODUTO, { comLogin: true, painel: ["comprador", "artesao", "admin"] });
      assert.equal(resumo.falhas, 1, saida);
      assert.match(saida, /\| GET \/painel\/estatisticas \(com cookie\) \| comprador \| 200 \| FALHA \| esperava 403 \|/);
    });

    it("não repete login recusado e não imprime cookie, e-mail nem senha", async () => {
      const comprador = CONTAS_DEMO.find((c) => c.perfil === "comprador")!;
      const { resumo, saida } = await rodar(PRODUTO, { comLogin: true, recusar: [comprador.email] });
      assert.equal(resumo.falhas, 1, saida);
      assert.equal(logins().length, CONTAS_DEMO.length);
      assert.equal(recebidas.some((r) => perfilDoCookie(r.cookie) === "comprador"), false);
      for (const proibido of [SEGREDO, "raizes_sessao=", ...CONTAS_DEMO.flatMap((c) => [c.email, c.senha])]) {
        assert.equal(saida.includes(proibido), false, `saída contém ${proibido.slice(0, 4)}…`);
      }
    });
  });

  it("recusa host que não seja local", () => {
    assert.throws(() => exigirHostLocal("https://api.exemplo.com/api"), /só roda contra a API local/);
    assert.doesNotThrow(() => exigirHostLocal("http://localhost:4000/api"));
  });

  it("camposNaoDocumentados entra em allOf e em listas", () => {
    const dados = [{ a: 1, b: 2, c: 3 }, { c: 4 }];
    assert.deepEqual(camposNaoDocumentados({ items: { allOf: [{ properties: { a: {} } }, { properties: { b: {} } }] } }, dados), ["/[]/c"]);
  });
});
