import "dotenv/config";
import { defineConfig } from "prisma/config";

// Configuração da CLI do Prisma. A CLI usa a connection string DIRETA (não pooled) do Neon.
// Usa process.env em vez de env() do prisma/config, que lança erro quando a variável
// falta: assim `npm install`, `prisma generate` e `npm run build` funcionam sem .env.
// Migrations (PI4-147): ficam em prisma/migrations. 0_init sai do schema.prisma e
// 1_regras_sql traz o que o Prisma não expressa (CHECK, gatilhos, funções, view, perfis).
// Só rode `migrate deploy` em banco local descartável (npm run db:migrar-descartavel).
// No banco do time, a baseline é marcada com `migrate resolve` pelo responsável (README).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
