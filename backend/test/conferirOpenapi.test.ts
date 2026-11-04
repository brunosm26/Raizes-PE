import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { camposNaoDocumentados, conferir, exigirHostLocal, lerRotas } from "../scripts/conferir-openapi";

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
  dataCadastro: "2025-05-10",
  artesaoNome: "Artesã",
  artesaoRegiao: "Caruaru",
  artesaoUsuarioId: "10000000-0000-4000-8000-000000000001",
};

let caminhosDaSpec: Record<string, unknown>;
let produtoServido: Record<string, unknown>;
const recebidas: { metodo: string; url: string; cookie?: string; bytes: number }[] = [];

function responder(req: IncomingMessage): { status: number; corpo: unknown } {
  const [caminho, query = ""] = (req.url ?? "").split("?");
  const metodo = req.method ?? "";
  const naoEncontrado = { status: 404, corpo: { ok: false, erro: "Não encontrado" } };
  if (caminho === "/api-docs.json") return { status: 200, corpo: { paths: caminhosDaSpec } };

  const protegida =
    (metodo !== "GET" && /^\/api\/(produtos|pedidos)/.test(caminho!)) ||
    caminho === "/api/pedidos" ||
    caminho === "/api/painel/estatisticas";
  if (protegida) return { status: 401, corpo: { ok: false, erro: "Faça login para continuar." } };

  if (caminho === "/api/saude") return { status: 200, corpo: { ok: true } };
  if (caminho === "/api/saude-bd") return { status: 200, corpo: { ok: true, produtos: 1 } };
  if (caminho === "/api/auth/me") return { status: 200, corpo: { usuario: null } };
  if (caminho === "/api/recomendacoes") {
    return { status: 200, corpo: { sucesso: true, origem: "x", compradorId: null, total: 0, dados: [] } };
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
      let bytes = 0;
      req.on("data", (pedaco: Buffer) => (bytes += pedaco.length));
      req.on("end", () => {
        recebidas.push({ metodo: req.method ?? "", url: req.url ?? "", cookie: req.headers.cookie, bytes });
        if (req.url === "/api-docs/") {
          res.setHeader("content-type", "text/html");
          res.end("<html></html>");
          return;
        }
        const { status, corpo } = responder(req);
        res.statusCode = status;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(corpo));
      });
    });
    await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api`;
  });
  after(() => new Promise((ok) => servidor.close(ok)));

  async function rodar(produto: Record<string, unknown>) {
    produtoServido = produto;
    recebidas.length = 0;
    const linhas: string[] = [];
    const resumo = await conferir(base, (l) => linhas.push(l));
    return { resumo, saida: linhas.join("\n") };
  }

  it("aprova uma API igual à spec", async () => {
    const { resumo, saida } = await rodar(PRODUTO);
    assert.equal(resumo.falhas, 0, saida);
    assert.equal(resumo.divergenciasDeCodigo, 0, saida);
  });

  it("não manda cookie nem corpo, e só sai do GET nas rotas protegidas", async () => {
    await rodar(PRODUTO);
    assert.deepEqual(recebidas.filter((r) => r.cookie !== undefined || r.bytes > 0), []);
    const escritas = recebidas.filter((r) => r.metodo !== "GET").map((r) => `${r.metodo} ${r.url.replace(/\/[0-9a-f-]{36}$/, "/{id}")}`);
    assert.deepEqual(escritas.sort(), ["PATCH /api/pedidos/{id}", "PATCH /api/produtos/{id}", "POST /api/pedidos", "POST /api/produtos"]);
    assert.equal(recebidas.some((r) => r.url.includes("/auth/login") || r.url.includes("/auth/cadastro")), false);
  });

  it("reprova campo a mais, sem imprimir o valor", async () => {
    const { resumo, saida } = await rodar({ ...PRODUTO, senhaHash: SEGREDO });
    assert.ok(resumo.falhas > 0);
    assert.match(saida, /senhaHash não documentado/);
    assert.equal(saida.includes(SEGREDO), false);
  });

  it("reprova campo obrigatório ausente e valor fora do schema, sem imprimir o valor", async () => {
    const { nome: _nome, ...semNome } = PRODUTO;
    const { resumo, saida } = await rodar({ ...semNome, dataCadastro: SEGREDO });
    assert.ok(resumo.falhas > 0);
    assert.match(saida, /nome/);
    assert.match(saida, /dataCadastro must match format "date"/);
    assert.equal(saida.includes(SEGREDO), false);
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
