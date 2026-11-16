// Gera db/ddl_final.sql a partir das migrations do Prisma (PI4-147), na ordem em que o
// `prisma migrate deploy` as aplica (nome da pasta). Não fala com banco.
//   npm run db:ddl                 regrava db/ddl_final.sql
//   npm run db:ddl -- --conferir   só confere se o arquivo está atualizado (código 1 se não)
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BACKEND = join(__dirname, "..");
const PASTA_MIGRATIONS = join(BACKEND, "prisma", "migrations");
const DESTINO = join(BACKEND, "..", "db", "ddl_final.sql");

const lf = (texto: string) => texto.replace(/\r\n/g, "\n");

export function montarDdl(): string {
  const migrations = readdirSync(PASTA_MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(PASTA_MIGRATIONS, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort();
  if (migrations.length === 0) throw new Error("Nenhuma migration em backend/prisma/migrations.");

  const partes = [
    "-- =====================================================================",
    "-- ORIGEM | DDL FINAL (schema origem, sem dados)",
    "-- ARQUIVO GERADO: não edite. A fonte da verdade são as migrations do Prisma em",
    `-- backend/prisma/migrations (${migrations.join(", ")}).`,
    "-- Para regenerar: cd backend && npm run db:ddl",
    "-- Para conferir se está atualizado: npm run db:ddl -- --conferir",
    "--",
    "-- Aplicar num banco PostgreSQL 13+ VAZIO e DESCARTÁVEL (nunca no Neon do time):",
    "--   psql -v ON_ERROR_STOP=1 -f db/ddl_final.sql",
    "-- Depois, a carga de demonstração: db/05_dados_raizes_pe.sql e db/07_autenticacao.sql.",
    "-- Tudo roda em uma transação: se algo falhar, nada fica criado.",
    "-- =====================================================================",
    "",
    "SET client_encoding TO 'UTF8';",
    "",
    "BEGIN;",
  ];
  for (const nome of migrations) {
    const sql = lf(readFileSync(join(PASTA_MIGRATIONS, nome, "migration.sql"), "utf8")).trim();
    partes.push("", `-- >>> migration ${nome}`, "", sql, "", `-- <<< fim da migration ${nome}`);
  }
  partes.push("", "COMMIT;", "");
  return partes.join("\n");
}

function main(): number {
  const ddl = montarDdl();
  if (process.argv.includes("--conferir")) {
    const atual = existsSync(DESTINO) ? lf(readFileSync(DESTINO, "utf8")) : "";
    if (atual === ddl) {
      console.log("db/ddl_final.sql está atualizado com as migrations.");
      return 0;
    }
    console.error("db/ddl_final.sql está DESATUALIZADO. Rode: npm run db:ddl");
    return 1;
  }
  writeFileSync(DESTINO, ddl, "utf8");
  console.log(`db/ddl_final.sql gerado (${ddl.split("\n").length} linhas).`);
  return 0;
}

if (require.main === module) process.exit(main());
