// Senha para as contas de artesão que ainda não têm login (PI4-143, decisão D3).
//
//   npm run contas:artesao                    dry-run (padrão): lista, só pelo nome, os artesãos sem senha
//   npm run contas:artesao -- --aplicar       grava a senha de SENHA_ARTESAOS nessas contas
//
// --aplicar: numa única transação, grava em cada artesão com senha_hash nulo o hash scrypt da senha
// (o mesmo hashSenha do login, com um sal novo para cada conta). A senha vem SÓ da variável
// SENHA_ARTESAOS, definida no terminal (nunca da linha de comando nem do backend/.env). O UPDATE
// só alcança tipo = 'artesao' AND senha_hash IS NULL: quem já tem senha e os outros perfis ficam
// como estão, e rodar de novo não muda nada. Banco fora de localhost exige também
// --sim-eu-tenho-autorizacao.
//
// Banco: a DATABASE_URL do terminal ou, sem ela, a do backend/.env. A saída traz só nomes de
// artesãos e contagens: nunca a senha, o hash, e-mails nem a connection string.
// Passo a passo de quem roda no banco do time: docs/estrategia-autenticacao.md, seção 13.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";
import { Pool } from "pg";
import { hashSenha } from "../src/utils/senha";

export const FLAG_AUTORIZACAO = "--sim-eu-tenho-autorizacao";

const TAMANHO_MINIMO = 8;
const TAMANHO_MAXIMO = 200; // o mesmo limite do cadastro (authService)
const SENHAS_DE_DEMONSTRACAO = new Set(["demo123"]);
const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "::1"]);

// Só nome: o dry-run não lê senha_hash (ela aparece apenas no WHERE) nem e-mail.
export const SQL_NOMES_SEM_SENHA = `SELECT nome FROM origem.usuario WHERE tipo = 'artesao' AND senha_hash IS NULL`;
// --aplicar: trava as linhas que vão mudar e grava uma por uma, cada uma com o próprio sal.
export const SQL_IDS_SEM_SENHA = `SELECT id FROM origem.usuario WHERE tipo = 'artesao' AND senha_hash IS NULL FOR UPDATE`;
export const SQL_GRAVAR_SENHA = `UPDATE origem.usuario SET senha_hash = $1 WHERE id = $2 AND tipo = 'artesao' AND senha_hash IS NULL`;

const USO = [
  "Uso (na pasta backend/):",
  "  npm run contas:artesao                         lista os artesãos sem senha (dry-run, nada é gravado)",
  "  npm run contas:artesao -- --aplicar            grava a senha de SENHA_ARTESAOS nessas contas",
  `  npm run contas:artesao -- --aplicar ${FLAG_AUTORIZACAO}   idem, num banco fora de localhost`,
  "A senha vem só da variável SENHA_ARTESAOS, definida no terminal.",
].join("\n");

// Recusa antes de abrir conexão: argumento, senha ou falta de autorização.
export class ErroDeUso extends Error {}

export interface Opcoes {
  aplicar: boolean;
  autorizado: boolean;
}

export interface Ambiente {
  DATABASE_URL?: string;
  SENHA_ARTESAOS?: string;
}

export function lerArgumentos(args: readonly string[]): Opcoes {
  let dryRun = false;
  let aplicar = false;
  let autorizado = false;
  for (const arg of args) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--aplicar") aplicar = true;
    else if (arg === FLAG_AUTORIZACAO) autorizado = true;
    // O valor não é repetido na mensagem: pode ser a senha digitada no lugar errado.
    else throw new ErroDeUso("argumento não reconhecido (o valor não é exibido). A senha não vai na linha de comando.");
  }
  if (dryRun && aplicar) throw new ErroDeUso("use --dry-run ou --aplicar, não os dois.");
  return { aplicar, autorizado };
}

