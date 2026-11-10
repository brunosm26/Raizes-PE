// Confere o openapi.yaml contra a API local (PI4-145): `npm run openapi:conferir`, com a API
// rodando. SOMENTE LEITURA: chama os GETs públicos e, sem cookie e sem corpo, as rotas
// protegidas (que param no 401). Nunca faz login, cadastro ou escrita, e só aceita host local.
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

export async function conferir(base: string, escrever: (linha: string) => void = console.log): Promise<Resumo> {
  exigirHostLocal(base);
  const rotas = await lerRotas();
  const ajv = novoAjv();
  const validadores = new Map<Esquema, ValidateFunction>();
  const resumo: Resumo = { total: 0, falhas: 0, divergenciasDeCodigo: 0 };

  function registrar(problemas: string[], nome: string, status: string, divergencia?: string): void {
    resumo.total += 1;
    if (problemas.length === 0) {
      escrever(`OK      ${nome} -> ${status}`);
    } else if (divergencia) {
      resumo.divergenciasDeCodigo += 1;
      escrever(`CODIGO  ${nome} -> ${status}: ${divergencia}`);
    } else {
      resumo.falhas += 1;
      escrever(`FALHA   ${nome} -> ${status}: ${problemas.join("; ")}`);
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
  async function pedir(
    rota: Rota,
    url: string,
    rotulo: string,
    esperado: number,
    checar?: (corpo: never) => string | null,
    divergencia?: string
  ): Promise<unknown> {
    const nome = `GET ${rota.caminho} (${rotulo})`;
    const resposta = await fetch(`${base}${url}`, { signal: AbortSignal.timeout(60_000) });
    const corpo: unknown = await resposta.json().catch(() => undefined);
    const problemas = resposta.status === esperado ? conferirCorpo(rota, resposta.status, corpo) : [`esperava ${esperado}`];
    const extra = problemas.length === 0 && checar ? checar(corpo as never) : null;
    if (extra) problemas.push(extra);
    registrar(problemas, nome, String(resposta.status), divergencia);
    return corpo;
  }

  const listar = rotaDe("get", "/produtos");
  const lista = await pedir(listar, "/produtos", "sem filtro", 200, (produtos: { dataCadastro: string }[]) => {
    const datas = produtos.map((p) => p.dataCadastro);
    return datas.every((d, i) => i === 0 || datas[i - 1]! >= d) ? null : "não está do mais novo para o mais antigo";
  });
  const produto = Array.isArray(lista) ? (lista[0] as Produto | undefined) : undefined;
  if (!produto || !UUID.test(produto.id) || !UUID.test(produto.artesaoId)) {
    registrar(["listagem sem produto com id válido"], "GET /produtos (id para as próximas chamadas)", "-");
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
  await pedir(listar, "/produtos?categoria=%00", "categoria com byte nulo", 200, undefined, "byte nulo chega ao banco e vira 500");

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
      await pedir(rota, url("%E0%A4%A"), "id com percent-encoding malformado", tem404 ? 404 : 200, undefined, "o erro de decodificação do Express vira 500");
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
    registrar(problemas, `${rota.metodo.toUpperCase()} ${rota.caminho} (sem cookie)`, String(resposta.status));
  }
  for (const rota of rotas.filter((r) => r.publica && r.metodo !== "get")) {
    escrever(`PULADA  ${rota.metodo.toUpperCase()} ${rota.caminho} (leitura apenas)`);
  }

  // A documentação servida pela própria API.
  const raiz = base.replace(/\/api\/?$/, "");
  const servida = await fetch(`${raiz}/api-docs.json`);
  const documentados = new Set(rotas.map((r) => r.caminho));
  const caminhos = Object.keys(((await servida.json().catch(() => ({}))) as Spec).paths ?? {});
  const iguais = caminhos.length === documentados.size && caminhos.every((c) => documentados.has(c));
  registrar(servida.ok && iguais ? [] : ["difere do openapi.yaml"], "GET /api-docs.json", String(servida.status));
  const pagina = await fetch(`${raiz}/api-docs/`);
  await pagina.text();
  registrar(pagina.ok ? [] : ["Swagger UI fora do ar"], "GET /api-docs/", String(pagina.status));

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
  const resumo = await conferir(base);
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
