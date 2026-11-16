// Confere o openapi.yaml contra a API local (PI4-145): `npm run openapi:conferir`, com a API
// rodando. SOMENTE LEITURA: chama os GETs públicos e, sem cookie e sem corpo, as rotas
// protegidas (que param no 401). Nunca faz cadastro ou escrita, e só aceita host local.
// Com `--com-login` (`npm run openapi:conferir:sessao`), entra UMA vez em cada conta de
// demonstração do README (o login só lê o banco) e repete com o cookie apenas os GETs que
// dependem de sessão, conferindo 200 ou 403 conforme o x-perfis. Não tenta de novo se o login
// falhar (respeita o freio de login) e o cookie fica só na memória.
// A saída traz status e nomes de campos, nunca valores: os corpos ficam só na memória.
// Variável opcional: OPENAPI_CONFERIR_URL (padrão http://localhost:4000/api).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import { Ajv, type ValidateFunction } from "ajv";
import { parse } from "yaml";

type Esquema = {
  properties?: Record<string, Esquema>;
  items?: Esquema;
  allOf?: Esquema[];
  minimum?: number;
  maximum?: number;
  default?: number;
};
interface Resposta {
  content?: { "application/json"?: { schema?: Esquema } };
}
interface Parametro {
  name: string;
  schema?: Esquema;
}
interface Operacao {
  security?: Record<string, unknown>[];
  "x-perfis"?: Perfil[];
  parameters?: Parametro[];
  responses: Record<string, Resposta>;
}
interface Spec {
  paths: Record<string, Record<string, unknown>>;
}
export interface Rota {
  metodo: string;
  caminho: string;
  op: Operacao;
  publica: boolean;
}
export interface Resumo {
  total: number;
  falhas: number;
  divergenciasDeCodigo: number;
}
type Produto = Record<string, unknown> & { id: string; artesaoId: string };
export type Perfil = "comprador" | "artesao" | "admin";
export interface Conta {
  perfil: Perfil;
  email: string;
  senha: string;
}
interface Sessao {
  perfil: Perfil;
  cookie: string;
}

// As contas públicas de demonstração do README (seção "Logins de demonstração").
export const CONTAS_DEMO: readonly Conta[] = [
  { perfil: "comprador", email: "ana.beatriz@raizespe.dev", senha: "demo123" },
  { perfil: "artesao", email: "tacaratu@raizespe.dev", senha: "demo123" },
  { perfil: "admin", email: "admin@raizespe.dev", senha: "demo123" },
];
const COOKIE_SESSAO = "raizes_sessao";
const VISITANTE = "visitante";

const METODOS = ["get", "post", "put", "patch", "delete"];
const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const ID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";
const ID_INVALIDO = "id-invalido";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function exigirHostLocal(base: string): void {
  if (!HOSTS_LOCAIS.has(new URL(base).hostname)) {
    throw new Error("Este script só roda contra a API local (localhost, 127.0.0.1 ou [::1]).");
  }
}

// Sem verbose, as mensagens do ajv trazem caminho e regra, nunca o valor recebido.
function novoAjv(): Ajv {
  const ajv = new Ajv({ strict: false, allErrors: true, formats: { double: true, email: true, password: true } });
  ajv.addFormat("uuid", UUID);
  ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  return ajv;
}

function semIndices(caminho: string): string {
  return caminho.replace(/\/\d+(?=\/|$)/g, "/[]");
}

// O schema só recusa campo a mais com additionalProperties; aqui a API pode devolver dado que
// a spec não conhece (é assim que um campo sensível vazaria), então isso é conferido à parte.
export function camposNaoDocumentados(esquema: Esquema | undefined, dado: unknown, caminho = ""): string[] {
  if (!esquema || dado === null || typeof dado !== "object") return [];
  if (Array.isArray(dado)) return [...new Set(dado.flatMap((d) => camposNaoDocumentados(esquema.items, d, `${caminho}/[]`)))];
  const propriedades: Record<string, Esquema> = {};
  for (const parte of [esquema, ...(esquema.allOf ?? [])]) Object.assign(propriedades, parte.properties);
  return Object.entries(dado).flatMap(([campo, valor]) => {
    const filho = propriedades[campo];
    return filho ? camposNaoDocumentados(filho, valor, `${caminho}/${campo}`) : [`${caminho}/${campo}`];
  });
}

