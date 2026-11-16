// Compara o schema `origem` de dois bancos LOCAIS pelo catálogo do PostgreSQL (PI4-147).
// Somente leitura. Não depende da ordem do pg_dump: cada objeto vira uma linha
// "categoria | chave = valor", ordenada, e o resultado é a lista de diferenças.
//
// Uso (as URLs ficam só em variáveis de ambiente, nunca no comando nem no log):
//   COMPARAR_URL_A=... COMPARAR_URL_B=... npm run db:comparar
//   npm run db:comparar -- env:MINHA_VAR_A env:MINHA_VAR_B
// Também aceita a URL direto como argumento, mas o npm ecoa a linha de comando.
//
// Recusa host que não seja localhost, 127.0.0.1 ou ::1 e URL igual à DATABASE_URL ou à
// DIRECT_URL do time (process.env, backend/.env, .env.local e .env da raiz).
// Saída: "Nenhuma diferença" (código 0) ou a lista de diferenças (código 1).
import { Client } from "pg";
import { exigirBancoLocalDescartavel } from "./travaBanco";

const SCHEMA = "origem";
const IGNORAR_TABELAS = ["_prisma_migrations"];

// Cada consulta devolve linhas { categoria, chave, valor }. O papel da conexão (o dono no
// container) aparece como <conexao>, para dois bancos com donos diferentes não divergirem
// só por isso; os demais papéis (origem_app, origem_recomendacao) aparecem pelo nome.
const CONSULTAS: string[] = [
  // extensões instaladas no banco (gen_random_uuid é nativa a partir do PG 13)
  `SELECT 'extensao' AS categoria, e.extname AS chave,
          'versao=' || e.extversion || ' schema=' || n.nspname AS valor
     FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace`,

  // o schema: dono, permissões e comentário
  `SELECT 'schema' AS categoria, n.nspname AS chave,
          'dono=' || pg_temp.papel(n.nspowner) || ' acl=' || pg_temp.acl(n.nspacl) ||
          ' comentario=' || coalesce(obj_description(n.oid, 'pg_namespace'), '') AS valor
     FROM pg_namespace n WHERE n.nspname = $1`,

  // tabelas, views, sequences etc.: tipo, dono, permissões e comentário
  `SELECT 'relacao' AS categoria, c.relname AS chave,
          'tipo=' || c.relkind::text || ' dono=' || pg_temp.papel(c.relowner) || ' acl=' || pg_temp.acl(c.relacl) ||
          ' comentario=' || coalesce(obj_description(c.oid, 'pg_class'), '') AS valor
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      AND c.relname <> ALL ($2)`,

  // colunas: posição (sem contar as removidas), tipo, nulabilidade, default e comentário
  `SELECT 'coluna' AS categoria, c.relname || '.' || a.attname AS chave,
          'pos=' || row_number() OVER (PARTITION BY c.oid ORDER BY a.attnum) ||
          ' tipo=' || format_type(a.atttypid, a.atttypmod) ||
          ' notnull=' || a.attnotnull ||
          ' default=' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') ||
          ' comentario=' || coalesce(col_description(c.oid, a.attnum), '') AS valor
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND a.attnum > 0 AND NOT a.attisdropped AND c.relname <> ALL ($2)`,

  // constraints (PK, FK, UNIQUE, CHECK...) com a definição completa
  `SELECT 'constraint' AS categoria, c.relname || '.' || k.conname AS chave,
          'tipo=' || k.contype::text || ' adiavel=' || k.condeferrable || ' adiada=' || k.condeferred ||
          ' def=' || pg_get_constraintdef(k.oid, true) AS valor
     FROM pg_constraint k
     JOIN pg_class c ON c.oid = k.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relname <> ALL ($2)`,

  // índices, inclusive os criados por PK e UNIQUE
  `SELECT 'indice' AS categoria, i.tablename || '.' || i.indexname AS chave, i.indexdef AS valor
     FROM pg_indexes i WHERE i.schemaname = $1 AND i.tablename <> ALL ($2)`,

  // gatilhos criados pelo usuário (os internos das FKs ficam de fora)
  `SELECT 'gatilho' AS categoria, c.relname || '.' || t.tgname AS chave,
          'habilitado=' || t.tgenabled::text || ' def=' || pg_get_triggerdef(t.oid, true) AS valor
     FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND NOT t.tgisinternal`,

  // funções: definição completa, dono, permissões e comentário
  `SELECT 'funcao' AS categoria, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS chave,
          'dono=' || pg_temp.papel(p.proowner) || ' acl=' || pg_temp.acl(p.proacl) ||
          ' comentario=' || coalesce(obj_description(p.oid, 'pg_proc'), '') ||
          E'\\n' || pg_get_functiondef(p.oid) AS valor
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = $1`,

  // views: definição (com search_path = pg_catalog, os nomes saem qualificados)
  `SELECT 'view' AS categoria, v.viewname AS chave, pg_get_viewdef(c.oid, true) AS valor
     FROM pg_views v
     JOIN pg_class c ON c.relname = v.viewname
     JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = v.schemaname
    WHERE v.schemaname = $1`,

  // sequences (o schema usa UUID, então o esperado é nenhuma)
  `SELECT 'sequence' AS categoria, s.sequencename AS chave,
          'tipo=' || s.data_type || ' inicio=' || s.start_value || ' incremento=' || s.increment_by AS valor
     FROM pg_sequences s WHERE s.schemaname = $1 AND s.sequencename NOT LIKE '\\_prisma%'`,

  // tipos próprios do schema (enum, domínio, composto); o schema não usa ENUM
  `SELECT 'tipo' AS categoria, t.typname AS chave, 'tipo=' || t.typtype::text AS valor
     FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = $1
      AND (t.typtype IN ('e', 'd', 'r', 'm')
           OR (t.typtype = 'c' AND EXISTS (SELECT 1 FROM pg_class c WHERE c.oid = t.typrelid AND c.relkind = 'c')))`,

  // papéis citados nas permissões precisam existir no servidor
  `SELECT 'papel' AS categoria, r.rolname AS chave, 'login=' || r.rolcanlogin AS valor
     FROM pg_roles r WHERE r.rolname IN ('origem_app', 'origem_recomendacao')`,
];

