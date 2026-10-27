import "dotenv/config";
import { defineConfig } from "prisma/config";

// Configuração da CLI do Prisma. A CLI usa a connection string DIRETA (não pooled) do Neon.
// Usa process.env em vez de env() do prisma/config, que lança erro quando a variável
// falta: assim `npm install`, `prisma generate` e `npm run build` funcionam sem .env.
// Não há migrations: o esquema é mantido pelos scripts de db/ e só lido via `db pull`.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