export async function lerRotas(arquivo = join(__dirname, "..", "openapi.yaml")): Promise<Rota[]> {
  const bruta = parse(readFileSync(arquivo, "utf8")) as object;
  const spec = (await SwaggerParser.dereference(bruta as never)) as unknown as Spec;
  const rotas: Rota[] = [];
  for (const [caminho, item] of Object.entries(spec.paths)) {
    const comuns = (item.parameters ?? []) as Parametro[];
    for (const metodo of METODOS.filter((m) => item[m])) {
      const op = item[metodo] as Operacao;
      const seguranca = op.security ?? [];
      const publica = seguranca.length === 0 || seguranca.some((s) => Object.keys(s).length === 0);
      rotas.push({ metodo, caminho, publica, op: { ...op, parameters: [...comuns, ...(op.parameters ?? [])] } });
    }
  }
  return rotas;
}

// Sessão opcional da rota (security com {} e cookieSessao): a resposta muda com o perfil.
function sessaoOpcional(rota: Rota): boolean {
  const seguranca = rota.op.security ?? [];
  return rota.publica && seguranca.some((s) => "cookieSessao" in s);
}

export async function conferir(
  base: string,
  escrever: (linha: string) => void = console.log,
  contas: readonly Conta[] = []
): Promise<Resumo> {
  exigirHostLocal(base);
  const rotas = await lerRotas();
  const ajv = novoAjv();
  const validadores = new Map<Esquema, ValidateFunction>();
  const resumo: Resumo = { total: 0, falhas: 0, divergenciasDeCodigo: 0 };

  escrever("| Rota | Perfil | Status | Resultado | Detalhe |");
  escrever("|---|---|---|---|---|");
  const linha = (nome: string, perfil: string, status: string, resultado: string, detalhe = "") =>
    escrever(`| ${nome} | ${perfil} | ${status} | ${resultado} | ${detalhe.replaceAll("|", "/")} |`);

  function registrar(problemas: string[], nome: string, perfil: string, status: string, divergencia?: string): void {
    resumo.total += 1;
    if (problemas.length === 0) {
      linha(nome, perfil, status, "OK");
    } else if (divergencia) {
      resumo.divergenciasDeCodigo += 1;
      linha(nome, perfil, status, "CODIGO", divergencia);
    } else {
      resumo.falhas += 1;
      linha(nome, perfil, status, "FALHA", problemas.join("; "));
    }
  }

  function conferirCorpo(rota: Rota, status: number, corpo: unknown): string[] {
    const esquema = rota.op.responses[String(status)]?.content?.["application/json"]?.schema;
    if (!esquema) return [`status ${status} sem schema documentado`];
    let validar = validadores.get(esquema);
    if (!validar) {
      validar = ajv.compile(esquema);
      validadores.set(esquema, validar);
    }
    validar(corpo);
    const erros = (validar.errors ?? []).map((e) => `${semIndices(e.instancePath) || "/"} ${e.message}`);
    const extras = camposNaoDocumentados(esquema, corpo).map((c) => `${c} não documentado`);
    return [...new Set([...erros, ...extras])];
  }

  function rotaDe(metodo: string, caminho: string): Rota {
    const rota = rotas.find((r) => r.metodo === metodo && r.caminho === caminho);
    if (!rota) throw new Error(`${metodo.toUpperCase()} ${caminho} não está no openapi.yaml`);
    return rota;
  }

  // Faz um GET, confere status e schema e devolve o corpo para quem quiser conferir mais.
  // O cookie de sessão, quando há, só vai em GET.
  async function pedir(
    rota: Rota,
    url: string,
    rotulo: string,
    esperado: number,
    checar?: (corpo: never) => string | null,
    { divergencia, sessao }: { divergencia?: string; sessao?: Sessao } = {}
  ): Promise<unknown> {
    const nome = `GET ${rota.caminho} (${rotulo})`;
    const resposta = await fetch(`${base}${url}`, {
      headers: sessao ? { cookie: sessao.cookie } : {},
      signal: AbortSignal.timeout(60_000),
    });
    const corpo: unknown = await resposta.json().catch(() => undefined);
    const problemas = resposta.status === esperado ? conferirCorpo(rota, resposta.status, corpo) : [`esperava ${esperado}`];
    const extra = problemas.length === 0 && checar ? checar(corpo as never) : null;
    if (extra) problemas.push(extra);
    registrar(problemas, nome, sessao?.perfil ?? VISITANTE, String(resposta.status), divergencia);
    return corpo;
  }

  // Uma única tentativa por conta. Devolve só o par nome=valor do cookie, que fica na memória.
  async function entrar(conta: Conta): Promise<Sessao | null> {
    const rota = rotaDe("post", "/auth/login");
    const resposta = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: conta.email, senha: conta.senha, perfil: conta.perfil }),
      signal: AbortSignal.timeout(60_000),
    });
    const corpo: unknown = await resposta.json().catch(() => undefined);
    const problemas = resposta.status === 200 ? conferirCorpo(rota, 200, corpo) : ["esperava 200 (login não é repetido)"];
    const cookie = resposta.headers
      .getSetCookie()
      .map((c) => c.split(";")[0]!.trim())
      .find((c) => c.startsWith(`${COOKIE_SESSAO}=`) && c.length > COOKIE_SESSAO.length + 1);
    if (problemas.length === 0 && (corpo as { usuario?: { tipo?: unknown } }).usuario?.tipo !== conta.perfil) {
      problemas.push("usuario.tipo diferente do perfil da conta");
    }
    if (problemas.length === 0 && !cookie) problemas.push(`sem Set-Cookie ${COOKIE_SESSAO}`);
    registrar(problemas, "POST /auth/login (conta de demonstração)", conta.perfil, String(resposta.status));
    return problemas.length === 0 && cookie ? { perfil: conta.perfil, cookie } : null;
  }

  const listar = rotaDe("get", "/produtos");
  const lista = await pedir(listar, "/produtos", "sem filtro", 200, (produtos: { dataCadastro: string }[]) => {
    const datas = produtos.map((p) => p.dataCadastro);
    return datas.every((d, i) => i === 0 || datas[i - 1]! >= d) ? null : "não está do mais novo para o mais antigo";
  });
  const produto = Array.isArray(lista) ? (lista[0] as Produto | undefined) : undefined;
  if (!produto || !UUID.test(produto.id) || !UUID.test(produto.artesaoId)) {
    registrar(["listagem sem produto com id válido"], "GET /produtos (id para as próximas chamadas)", VISITANTE, "-");
    return resumo;
  }

  // Filtros da vitrine, com valores tirados da própria listagem.
  const so = (campo: string, valor: unknown) => (produtos: Record<string, unknown>[]) =>
    produtos.length > 0 && produtos.every((p) => p[campo] === valor) ? null : `filtro não respeitado em ${campo}`;
  for (const [parametro, campo] of [
    ["tecnica", "tecnica"],
    ["categoria", "categoria"],
    ["regiao", "artesaoRegiao"],
  ] as const) {
    const valor = encodeURIComponent(String(produto[campo]));
    await pedir(listar, `/produtos?${parametro}=${valor}`, `${parametro} real`, 200, so(campo, produto[campo]));
    await pedir(listar, `/produtos?${parametro}=valor-que-nao-existe`, `${parametro} sem resultado`, 200, (p: unknown[]) =>
      p.length === 0 ? null : "devia vir vazia"
    );
  }
  await pedir(listar, `/produtos?busca=${encodeURIComponent(String(produto.nome))}`, "busca real", 200, (p: unknown[]) =>
    p.length > 0 ? null : "devia achar o produto"
  );
  await pedir(listar, "/produtos?categoria=%00", "categoria com byte nulo", 200, undefined, {
    divergencia: "byte nulo chega ao banco e vira 500",
  });

  for (const rota of rotas.filter((r) => r.metodo === "get" && r.publica)) {
    const idReal = rota.caminho.startsWith("/artesaos") ? produto.artesaoId : produto.id;
    const url = (id: string) => rota.caminho.replace("{id}", id);

    if (rota.caminho !== "/produtos") await pedir(rota, url(idReal), rota.caminho.includes("{id}") ? "id real" : "sem parâmetro", 200);

    if (rota.caminho.includes("{id}")) {
      const tem404 = Boolean(rota.op.responses["404"]);
      const vazio = (corpo: unknown) => {
        const v = Array.isArray(corpo) ? corpo : Object.values(corpo as object);
        return v.every((x) => x === 0) ? null : "devia vir zerado ou vazio";
      };
      for (const [rotulo, id] of [
        ["id inexistente", ID_INEXISTENTE],
        ["id inválido", ID_INVALIDO],
      ] as const) {
        await pedir(rota, url(id), rotulo, tem404 ? 404 : 200, tem404 ? undefined : vazio);
      }
      await pedir(rota, url("%E0%A4%A"), "id com percent-encoding malformado", tem404 ? 404 : 200, undefined, {
        divergencia: "o erro de decodificação do Express vira 500",
      });
    }

    const limite = rota.op.parameters?.find((p) => p.name === "limite")?.schema;
    if (limite) {
      const lista = (corpo: unknown) => (Array.isArray(corpo) ? corpo : (corpo as { dados: unknown[] }).dados);
      for (const [valor, teto] of [
        ["abc", limite.default],
        ["0", limite.minimum],
        ["999", limite.maximum],
      ] as const) {
        await pedir(rota, `${url(idReal)}?limite=${valor}`, `limite=${valor}`, 200, (corpo: unknown) =>
          lista(corpo).length <= (teto ?? 0) ? null : `devia trazer até ${teto} itens`
        );
      }
    }
  }

  // Rotas protegidas: sem cookie e sem corpo. Mesmo que uma perdesse o exigirSessao, sem corpo
  // a validação recusaria antes de gravar. As públicas de escrita (login, cadastro, logout) ficam de fora.
  for (const rota of rotas.filter((r) => !r.publica)) {
    const resposta = await fetch(`${base}${rota.caminho.replace("{id}", ID_INEXISTENTE)}`, {
      method: rota.metodo.toUpperCase(),
      signal: AbortSignal.timeout(60_000),
    });
    const corpo: unknown = await resposta.json().catch(() => undefined);
    const problemas = resposta.status === 401 ? conferirCorpo(rota, 401, corpo) : ["esperava 401"];
    registrar(problemas, `${rota.metodo.toUpperCase()} ${rota.caminho} (sem cookie)`, VISITANTE, String(resposta.status));
  }

  // Com sessão: só os GETs protegidos ou de sessão opcional, uma vez por perfil.
  const comSessao = rotas.filter((r) => r.metodo === "get" && (!r.publica || sessaoOpcional(r)));
  const checagensDoPerfil: Record<string, (perfil: Perfil) => (corpo: never) => string | null> = {
    "/auth/me": (perfil) => (c: { usuario: { tipo: string } | null }) =>
      c.usuario?.tipo === perfil ? null : "usuario da sessão não veio com o perfil da conta",
    "/recomendacoes": (perfil) => (c: { compradorId: string | null }) =>
      (c.compradorId !== null) === (perfil === "comprador") ? null : "compradorId só vem para o comprador",
  };
  for (const conta of contas) {
    const sessao = await entrar(conta);
    if (!sessao) continue;
    for (const rota of comSessao) {
      const permitido = rota.publica || (rota.op["x-perfis"] ?? []).includes(sessao.perfil);
      const checar = permitido ? checagensDoPerfil[rota.caminho]?.(sessao.perfil) : undefined;
      await pedir(rota, rota.caminho, "com cookie", permitido ? 200 : 403, checar, { sessao });
    }
  }

  const naoChamadas = rotas.filter((r) => r.metodo !== "get" && r.publica && !(contas.length > 0 && r.caminho === "/auth/login"));
  for (const rota of naoChamadas) linha(`${rota.metodo.toUpperCase()} ${rota.caminho}`, "-", "-", "PULADA", "leitura apenas");

  // A documentação servida pela própria API.
  const raiz = base.replace(/\/api\/?$/, "");
  const servida = await fetch(`${raiz}/api-docs.json`);
  const documentados = new Set(rotas.map((r) => r.caminho));
  const caminhos = Object.keys(((await servida.json().catch(() => ({}))) as Spec).paths ?? {});
  const iguais = caminhos.length === documentados.size && caminhos.every((c) => documentados.has(c));
  registrar(servida.ok && iguais ? [] : ["difere do openapi.yaml"], "GET /api-docs.json", VISITANTE, String(servida.status));
  const pagina = await fetch(`${raiz}/api-docs/`);
  await pagina.text();
  registrar(pagina.ok ? [] : ["Swagger UI fora do ar"], "GET /api-docs/", VISITANTE, String(pagina.status));

  return resumo;
}

async function principal(): Promise<void> {
  const base = (process.env.OPENAPI_CONFERIR_URL ?? "http://localhost:4000/api").replace(/\/+$/, "");
  exigirHostLocal(base);
  try {
    const saude = await fetch(`${base}/saude`);
    await saude.text();
  } catch {
    console.error(`API não encontrada em ${base}. Suba com "npm run dev" em outro terminal.`);
    process.exit(2);
  }
  const resumo = await conferir(base, console.log, process.argv.includes("--com-login") ? CONTAS_DEMO : []);
  console.log(
    `\n${resumo.total} conferências, ${resumo.falhas} falha(s) da spec, ${resumo.divergenciasDeCodigo} divergência(s) de código conhecida(s).`
  );
  process.exit(resumo.falhas > 0 ? 1 : 0);
}

if (require.main === module) {
  principal().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : "erro inesperado");
    process.exit(1);
  });
}
