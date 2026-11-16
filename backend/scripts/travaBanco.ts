// Trava comum para tudo que fala com banco fora da API: testes (test/ajudantes.ts), o
// comparador de esquemas e o migrate do banco descartável (PI4-147). Nenhuma função aqui
// imprime URL, usuário ou senha: as mensagens citam só a variável e a fonte.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface UrlDoTime {
  fonte: string; // de onde veio (process.env, backend/.env...), para a mensagem de erro
  variavel: string;
  valor: string | undefined;
}

export interface BancoNormalizado {
  host: string;
  porta: string;
  banco: string;
}

const BOM = new RegExp(`^${String.fromCharCode(0xfeff)}`); // marca de ordem de bytes no início do .env

export const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "::1"]);

// host em minúsculas e sem o "-pooler" do primeiro rótulo (pooled e direta do Neon são o
// mesmo banco), porta (padrão 5432) e nome do banco. A query (sslmode etc.) é ignorada.
export function normalizarUrlBanco(url: string): BancoNormalizado | null {
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

// Trava pura: lança erro se a URL não puder ser analisada, se for o mesmo banco de alguma
// URL do time ou se for remota sem a confirmação explícita. Nenhum valor é impresso.
// `variavel` é só o nome usado nas mensagens (TEST_DATABASE_URL nos testes).
export function conferirBancoDeTeste(
  urlTeste: string,
  doTime: UrlDoTime[],
  remotoDescartavel: boolean,
  variavel = "TEST_DATABASE_URL"
): void {
  const teste = normalizarUrlBanco(urlTeste);
  if (!teste) {
    throw new Error(`Não foi possível analisar a ${variavel} (esperado postgresql://usuario:senha@host:porta/banco).`);
  }
  for (const { fonte, variavel: doTimeVar, valor } of doTime) {
    if (!valor?.trim()) continue;
    const time = normalizarUrlBanco(valor);
    if (!time) {
      throw new Error(`Não foi possível analisar a ${doTimeVar} de ${fonte} para comparar com a ${variavel}.`);
    }
    if (time.host === teste.host && time.porta === teste.porta && time.banco === teste.banco) {
      throw new Error(
        `${variavel} aponta para o mesmo banco da ${doTimeVar} de ${fonte} (o banco do time). ` +
          "Use um banco DESCARTÁVEL (por exemplo, uma branch do Neon)."
      );
    }
  }
  if (!HOSTS_LOCAIS.has(teste.host) && !remotoDescartavel) {
    throw new Error(
      `${variavel} aponta para um host remoto. Se for um banco DESCARTÁVEL (por exemplo, uma branch do Neon ` +
        "só para testes), defina também TEST_DB_REMOTO_DESCARTAVEL=1 no terminal."
    );
  }
}

// Leitor mínimo de arquivo .env (CHAVE=valor, com ou sem aspas). Só devolve os pares:
// não grava nada em process.env.
export function lerArquivoEnv(caminho: string): Record<string, string> {
  if (!existsSync(caminho)) return {};
  const vars: Record<string, string> = {};
  for (const linha of readFileSync(caminho, "utf8").replace(BOM, "").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(linha);
    if (!m) continue;
    const aspas = /^(["'])(.*)\1$/.exec(m[2]!);
    vars[m[1]!] = aspas ? aspas[2]! : m[2]!.replace(/\s+#.*$/, "");
  }
  return vars;
}

// DATABASE_URL e DIRECT_URL de todas as fontes do time: process.env, backend/.env,
// .env.local e .env da raiz do repositório.
export function urlsDoTime(): UrlDoTime[] {
  const backend = join(__dirname, "..");
  const raiz = join(backend, "..");
  const fontes: [string, Record<string, string | undefined>][] = [
    ["process.env", process.env],
    ["backend/.env", lerArquivoEnv(join(backend, ".env"))],
    [".env.local (raiz)", lerArquivoEnv(join(raiz, ".env.local"))],
    [".env (raiz)", lerArquivoEnv(join(raiz, ".env"))],
  ];
  return fontes.flatMap(([fonte, vars]) =>
    ["DATABASE_URL", "DIRECT_URL"].map((variavel) => ({ fonte, variavel, valor: vars[variavel] }))
  );
}

// Para scripts de banco descartável: só aceita host local (localhost, 127.0.0.1, ::1) e
// recusa a URL se ela for o mesmo banco de alguma DATABASE_URL/DIRECT_URL do time.
// Devolve host, porta e banco para o script imprimir o alvo (nunca a URL).
export function exigirBancoLocalDescartavel(
  url: string,
  variavel: string,
  doTime: UrlDoTime[] = urlsDoTime()
): BancoNormalizado {
  const alvo = normalizarUrlBanco(url);
  if (!alvo) {
    throw new Error(`Não foi possível analisar a ${variavel} (esperado postgresql://usuario:senha@host:porta/banco).`);
  }
  if (!HOSTS_LOCAIS.has(alvo.host)) {
    throw new Error(`${variavel} precisa apontar para localhost, 127.0.0.1 ou ::1 (banco descartável). Recusado.`);
  }
  conferirBancoDeTeste(url, doTime, false, variavel);
  return alvo;
}