// Funções temporárias (pg_temp: somem ao fechar a conexão, não alteram o banco) que deixam
// o dono e as permissões estáveis entre bancos. A ACL sai agrupada por papel, por exemplo
// "origem_app=DELETE,INSERT,SELECT,UPDATE"; "*" marca WITH GRANT OPTION. Quem concedeu
// (sempre o dono) fica de fora.
const AJUDANTES_SQL = `
CREATE FUNCTION pg_temp.papel(oid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN $1 = 0 THEN 'PUBLIC'
              WHEN $1 = (SELECT oid FROM pg_roles WHERE rolname = current_user) THEN '<conexao>'
              ELSE (SELECT rolname FROM pg_roles WHERE oid = $1) END $$;
CREATE FUNCTION pg_temp.acl(aclitem[]) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(string_agg(papel || '=' || privs, ' ' ORDER BY papel), '<padrao>') FROM (
    SELECT pg_temp.papel(e.grantee) AS papel,
           string_agg(e.privilege_type || CASE WHEN e.is_grantable THEN '*' ELSE '' END, ','
                      ORDER BY e.privilege_type) AS privs
      FROM aclexplode($1) e GROUP BY 1) s $$;
`;

type Linhas = Map<string, string>;

async function lerCatalogo(url: string): Promise<Linhas> {
  const cliente = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  await cliente.connect();
  try {
    // Somente leitura; as funções temporárias vivem só nesta sessão.
    await cliente.query("SET search_path TO pg_catalog");
    await cliente.query(AJUDANTES_SQL);
    await cliente.query("SET search_path TO pg_catalog, pg_temp");
    const linhas: Linhas = new Map();
    for (const sql of CONSULTAS) {
      const { rows } = await cliente.query<{ categoria: string; chave: string; valor: string }>(
        sql,
        sql.includes("$2") ? [SCHEMA, IGNORAR_TABELAS] : sql.includes("$1") ? [SCHEMA] : []
      );
      for (const { categoria, chave, valor } of rows) {
        linhas.set(`${categoria} | ${chave}`, (valor ?? "").replace(/\r\n/g, "\n").trimEnd());
      }
    }
    return linhas;
  } finally {
    await cliente.end();
  }
}

export function diferencas(a: Linhas, b: Linhas): string[] {
  const chaves = [...new Set([...a.keys(), ...b.keys()])].sort();
  const saida: string[] = [];
  for (const chave of chaves) {
    const va = a.get(chave);
    const vb = b.get(chave);
    if (va === vb) continue;
    if (vb === undefined) saida.push(`- só em A: ${chave}\n    ${va}`);
    else if (va === undefined) saida.push(`+ só em B: ${chave}\n    ${vb}`);
    else saida.push(`~ difere: ${chave}\n    A: ${va}\n    B: ${vb}`);
  }
  return saida;
}

// "env:NOME" lê a variável; vazio usa a padrão; o resto é tratado como URL.
function resolverUrl(arg: string | undefined, padrao: string): { url: string; variavel: string } {
  const nome = !arg ? padrao : arg.startsWith("env:") ? arg.slice(4) : undefined;
  if (nome) {
    const url = process.env[nome]?.trim();
    if (!url) throw new Error(`Defina ${nome} no terminal (URL de um banco local descartável).`);
    return { url, variavel: nome };
  }
  return { url: arg!, variavel: "a URL do argumento" };
}

async function main() {
  const [argA, argB] = process.argv.slice(2);
  const a = resolverUrl(argA, "COMPARAR_URL_A");
  const b = resolverUrl(argB, "COMPARAR_URL_B");
  const alvoA = exigirBancoLocalDescartavel(a.url, a.variavel);
  const alvoB = exigirBancoLocalDescartavel(b.url, b.variavel);
  console.log(`A: host=${alvoA.host} porta=${alvoA.porta} banco=${alvoA.banco}`);
  console.log(`B: host=${alvoB.host} porta=${alvoB.porta} banco=${alvoB.banco}`);

  const [catA, catB] = await Promise.all([lerCatalogo(a.url), lerCatalogo(b.url)]);
  console.log(`Objetos lidos: A=${catA.size} B=${catB.size} (schema ${SCHEMA}, sem ${IGNORAR_TABELAS.join(", ")})`);
  const difs = diferencas(catA, catB);
  if (difs.length === 0) {
    console.log("Nenhuma diferença.");
    return;
  }
  console.log(`${difs.length} diferença(s):\n${difs.join("\n")}`);
  process.exitCode = 1;
}

if (require.main === module) {
  main().catch((erro: unknown) => {
    // Erro de conexão: só o código (a mensagem pode ter host e usuário). Erro de SQL
    // (SQLSTATE de 5 caracteres): a mensagem do servidor. Sem código: mensagem das travas.
    const { code, message } = (erro ?? {}) as { code?: string; message?: string };
    if (!code) console.error(`Recusado: ${message}`);
    else if (/^[0-9A-Z]{5}$/.test(code)) console.error(`Falha ao ler o catálogo (SQLSTATE ${code}): ${message}`);
    else console.error(`Falha ao conectar (código ${code}).`);
    process.exitCode = 2;
  });
}