// Devolve a senha se ela puder ser usada. As mensagens nunca repetem o valor recebido.
export function validarSenha(valor: string | undefined): string {
  if (valor === undefined || valor.trim() === "") {
    throw new ErroDeUso("defina a variável SENHA_ARTESAOS no terminal (não no backend/.env) antes do --aplicar.");
  }
  if (valor !== valor.trim()) {
    throw new ErroDeUso(
      'a SENHA_ARTESAOS tem espaço no começo ou no fim (no cmd, "set X=valor && ..." guarda o espaço antes do &&). Defina de novo.'
    );
  }
  if (/^(["']).*\1$/s.test(valor)) {
    throw new ErroDeUso("a SENHA_ARTESAOS está entre aspas (no cmd as aspas viram parte do valor). Defina de novo, sem aspas.");
  }
  if (SENHAS_DE_DEMONSTRACAO.has(valor.toLowerCase())) {
    throw new ErroDeUso("a SENHA_ARTESAOS não pode ser a senha das contas de demonstração.");
  }
  if (valor.length < TAMANHO_MINIMO) {
    throw new ErroDeUso(`a SENHA_ARTESAOS precisa ter pelo menos ${TAMANHO_MINIMO} caracteres.`);
  }
  if (valor.length > TAMANHO_MAXIMO) {
    throw new ErroDeUso(`a SENHA_ARTESAOS pode ter no máximo ${TAMANHO_MAXIMO} caracteres.`);
  }
  return valor;
}

// true só para localhost, 127.0.0.1 e ::1. Sem host na URL (socket ou PGHOST), conta como remoto.
export function bancoEhLocal(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new ErroDeUso("não foi possível analisar a DATABASE_URL (o valor não é exibido).");
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") {
    throw new ErroDeUso("a DATABASE_URL precisa começar com postgresql:// (o valor não é exibido).");
  }
  // O pg aceita o host também na query (?host=...), e ele tem precedência sobre o da URL.
  const host = (u.searchParams.get("host") ?? u.hostname).toLowerCase().replace(/^\[(.*)\]$/, "$1");
  return HOSTS_LOCAIS.has(host);
}

// Só o código do erro e uma dica: a mensagem do driver pode trazer host, usuário ou valores.
export function descreverFalha(erro: unknown): string {
  const { code } = (erro ?? {}) as { code?: unknown };
  const codigo = typeof code === "string" ? code : undefined;
  const dicas: Record<string, string> = {
    ECONNREFUSED: "o banco não respondeu (confira se ele está no ar e a porta da DATABASE_URL)",
    ENOTFOUND: "o host da DATABASE_URL não foi encontrado",
    ETIMEDOUT: "a conexão com o banco demorou demais",
    "28P01": "o banco recusou o usuário ou a senha da DATABASE_URL",
    "3D000": "o banco da DATABASE_URL não existe",
    "42P01": "a tabela origem.usuario não existe (carregue o db/01 antes)",
    "42703": "a coluna senha_hash não existe (aplique o db/07_autenticacao.sql antes)",
  };
  const dica = (codigo && dicas[codigo]) || "erro ao falar com o banco";
  return `Falha: ${dica}${codigo ? ` (código ${codigo})` : ""}. Nada foi gravado.`;
}

async function listarSemSenha(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query<{ nome: string }>(SQL_NOMES_SEM_SENHA);
  return rows.map((r) => r.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function gravarSenhas(pool: Pool, senha: string): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(SQL_IDS_SEM_SENHA);
    let atualizadas = 0;
    for (const { id } of rows) {
      const resultado = await client.query(SQL_GRAVAR_SENHA, [await hashSenha(senha), id]);
      atualizadas += resultado.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return atualizadas;
  } catch (erro) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    client.release();
  }
}

// Devolve o código de saída: 0 deu certo, 1 falha no banco, 2 recusado antes de conectar.
export async function executar(
  args: readonly string[],
  ambiente: Ambiente,
  escrever: (linha: string) => void = console.log
): Promise<number> {
  let opcoes: Opcoes;
  let url: string;
  let local: boolean;
  let senha = "";
  try {
    opcoes = lerArgumentos(args);
    url = ambiente.DATABASE_URL?.trim() ?? "";
    if (!url) throw new ErroDeUso("DATABASE_URL não definida (no terminal ou no backend/.env).");
    local = bancoEhLocal(url);
    if (opcoes.aplicar && !local && !opcoes.autorizado) {
      throw new ErroDeUso(
        "a DATABASE_URL aponta para um banco fora de localhost (por exemplo, o Neon do time). O --aplicar grava " +
          "senhas nesse banco e só pode ser rodado por quem tem autorização do time para mexer nele. Se for o seu " +
          `caso, rode de novo com --aplicar ${FLAG_AUTORIZACAO}.`
      );
    }
    if (opcoes.aplicar) senha = validarSenha(ambiente.SENHA_ARTESAOS);
  } catch (erro) {
    if (!(erro instanceof ErroDeUso)) throw erro;
    escrever(`Recusado: ${erro.message}`);
    escrever("Nada foi gravado e nenhuma conexão foi aberta.");
    escrever("");
    escrever(USO);
    return 2;
  }

  const banco = local ? "local" : "fora de localhost";
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 15_000 });
  pool.on("error", () => undefined); // a falha chega pela consulta, em descreverFalha
  try {
    if (!opcoes.aplicar) {
      escrever(`Modo: dry-run (nada é gravado). Banco: ${banco}.`);
      const nomes = await listarSemSenha(pool);
      escrever(nomes.length > 0 ? "Artesãos sem senha:" : "Nenhum artesão sem senha.");
      for (const nome of nomes) escrever(`  - ${nome}`);
      escrever(`Total: ${nomes.length}`);
      if (nomes.length > 0) {
        escrever("Para gravar a senha: defina SENHA_ARTESAOS no terminal e rode com --aplicar.");
      }
      return 0;
    }
    escrever(`Modo: aplicar. Banco: ${banco}${local ? "" : ` (autorizado por ${FLAG_AUTORIZACAO})`}.`);
    const atualizadas = await gravarSenhas(pool, senha);
    escrever(`Contas de artesão atualizadas: ${atualizadas}`);
    return 0;
  } catch (erro) {
    escrever(descreverFalha(erro));
    return 1;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

// DATABASE_URL do terminal ou do backend/.env. SENHA_ARTESAOS só do terminal: o arquivo é lido
// com parse, sem passar nada para o process.env, e só a DATABASE_URL é aproveitada dele.
function ambienteDoProcesso(): Ambiente {
  const arquivo = join(__dirname, "..", ".env");
  const doArquivo = existsSync(arquivo) ? parse(readFileSync(arquivo)) : {};
  return {
    DATABASE_URL: process.env.DATABASE_URL?.trim() || doArquivo.DATABASE_URL,
    SENHA_ARTESAOS: process.env.SENHA_ARTESAOS,
  };
}

if (require.main === module) {
  executar(process.argv.slice(2), ambienteDoProcesso()).then(
    (codigo) => {
      process.exitCode = codigo;
    },
    (erro: unknown) => {
      console.log(descreverFalha(erro));
      process.exitCode = 1;
    }
  );
}
