// Aplica as migrations (prisma migrate deploy) num banco LOCAL descartável (PI4-147).
// Nunca no banco do time: a URL vem só de MIGRATE_DATABASE_URL, precisa ser localhost,
// 127.0.0.1 ou ::1 e não pode ser a DATABASE_URL nem a DIRECT_URL de nenhuma fonte do time
// (process.env, backend/.env, .env.local e .env da raiz). Imprime só host, porta e banco.
//
// Uso: MIGRATE_DATABASE_URL=postgresql://postgres:<senha>@127.0.0.1:<porta>/<banco> npm run db:migrar-descartavel
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { exigirBancoLocalDescartavel } from "./travaBanco";

function main(): number {
  const url = process.env.MIGRATE_DATABASE_URL?.trim();
  if (!url) {
    console.error("Defina MIGRATE_DATABASE_URL no terminal com a URL de um banco LOCAL descartável.");
    return 2;
  }
  let alvo;
  try {
    alvo = exigirBancoLocalDescartavel(url, "MIGRATE_DATABASE_URL");
  } catch (erro) {
    console.error(`Recusado: ${(erro as Error).message}`);
    return 2;
  }
  console.log(`alvo: host=${alvo.host} porta=${alvo.porta} banco=${alvo.banco}`);

  // O prisma.config.ts lê DIRECT_URL. O processo filho recebe DIRECT_URL e DATABASE_URL
  // apontando para o banco descartável; o dotenv do config não sobrescreve variáveis já
  // definidas, então um backend/.env do time não muda o alvo.
  const prisma = join(__dirname, "..", "node_modules", "prisma", "build", "index.js");
  const env = { ...process.env, DIRECT_URL: url, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" };
  for (const args of [["migrate", "deploy"], ["migrate", "status"]]) {
    const r = spawnSync(process.execPath, [prisma, ...args], { stdio: "inherit", env, cwd: join(__dirname, "..") });
    if (r.error || r.status !== 0) {
      console.error(`prisma ${args.join(" ")} falhou (código ${r.status ?? "?"}).`);
      return 1;
    }
  }
  return 0;
}

process.exit(main());
