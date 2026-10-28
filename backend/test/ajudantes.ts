import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { basename, join } from "node:path";
import { after, it } from "node:test";
import type { Server } from "node:http";
import type { TipoUsuario } from "../src/types/dominio";

// Os testes que gravam no banco só rodam com TEST_DATABASE_URL apontando para um banco
// DESCARTÁVEL (nunca o Neon do time): eles criam pedidos e produtos. A variável vem só do
// terminal; o backend/.env não é carregado aqui de propósito.
export const bancoDeTeste = process.env.TEST_DATABASE_URL?.trim() || undefined;
export const semBanco = bancoDeTeste ? false : "defina TEST_DATABASE_URL (banco descartável) no terminal para rodar";

export interface UrlDoTime {
  fonte: string; // de onde veio (process.env, backend/.env...), para a mensagem de erro
  variavel: string;
  valor: string | undefined;
}

interface BancoNormalizado {
  host: string;
  porta: string;
  banco: string;
}

const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "::1"]);

// host em minúsculas e sem o "-pooler" do primeiro rótulo (pooled e direta do Neon são o
// mesmo banco), porta (padrão 5432) e nome do banco. A query (sslmode etc.) é ignorada.
function normalizarUrlBanco(url: string): BancoNormalizado | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") return null;
  const host = u.hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (!host) return null;
  const [primeiro, ...resto] = host.split(".");
  return {
    host: [primeiro!.replace(/-pooler$/, ""), ...resto].join("."),
    porta: u.port || "5432",
    banco: decodeURIComponent(u.pathname.replace(/^\//, "")) || decodeURIComponent(u.username),
  };
}

// Trava pura: lança erro se a URL de teste não puder ser analisada, se for o mesmo banco de
// alguma URL do time ou se for remota sem a confirmação explícita. Nenhum valor é impresso.
export function conferirBancoDeTeste(urlTeste: string, doTime: UrlDoTime[], remotoDescartavel: boolean): void {
  const teste = normalizarUrlBanco(urlTeste);
  if (!teste) {
    throw new Error("Não foi possível analisar a TEST_DATABASE_URL (esperado postgresql://usuario:senha@host:porta/banco).");
  }
  for (const { fonte, variavel, valor } of doTime) {
    if (!valor?.trim()) continue;
    const time = normalizarUrlBanco(valor);
    if (!time) {
      throw new Error(`Não foi possível analisar a ${variavel} de ${fonte} para comparar com a TEST_DATABASE_URL.`);
    }
    if (time.host === teste.host && time.porta === teste.porta && time.banco === teste.banco) {
      throw new Error(
        `TEST_DATABASE_URL aponta para o mesmo banco da ${variavel} de ${fonte} (o banco do time). ` +
          "Use um banco DESCARTÁVEL (por exemplo, uma branch do Neon)."
      );
    }
  }
  if (!HOSTS_LOCAIS.has(teste.host) && !remotoDescartavel) {
    throw new Error(
      "TEST_DATABASE_URL aponta para um host remoto. Se for um banco DESCARTÁVEL (por exemplo, uma branch do Neon " +
        "só para testes), defina também TEST_DB_REMOTO_DESCARTAVEL=1 no terminal."
    );
  }
}

// Leitor mínimo de arquivo .env (CHAVE=valor, com ou sem aspas). Só devolve os pares:
// não grava nada em process.env.
export function lerArquivoEnv(caminho: string): Record<string, string> {
  if (!existsSync(caminho)) return {};
  const vars: Record<string, string> = {};
  for (const linha of readFileSync(caminho, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(linha);
    if (!m) continue;
    const aspas = /^(["'])(.*)\1$/.exec(m[2]!);
    vars[m[1]!] = aspas ? aspas[2]! : m[2]!.replace(/\s+#.*$/, "");
  }
  return vars;
}

if (bancoDeTeste) {
  const raiz = join(__dirname, "..", "..");
  const fontes: [string, Record<string, string | undefined>][] = [
    ["process.env", process.env],
    ["backend/.env", lerArquivoEnv(join(__dirname, "..", ".env"))],
    [".env.local (raiz)", lerArquivoEnv(join(raiz, ".env.local"))],
    [".env (raiz)", lerArquivoEnv(join(raiz, ".env"))],
  ];
  const doTime = fontes.flatMap(([fonte, vars]) =>
    ["DATABASE_URL", "DIRECT_URL"].map((variavel) => ({ fonte, variavel, valor: vars[variavel] }))
  );
  conferirBancoDeTeste(bancoDeTeste, doTime, process.env.TEST_DB_REMOTO_DESCARTAVEL === "1");
}

process.env.DATABASE_URL = bancoDeTeste ?? "";
process.env.SESSION_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres";
process.env.NODE_ENV = "test";

// Teste que precisa do banco: pulado sem TEST_DATABASE_URL, com um aviso no fim do arquivo
// dizendo quantos foram pulados e como habilitar.
let puladosSemBanco = 0;
export function itComBanco(nome: string, fn: () => Promise<void>): void {
  if (semBanco && puladosSemBanco++ === 0) {
    after(() => {
      console.warn(
        `\n[aviso] ${puladosSemBanco} teste(s) com banco PULADOS em ${basename(process.argv[1] ?? "")}. ` +
          "Para rodar, defina TEST_DATABASE_URL no terminal com um banco DESCARTÁVEL " +
          '(cmd: set TEST_DATABASE_URL=...; PowerShell: $env:TEST_DATABASE_URL="..."). ' +
          "Host remoto exige também TEST_DB_REMOTO_DESCARTAVEL=1.\n"
      );
    });
  }
  it(nome, { skip: semBanco }, fn);
}

// Usuários e produtos fixos da carga db/05_dados_raizes_pe.sql.
export const USUARIOS = {
  comprador: { id: "10000000-0000-4000-8000-000000000007", nome: "Ana Beatriz", tipo: "comprador" },
  artesao: { id: "10000000-0000-4000-8000-000000000002", nome: "Tacaratu", tipo: "artesao" },
  outroArtesao: { id: "10000000-0000-4000-8000-000000000001", nome: "Vitalino", tipo: "artesao" },
  admin: { id: "10000000-0000-4000-8000-000000000009", nome: "Admin", tipo: "admin" },
} as const satisfies Record<string, { id: string; nome: string; tipo: TipoUsuario }>;

export const PRODUTO_DO_ARTESAO = "30000000-0000-4000-8000-000000000002"; // Tapete (Tacaratu)
export const PRODUTO_DE_OUTRO = "30000000-0000-4000-8000-000000000001"; // Vaso (Vitalino)

export interface Api {
  url: string;
  fechar: () => Promise<void>;
  cookie: (usuario: { id: string; nome: string; tipo: TipoUsuario }) => Promise<string>;
}

// Sobe o app numa porta livre. O import é dinâmico para o env acima valer antes.
export async function subirApi(): Promise<Api> {
  const { app } = await import("../src/app");
  const { fecharPool } = await import("../src/config/db");
  const { COOKIE_SESSAO, criarToken } = await import("../src/utils/tokenSessao");
  const servidor: Server = await new Promise((ok) => {
    const s = app.listen(0, () => ok(s));
  });
  const { port } = servidor.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/api`,
    fechar: async () => {
      await new Promise((ok) => servidor.close(ok));
      await fecharPool();
    },
    cookie: async (usuario) => `${COOKIE_SESSAO}=${await criarToken(usuario)}`,
  };
}

export function json(corpo: unknown, cookie?: string): RequestInit {
  return {
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(corpo),
  };
}

// Token e cookie no formato antigo (antes da PI4-130): "corpo.assinatura" com HMAC-SHA256.
export function tokenFormatoAntigo(): string {
  const corpo = Buffer.from(JSON.stringify({ ...USUARIOS.comprador, exp: Math.floor(Date.now() / 1000) + 3600 })).toString(
    "base64url"
  );
  const assinatura = createHmac("sha256", process.env.SESSION_SECRET as string).update(corpo).digest("base64url");
  return `${corpo}.${assinatura}`;
}

export function cookieFormatoAntigo(): string {
  return `raizes_sessao=${tokenFormatoAntigo()}`;
}
